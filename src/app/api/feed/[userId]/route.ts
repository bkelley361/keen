import { adminDb } from "@/lib/instant-admin";

export const dynamic = "force-dynamic";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  const data = await adminDb.query({
    monitors: { $: { where: { userId } } },
  });

  const monitors = data?.monitors || [];
  if (monitors.length === 0) {
    return new Response("<feed/>", {
      headers: { "Content-Type": "application/atom+xml" },
    });
  }

  const monitorMap = new Map(
    monitors.map((m: Record<string, unknown>) => [m.id, m])
  );

  const notifData = await adminDb.query({
    notifications: { $: { order: { serverCreatedAt: "desc" }, limit: 50 } },
  });

  const notifications = (notifData?.notifications || []).filter(
    (n: Record<string, unknown>) => monitorMap.has(n.monitorId as string)
  );

  const baseUrl = new URL(request.url).origin;

  const entries = notifications
    .map((n: Record<string, unknown>) => {
      const monitor = monitorMap.get(n.monitorId as string) as Record<string, unknown> | undefined;
      if (!monitor) return "";
      const published = n.sentAt
        ? new Date(n.sentAt as number).toISOString()
        : new Date().toISOString();
      return `  <entry>
    <title>${escapeXml(monitor.name as string)}: value changed</title>
    <id>${baseUrl}/notification/${n.id}</id>
    <updated>${published}</updated>
    <published>${published}</published>
    <link href="${escapeXml(monitor.url as string)}" rel="alternate"/>
    <content type="text">${escapeXml((n.oldValue as string) || "(empty)")} → ${escapeXml(n.newValue as string)}</content>
  </entry>`;
    })
    .filter(Boolean)
    .join("\n");

  const feed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>WatchTower Changes</title>
  <id>${baseUrl}/api/feed/${userId}</id>
  <updated>${new Date().toISOString()}</updated>
  <link href="${baseUrl}/api/feed/${userId}" rel="self"/>
${entries}
</feed>`;

  return new Response(feed, {
    headers: { "Content-Type": "application/atom+xml; charset=utf-8" },
  });
}
