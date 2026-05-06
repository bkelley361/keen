import { adminDb } from "@/lib/instant-admin";
import { id as instantId } from "@instantdb/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  const { userId, notificationEmail, hideThumbnails, cardSort } = body;

  if (!userId) {
    return Response.json({ error: "Missing userId" }, { status: 400 });
  }

  const data = await adminDb.query({
    userPrefs: { $: { where: { userId } } },
  });

  const existing = data?.userPrefs?.[0] as { id: string } | undefined;

  const recordId = existing?.id ?? instantId();
  const update: Record<string, unknown> = { userId };
  if (notificationEmail !== undefined) update.notificationEmail = notificationEmail;
  if (hideThumbnails !== undefined) update.hideThumbnails = hideThumbnails;
  if (cardSort !== undefined) update.cardSort = cardSort;

  await adminDb.transact(
    adminDb.tx.userPrefs[recordId].update(update)
  );

  return Response.json({ ok: true });
}
