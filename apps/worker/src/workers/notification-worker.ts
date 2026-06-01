import { Worker, Job } from "bullmq";
import { db } from "../db";
import { getRedisConnection } from "../lib/redis";
import { sendEmailNotification } from "../notifiers/email";
import { sendDiscordNotification } from "../notifiers/discord";
import { sendSlackNotification } from "../notifiers/slack";
import { sendTelegramNotification } from "../notifiers/telegram";
import { notificationQueue } from "../queues";

interface NotifyJobData {
  monitorId: string;
  userId: string;
  monitorName: string;
  oldValue: string;
  newValue: string;
  url: string;
  eventType: string;
  eventId: string;
}

interface NotificationChannel {
  id: string;
  userId: string;
  type: string;
  config: string; // JSON
  spaceId?: string;
  enabled: boolean;
}

interface QuietHours {
  start: number; // hour 0-23
  end: number;
}

interface DigestSettings {
  enabled: boolean;
  hour: number; // deliver at this hour (0-23)
}

function isInQuietHours(quietHours: QuietHours): boolean {
  const now = new Date();
  const hour = now.getHours();
  if (quietHours.start <= quietHours.end) {
    return hour >= quietHours.start && hour < quietHours.end;
  }
  // Wraps midnight
  return hour >= quietHours.start || hour < quietHours.end;
}

function msUntilHour(targetHour: number): number {
  const now = new Date();
  const target = new Date(now);
  target.setHours(targetHour, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target.getTime() - now.getTime();
}

async function processNotification(job: Job<NotifyJobData>): Promise<void> {
  const { userId, monitorName, oldValue, newValue, url, eventType } = job.data;

  const data = await db.query({
    notificationChannels: { $: { where: { userId, enabled: true } } },
  });

  const channels = (data?.notificationChannels || []) as NotificationChannel[];

  if (channels.length === 0) {
    // Fallback: try to get user email and send via email
    try {
      const user = await db.auth.getUser({ id: userId });
      if (user?.email) {
        await sendEmailNotification(
          { to: user.email },
          { monitorName, oldValue, newValue, url, eventType }
        );
      }
    } catch {
      // No email fallback available
    }
    return;
  }

  const payload = { monitorName, oldValue, newValue, url, eventType };

  for (const channel of channels) {
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(channel.config);
    } catch {
      continue;
    }

    // Check quiet hours
    if (config.quietHours) {
      const qh = config.quietHours as QuietHours;
      if (isInQuietHours(qh)) {
        const msUntilEnd = msUntilHour(qh.end);
        await notificationQueue.add("notify", job.data, { delay: msUntilEnd });
        console.log(`[notification-worker] Holding notification for ${userId} during quiet hours`);
        continue;
      }
    }

    // Check digest mode
    if (config.digest) {
      const digest = config.digest as DigestSettings;
      if (digest.enabled) {
        const delay = msUntilHour(digest.hour);
        await notificationQueue.add("notify", job.data, { delay });
        console.log(`[notification-worker] Queued for digest at hour ${digest.hour}`);
        continue;
      }
    }

    // Deliver immediately
    try {
      if (channel.type === "email" && config.to) {
        await sendEmailNotification({ to: config.to as string }, payload);
      } else if (channel.type === "discord" && config.webhookUrl) {
        await sendDiscordNotification({ webhookUrl: config.webhookUrl as string }, payload);
      } else if (channel.type === "slack" && config.webhookUrl) {
        await sendSlackNotification({ webhookUrl: config.webhookUrl as string }, payload);
      } else if (channel.type === "telegram" && config.botToken && config.chatId) {
        await sendTelegramNotification(
          { botToken: config.botToken as string, chatId: config.chatId as string },
          payload
        );
      }
    } catch (err) {
      console.error(`[notification-worker] Channel ${channel.id} delivery error:`, err);
    }
  }
}

export function startNotificationWorker(): Worker {
  const worker = new Worker<NotifyJobData>("notification_queue", processNotification, {
    connection: getRedisConnection(),
    concurrency: 10,
  });

  worker.on("failed", (job, err) => {
    console.error(`[notification-worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
