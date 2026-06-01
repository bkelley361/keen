import { Worker, Job } from "bullmq";
import { db, id } from "../db";
import { getRedisConnection } from "../lib/redis";
import { signPayload } from "../lib/signing";
import { webhookQueue } from "../queues";

const RETRY_DELAYS_MS = [30_000, 5 * 60_000, 60 * 60_000];
const MAX_ATTEMPTS = 3;

interface WebhookJobData {
  userId: string;
  monitorId: string;
  eventType: string;
  eventId: string;
  payload: Record<string, unknown>;
  webhookEndpointId?: string; // if targeting a specific endpoint
}

interface WebhookEndpoint {
  id: string;
  userId: string;
  url: string;
  secret: string;
  eventSubscriptions: string; // JSON array
  enabled: boolean;
}

async function deliverToEndpoint(
  endpoint: WebhookEndpoint,
  eventType: string,
  payload: Record<string, unknown>
): Promise<{ status: number; ok: boolean }> {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signPayload(endpoint.secret, body);

  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Keen-Signature": signature,
        "X-Keen-Event": eventType,
        "X-Keen-Timestamp": timestamp,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    return { status: response.status, ok: response.ok };
  } catch (err) {
    return { status: 0, ok: false };
  }
}

async function processJob(job: Job<WebhookJobData>): Promise<void> {
  const { userId, eventType, payload } = job.data;
  const attemptNumber = job.attemptsMade;

  // Find matching enabled endpoints for this user and event type
  const data = await db.query({
    webhookEndpoints: { $: { where: { userId, enabled: true } } },
  });

  const endpoints = (data?.webhookEndpoints || []) as WebhookEndpoint[];
  const matching = endpoints.filter((ep) => {
    try {
      const subs: string[] = JSON.parse(ep.eventSubscriptions);
      return subs.includes(eventType) || subs.includes("*");
    } catch {
      return false;
    }
  });

  if (matching.length === 0) return;

  await Promise.all(
    matching.map(async (endpoint) => {
      const deliveryId = id();
      const { status, ok } = await deliverToEndpoint(endpoint, eventType, payload);

      await db.transact(
        db.tx.webhookDeliveries[deliveryId].update({
          webhookId: endpoint.id,
          eventId: job.data.eventId,
          status: ok ? "delivered" : "failed",
          responseCode: status,
          attemptCount: attemptNumber + 1,
          payload: JSON.stringify(payload),
          createdAt: Date.now(),
          lastAttemptAt: Date.now(),
        })
      );

      if (!ok && attemptNumber < MAX_ATTEMPTS - 1) {
        const delay = RETRY_DELAYS_MS[attemptNumber] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
        await webhookQueue.add("deliver", job.data, { delay });
        console.log(`[webhook-worker] Scheduled retry for endpoint ${endpoint.id} in ${delay}ms`);
      }
    })
  );
}

export function startWebhookWorker(): Worker {
  const worker = new Worker<WebhookJobData>("webhook_queue", processJob, {
    connection: getRedisConnection(),
    concurrency: 10,
  });

  worker.on("failed", (job, err) => {
    console.error(`[webhook-worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
