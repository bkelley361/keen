import { adminDb } from "@/lib/instant-admin";
import { id } from "@instantdb/admin";

export async function GET(request: Request) {
  const userId = request.headers.get("x-user-id");
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const data = await adminDb.query({
    notificationChannels: { $: { where: { userId } } },
  });

  return Response.json({ channels: data?.notificationChannels || [] });
}

export async function POST(request: Request) {
  const userId = request.headers.get("x-user-id");
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { type, config, spaceId } = body;

  if (!type || !config) {
    return Response.json({ error: "type and config are required" }, { status: 400 });
  }

  const channelId = id();
  await adminDb.transact(
    adminDb.tx.notificationChannels[channelId].update({
      userId,
      type,
      config: JSON.stringify(config),
      spaceId: spaceId || null,
      enabled: true,
      createdAt: Date.now(),
    })
  );

  return Response.json({ id: channelId }, { status: 201 });
}
