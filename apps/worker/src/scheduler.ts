import { db } from "./db";
import { pollingQueue } from "./queues";
import { getCostClassPriority } from "./monitors/index";

const SCHEDULER_INTERVAL_MS = 30_000;

interface MonitorRecord {
  id: string;
  userId: string;
  name: string;
  type: string;
  url: string;
  selector?: string;
  clickSelector?: string;
  status?: string;
  nextCheckAt?: number;
  frequencySeconds?: number;
  costClass?: string;
  spaceId?: string;
}

export async function runScheduler(): Promise<void> {
  console.log("[scheduler] Starting scheduler loop");

  while (true) {
    try {
      await tick();
    } catch (err) {
      console.error("[scheduler] Tick error:", err);
    }
    await sleep(SCHEDULER_INTERVAL_MS);
  }
}

async function tick(): Promise<void> {
  const now = Date.now();

  const data = await db.query({
    monitors: {
      $: {
        where: { active: true },
      },
    },
  });

  const monitors = (data?.monitors || []) as MonitorRecord[];

  // Filter to monitors that are due: either no nextCheckAt or nextCheckAt is in the past
  const due = monitors.filter((m) => {
    if (m.status === "paused" || m.status === "archived") return false;
    if (!m.nextCheckAt) return true;
    return m.nextCheckAt <= now;
  });

  if (due.length === 0) {
    console.log(`[scheduler] No monitors due at ${new Date(now).toISOString()}`);
    return;
  }

  console.log(`[scheduler] ${due.length} monitors due, enqueuing jobs`);

  // Deduplicate by canonicalUrl so shared sources get one job
  const byUrl = new Map<string, MonitorRecord[]>();
  for (const m of due) {
    const key = m.url;
    if (!byUrl.has(key)) byUrl.set(key, []);
    byUrl.get(key)!.push(m);
  }

  const updates: Promise<unknown>[] = [];

  for (const [url, group] of byUrl) {
    const representative = group[0];
    const monitorIds = group.map((m) => m.id);
    const priority = getCostClassPriority(representative.costClass);

    await pollingQueue.add(
      "poll",
      {
        url,
        monitorIds,
        sourceType: representative.type,
        selector: representative.selector,
        clickSelector: representative.clickSelector,
      },
      { priority }
    );

    // Update nextCheckAt for all monitors in this group
    for (const m of group) {
      const frequencyMs = (m.frequencySeconds ?? 14400) * 1000;
      updates.push(
        db.transact(
          db.tx.monitors[m.id].update({
            nextCheckAt: now + frequencyMs,
            lastCheckedAt: now,
          })
        )
      );
    }
  }

  await Promise.all(updates);
  console.log(`[scheduler] Enqueued ${byUrl.size} poll jobs`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
