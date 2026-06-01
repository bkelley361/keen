import { adminDb } from "@/lib/instant-admin";
import { computeDiff } from "@/lib/diff";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const userId = request.headers.get("x-user-id");
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const aId = url.searchParams.get("a");
  const bId = url.searchParams.get("b");

  if (!aId || !bId) {
    return Response.json({ error: "a and b snapshot IDs are required" }, { status: 400 });
  }

  const [dataA, dataB] = await Promise.all([
    adminDb.query({ snapshots: { $: { where: { id: aId } } } }),
    adminDb.query({ snapshots: { $: { where: { id: bId } } } }),
  ]);

  const snapshotA = dataA?.snapshots?.[0] as { contentText?: string } | undefined;
  const snapshotB = dataB?.snapshots?.[0] as { contentText?: string } | undefined;

  if (!snapshotA || !snapshotB) {
    return Response.json({ error: "Snapshots not found" }, { status: 404 });
  }

  const diff = computeDiff(snapshotA.contentText || "", snapshotB.contentText || "");

  return Response.json({ diff });
}
