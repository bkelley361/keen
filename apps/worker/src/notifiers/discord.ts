interface DiscordConfig {
  webhookUrl: string;
}

interface NotificationPayload {
  monitorName: string;
  oldValue: string;
  newValue: string;
  url: string;
  eventType: string;
}

const EVENT_COLORS: Record<string, number> = {
  "price.dropped": 0x22c55e,   // green
  "price.increased": 0xef4444, // red
  "website.changed": 0xeab308, // yellow
  "youtube.new_video": 0xff0000, // YouTube red
  "rss.new_item": 0x6366f1,    // indigo
  "monitor.error": 0xef4444,   // red
};

export async function sendDiscordNotification(
  config: DiscordConfig,
  payload: NotificationPayload
): Promise<boolean> {
  const color = EVENT_COLORS[payload.eventType] ?? 0x6366f1;

  const body = {
    embeds: [
      {
        title: `🔔 ${payload.monitorName}`,
        description: `**Changed:** ${payload.oldValue || "(none)"} → **${payload.newValue}**`,
        color,
        url: payload.url,
        footer: { text: `Keen • ${payload.eventType}` },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const res = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
