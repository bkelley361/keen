import { runScheduler } from "./scheduler";
import { startPollWorker } from "./workers/poll-worker";
import { startNotificationWorker } from "./workers/notification-worker";
import { startWebhookWorker } from "./workers/webhook-worker";
import { startRetentionJob } from "./workers/retention-worker";

async function main() {
  console.log("[worker] Keen worker starting...");

  // Start BullMQ workers
  startPollWorker();
  startNotificationWorker();
  startWebhookWorker();
  startRetentionJob();

  // Start scheduler loop (blocking)
  await runScheduler();
}

main().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
