interface SlackConfig {
  webhookUrl: string;
}

interface NotificationPayload {
  monitorName: string;
  oldValue: string;
  newValue: string;
  url: string;
  eventType: string;
}

export async function sendSlackNotification(
  config: SlackConfig,
  payload: NotificationPayload
): Promise<boolean> {
  const body = {
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `🔔 ${payload.monitorName}`, emoji: true },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Before:*\n${payload.oldValue || "(none)"}`,
          },
          {
            type: "mrkdwn",
            text: `*After:*\n${payload.newValue}`,
          },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View Monitor" },
            url: payload.url,
          },
        ],
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: `Keen • ${payload.eventType}` }],
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
