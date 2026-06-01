interface TelegramConfig {
  botToken: string;
  chatId: string;
}

interface NotificationPayload {
  monitorName: string;
  oldValue: string;
  newValue: string;
  url: string;
  eventType: string;
}

export async function sendTelegramNotification(
  config: TelegramConfig,
  payload: NotificationPayload
): Promise<boolean> {
  const text =
    `🔔 *${escapeMarkdown(payload.monitorName)}*\n\n` +
    `*Before:* ${escapeMarkdown(payload.oldValue || "(none)")}\n` +
    `*After:* ${escapeMarkdown(payload.newValue)}\n\n` +
    `[View →](${payload.url})`;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${config.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: config.chatId,
          text,
          parse_mode: "MarkdownV2",
          disable_web_page_preview: false,
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}
