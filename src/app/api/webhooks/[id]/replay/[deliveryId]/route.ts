import { adminDb } from "@/lib/instant-admin";
import { id } from "@instantdb/admin";
import crypto from "crypto";

export async function POST(
  request: Request,
  { params }: { params: { id: string; deliveryId: string } }
) {
  const userId = request.headers.get("x-user-id");
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch the endpoint and original delivery in parallel
  const [endpointData, deliveryData] = await Promise.all([
    adminDb.query({ webhookEndpoints: { $: { where: { id: params.id, userId } } } }),
    adminDb.query({ webhookDeliveries: { $: { where: { id: params.deliveryId } } } }),
  ]);

  const endpoint = endpointData?.webhookEndpoints?.[0] as
    | { id: string; url: string; secret: string }
    | undefined;
  const delivery = deliveryData?.webhookDeliveries?.[0] as
    | { id: string; payload: string; webhookId: string }
    | undefined;

  if (!endpoint || !delivery) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = delivery.payload;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature =
    "sha256=" + crypto.createHmac("sha256", endpoint.secret).update(body).digest("hex");

  let status = 0;
  let ok = false;
  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Keen-Signature": signature,
        "X-Keen-Event": "replay",
        "X-Keen-Timestamp": timestamp,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    status = response.status;
    ok = response.ok;
  } catch {
    status = 0;
    ok = false;
  }

  const newDeliveryId = id();
  await adminDb.transact(
    adminDb.tx.webhookDeliveries[newDeliveryId].update({
      webhookId: endpoint.id,
      eventId: "",
      status: ok ? "delivered" : "failed",
      responseCode: status,
      attemptCount: 1,
      payload: body,
      createdAt: Date.now(),
      lastAttemptAt: Date.now(),
    })
  );

  return Response.json({ deliveryId: newDeliveryId, status, ok });
}
