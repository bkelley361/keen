import { adminDb } from "@/lib/instant-admin";
import { id } from "@instantdb/admin";

export async function GET(request: Request) {
  const userId = request.headers.get("x-user-id");
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const data = await adminDb.query({
    spaces: { $: { where: { userId } } },
  });

  return Response.json({ spaces: data?.spaces || [] });
}

export async function POST(request: Request) {
  const userId = request.headers.get("x-user-id");
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, color, icon } = body;

  if (!name || typeof name !== "string") {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  const spaceId = id();
  await adminDb.transact(
    adminDb.tx.spaces[spaceId].update({
      userId,
      name: name.trim(),
      color: color || null,
      icon: icon || null,
      archived: false,
      createdAt: Date.now(),
    })
  );

  return Response.json({ id: spaceId }, { status: 201 });
}
