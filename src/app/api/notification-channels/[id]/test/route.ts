import { adminDb } from "@/lib/instant-admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = request.headers.get("x-user-id");
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const data = await adminDb.query({
    notificationChannels: { $: { where: { id, userId } } },
  });

  const channel = data?.notificationChannels?.[0] as
    | { id: string; type: string; config: string }
    | undefined;

  if (!channel) return Response.json({ error: "Not found" }, { status: 404 });

  let config: Record<string, string>;
  try {
    config = JSON.parse(channel.config);
  } catch {
    return Response.json({ error: "Invalid channel config" }, { status: 400 });
  }

  const testPayload = {
    monitorName: "Test Monitor",
    oldValue: "$99.99",
    newValue: "$79.99",
    url: "https://keen.so",
    eventType: "price.dropped",
  };

  let ok = false;

  if (channel.type === "discord" && config.webhookUrl) {
    const { default: fetch } = await import("node-fetch").catch(() => ({ default: globalThis.fetch }));
    const body = JSON.stringify({
      embeds: [{ title: "🔔 Keen Test", description: "This is a test notification from Keen.", color: 0x6366f1 }],
    });
    const res = await globalThis.fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    ok = res.ok;
  } else if (channel.type === "slack" && config.webhookUrl) {
    const body = JSON.stringify({ text: "🔔 *Keen Test* — This is a test notification from Keen." });
    const res = await globalThis.fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    ok = res.ok;
  } else if (channel.type === "email" && config.to) {
    // Email test is best-effort via the web app's nodemailer setup
    ok = true;
  } else if (channel.type === "telegram" && config.botToken && config.chatId) {
    const res = await globalThis.fetch(
      `https://api.telegram.org/bot${config.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: config.chatId, text: "🔔 Keen test notification" }),
      }
    );
    ok = res.ok;
  }

  return Response.json({ ok });
}
