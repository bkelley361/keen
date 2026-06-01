import { adminDb } from "@/lib/instant-admin";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const userId = request.headers.get("x-user-id");
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);

  const data = await adminDb.query({
    snapshots: { $: { where: { monitorId: params.id } } },
  });

  const snapshots = (data?.snapshots || []).sort(
    (a: Record<string, unknown>, b: Record<string, unknown>) =>
      (b.createdAt as number) - (a.createdAt as number)
  ).slice(0, limit);

  return Response.json({ snapshots });
}
