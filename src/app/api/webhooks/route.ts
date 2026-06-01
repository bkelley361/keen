import { adminDb } from "@/lib/instant-admin";
import { id } from "@instantdb/admin";
import crypto from "crypto";

export async function GET(request: Request) {
  const userId = request.headers.get("x-user-id");
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const data = await adminDb.query({
    webhookEndpoints: { $: { where: { userId } } },
  });

  return Response.json({ endpoints: data?.webhookEndpoints || [] });
}

export async function POST(request: Request) {
  const userId = request.headers.get("x-user-id");
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { url, description, eventSubscriptions } = body;

  if (!url || typeof url !== "string") {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  const secret = crypto.randomBytes(32).toString("hex");
  const endpointId = id();

  await adminDb.transact(
    adminDb.tx.webhookEndpoints[endpointId].update({
      userId,
      url,
      description: description || "",
      secret,
      eventSubscriptions: JSON.stringify(eventSubscriptions || ["*"]),
      enabled: true,
      createdAt: Date.now(),
    })
  );

  return Response.json({ id: endpointId, secret }, { status: 201 });
}
