import { Worker, Job } from "bullmq";
import { db, id } from "../db";
import { getRedisConnection } from "../lib/redis";
import { runMonitorCheck, MonitorData } from "../monitors/index";
import { updateSourceEntity, getOrCreateSourceEntity } from "../source-tracker";
import { evaluateRules } from "../lib/rules";
import { notificationQueue, webhookQueue } from "../queues";

interface PollJobData {
  url: string;
  monitorIds: string[];
  sourceType: string;
  selector?: string;
  clickSelector?: string;
}

async function processJob(job: Job<PollJobData>): Promise<void> {
  const { url, monitorIds, sourceType } = job.data;
  console.log(`[poll-worker] Processing job for ${url} (${monitorIds.length} monitors)`);

  // Fetch all monitor records
  const data = await db.query({
    monitors: { $: { where: { id: { in: monitorIds } } } },
  });
  const monitors = (data?.monitors || []) as MonitorData[];

  if (monitors.length === 0) {
    console.log(`[poll-worker] No monitors found for job`);
    return;
  }

  // Get/create source entity for deduplication tracking
  const sourceEntity = await getOrCreateSourceEntity(sourceType, url);

  // Run the check using the first monitor as representative (same url/selector)
  const representative = monitors[0] as MonitorData & { rules?: string };
  let checkResult;
  try {
    checkResult = await runMonitorCheck(representative);
  } catch (err) {
    console.error(`[poll-worker] Check error for ${url}:`, err);
    // Mark all monitors as errored
    await Promise.all(
      monitors.map((m) =>
        db.transact(
          db.tx.monitors[m.id].update({ lastStatus: "error", lastCheckedAt: Date.now() })
        )
      )
    );
    throw err; // BullMQ will handle retry
  }

  if (checkResult.value !== null && sourceEntity) {
    await updateSourceEntity(sourceEntity.id, checkResult.value);
  }

  // Fan out to each subscribed monitor
  await Promise.all(
    monitors.map(async (m) => {
      const monitor = m as MonitorData & { rules?: string };

      // Handle YouTube extras (shorts/posts) — these are per-monitor
      if (checkResult.ytExtraEvents?.length) {
        for (const extra of checkResult.ytExtraEvents) {
          const notifId = id();
          await db.transact(
            db.tx.notifications[notifId].update({
              monitorId: m.id,
              oldValue: extra.oldValue,
              newValue: extra.newValue,
              sentAt: Date.now(),
              kind: extra.kind,
              itemUrl: extra.itemUrl,
            })
          );
        }
      }

      if (checkResult.value === null) {
        await db.transact(
          db.tx.monitors[m.id].update({
            lastChecked: Date.now(),
            lastCheckedAt: Date.now(),
            lastStatus: "error",
            ...(checkResult.ytExtras || {}),
          })
        );
        return;
      }

      const changed = monitor.lastValue !== "" && monitor.lastValue !== checkResult.value;

      await db.transact(
        db.tx.monitors[m.id].update({
          lastValue: checkResult.value,
          lastChecked: Date.now(),
          lastCheckedAt: Date.now(),
          lastStatus: changed ? "changed" : "ok",
          ...(checkResult.ytExtras || {}),
        })
      );

      if (!changed) return;

      // Evaluate rules before sending notification
      if (monitor.rules) {
        try {
          const ruleGroup = JSON.parse(monitor.rules);
          const context = {
            value: checkResult.value,
            oldValue: monitor.lastValue || "",
            price: parseFloat(checkResult.value?.replace(/[^0-9.]/g, "") || ""),
          };
          if (!evaluateRules(ruleGroup, context)) {
            console.log(`[poll-worker] Rules suppressed notification for monitor ${m.id}`);
            return;
          }
        } catch (e) {
          console.error(`[poll-worker] Rule parse error for monitor ${m.id}:`, e);
        }
      }

      // Write snapshot
      const snapshotId = id();
      const numericValue = parseFloat(checkResult.value.replace(/[^0-9.]/g, ""));
      await db.transact(
        db.tx.snapshots[snapshotId].update({
          monitorId: m.id,
          contentHash: require("crypto")
            .createHash("sha256")
            .update(checkResult.value)
            .digest("hex"),
          contentText: checkResult.value,
          numericValue: isNaN(numericValue) ? undefined : numericValue,
          createdAt: Date.now(),
        })
      );

      // Write monitor event
      const eventId = id();
      const eventType = representative.type === "youtube" ? "youtube.new_video" : "website.changed";
      await db.transact(
        db.tx.monitorEvents[eventId].update({
          monitorId: m.id,
          eventType,
          payload: JSON.stringify({
            oldValue: monitor.lastValue,
            newValue: checkResult.value,
            url: checkResult.notificationUrl || m.url,
          }),
          createdAt: Date.now(),
        })
      );

      // Write notification record
      const notifId = id();
      await db.transact(
        db.tx.notifications[notifId].update({
          monitorId: m.id,
          oldValue: monitor.lastValue || "",
          newValue: checkResult.value,
          sentAt: Date.now(),
          kind: representative.type === "youtube" ? "video" : "webpage",
          itemUrl: checkResult.notificationUrl || m.url,
        })
      );

      // Enqueue notification job
      await notificationQueue.add("notify", {
        monitorId: m.id,
        userId: (monitor as MonitorData & { userId?: string }).userId,
        monitorName: (monitor as MonitorData & { name?: string }).name,
        oldValue: monitor.lastValue || "",
        newValue: checkResult.value,
        url: checkResult.notificationUrl || m.url,
        eventType,
        eventId,
      });

      // Enqueue webhook delivery job
      await webhookQueue.add("deliver", {
        userId: (monitor as MonitorData & { userId?: string }).userId,
        monitorId: m.id,
        eventType,
        eventId,
        payload: {
          event: eventType,
          timestamp: new Date().toISOString(),
          monitorId: m.id,
          source: { type: representative.type, url: m.url },
          changes: {
            oldValue: monitor.lastValue,
            newValue: checkResult.value,
          },
        },
      });
    })
  );
}

export function startPollWorker(): Worker {
  const worker = new Worker<PollJobData>("polling_queue", processJob, {
    connection: getRedisConnection(),
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    console.log(`[poll-worker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[poll-worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
