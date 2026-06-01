import { adminDb } from "@/lib/instant-admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = request.headers.get("x-user-id");
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { url, description, eventSubscriptions, enabled } = body;

  const updates: Record<string, unknown> = {};
  if (url !== undefined) updates.url = url;
  if (description !== undefined) updates.description = description;
  if (eventSubscriptions !== undefined) updates.eventSubscriptions = JSON.stringify(eventSubscriptions);
  if (enabled !== undefined) updates.enabled = enabled;

  await adminDb.transact(adminDb.tx.webhookEndpoints[id].update(updates));

  return Response.json({ success: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = request.headers.get("x-user-id");
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await adminDb.transact(adminDb.tx.webhookEndpoints[id].delete());

  return Response.json({ success: true });
}
