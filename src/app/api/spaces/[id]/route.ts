import { adminDb } from "@/lib/instant-admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = request.headers.get("x-user-id");
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, color, icon, archived, notificationSettings } = body;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (color !== undefined) updates.color = color;
  if (icon !== undefined) updates.icon = icon;
  if (archived !== undefined) updates.archived = archived;
  if (notificationSettings !== undefined)
    updates.notificationSettings = JSON.stringify(notificationSettings);

  await adminDb.transact(adminDb.tx.spaces[id].update(updates));

  return Response.json({ success: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = request.headers.get("x-user-id");
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await adminDb.transact(adminDb.tx.spaces[id].delete());

  return Response.json({ success: true });
}
