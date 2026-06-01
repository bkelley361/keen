import { adminDb } from "@/lib/instant-admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = request.headers.get("x-user-id");
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { config, enabled, spaceId } = body;

  const updates: Record<string, unknown> = {};
  if (config !== undefined) updates.config = JSON.stringify(config);
  if (enabled !== undefined) updates.enabled = enabled;
  if (spaceId !== undefined) updates.spaceId = spaceId;

  await adminDb.transact(adminDb.tx.notificationChannels[id].update(updates));

  return Response.json({ success: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = request.headers.get("x-user-id");
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await adminDb.transact(adminDb.tx.notificationChannels[id].delete());

  return Response.json({ success: true });
}
