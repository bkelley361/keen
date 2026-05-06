import { adminDb } from "@/lib/instant-admin";
import { id as instantId } from "@instantdb/admin";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

async function getOrCreate(userId: string): Promise<string> {
  const existing = await adminDb.query({
    feedTokens: { $: { where: { userId } } },
  });
  const row = existing?.feedTokens?.[0] as unknown as { token: string } | undefined;
  if (row?.token) return row.token;

  const token = generateToken();
  const newId = instantId();
  await adminDb.transact(
    adminDb.tx.feedTokens[newId].update({
      token,
      userId,
      createdAt: Date.now(),
    })
  );
  return token;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { userId, regenerate } = body as { userId?: string; regenerate?: boolean };

  if (!userId) {
    return Response.json({ error: "Missing userId" }, { status: 400 });
  }

  if (regenerate) {
    const existing = await adminDb.query({
      feedTokens: { $: { where: { userId } } },
    });
    const rows = (existing?.feedTokens || []) as { id: string }[];
    if (rows.length > 0) {
      await adminDb.transact(
        rows.map((r) => adminDb.tx.feedTokens[r.id].delete())
      );
    }
  }

  const token = await getOrCreate(userId);
  return Response.json({ token });
}
