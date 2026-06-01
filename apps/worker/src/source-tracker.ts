import { db, id } from "./db";
import crypto from "crypto";

const MIN_POLL_INTERVAL_MS = 60_000; // don't re-poll same source within 1 minute

interface SourceEntity {
  id: string;
  canonicalUrl: string;
  lastPolledAt?: number;
  lastHash?: string;
}

export async function getOrCreateSourceEntity(
  sourceType: string,
  canonicalUrl: string
): Promise<SourceEntity | null> {
  try {
    const data = await db.query({
      sourceEntities: {
        $: { where: { canonicalUrl } },
      },
    });

    const existing = data?.sourceEntities?.[0] as SourceEntity | undefined;
    if (existing) return existing;

    const newId = id();
    await db.transact(
      db.tx.sourceEntities[newId].update({
        sourceType,
        canonicalUrl,
      })
    );
    return { id: newId, canonicalUrl };
  } catch (err) {
    console.error("[source-tracker] Error getting/creating source entity:", err);
    return null;
  }
}

export async function updateSourceEntity(
  entityId: string,
  content: string
): Promise<{ hash: string; changed: boolean }> {
  const hash = crypto.createHash("sha256").update(content).digest("hex");

  const data = await db.query({
    sourceEntities: { $: { where: { id: entityId } } },
  });
  const existing = data?.sourceEntities?.[0] as SourceEntity | undefined;
  const changed = !existing?.lastHash || existing.lastHash !== hash;

  await db.transact(
    db.tx.sourceEntities[entityId].update({
      lastPolledAt: Date.now(),
      lastHash: hash,
    })
  );

  return { hash, changed };
}

export function isRecentlyPolled(entity: SourceEntity): boolean {
  if (!entity.lastPolledAt) return false;
  return Date.now() - entity.lastPolledAt < MIN_POLL_INTERVAL_MS;
}
