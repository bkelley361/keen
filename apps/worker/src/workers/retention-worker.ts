import { db } from "../db";

const DAY_MS = 24 * 60 * 60 * 1000;
const FREE_RETENTION_DAYS = 30;
const RUN_INTERVAL_MS = DAY_MS;

interface Snapshot {
  id: string;
  createdAt: number;
}

async function runRetentionCleanup(): Promise<void> {
  console.log("[retention] Running snapshot retention cleanup");

  const cutoff = Date.now() - FREE_RETENTION_DAYS * DAY_MS;

  try {
    const data = await db.query({
      snapshots: {},
    });

    const snapshots = (data?.snapshots || []) as Snapshot[];
    const old = snapshots.filter((s) => s.createdAt < cutoff);

    if (old.length === 0) {
      console.log("[retention] No snapshots to purge");
      return;
    }

    console.log(`[retention] Purging ${old.length} snapshots older than ${FREE_RETENTION_DAYS} days`);

    // Delete in batches to avoid overloading the DB
    const BATCH_SIZE = 50;
    for (let i = 0; i < old.length; i += BATCH_SIZE) {
      const batch = old.slice(i, i + BATCH_SIZE);
      for (const s of batch) {
        await db.transact(db.tx.snapshots[s.id].delete());
      }
    }

    console.log(`[retention] Purged ${old.length} snapshots`);
  } catch (err) {
    console.error("[retention] Cleanup error:", err);
  }
}

export function startRetentionJob(): void {
  // Run once on startup (after a brief delay), then daily
  setTimeout(() => {
    runRetentionCleanup();
    setInterval(runRetentionCleanup, RUN_INTERVAL_MS);
  }, 60_000);
}
