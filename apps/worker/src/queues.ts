import { Queue } from "bullmq";
import { getRedisConnection } from "./lib/redis";

const connection = getRedisConnection();

export const pollingQueue = new Queue("polling_queue", {
  connection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export const notificationQueue = new Queue("notification_queue", {
  connection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export const webhookQueue = new Queue("webhook_queue", {
  connection,
  defaultJobOptions: {
    removeOnComplete: 200,
    removeOnFail: 500,
  },
});
