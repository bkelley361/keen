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

function labelFor(kind: string | undefined): string {
  switch (kind) {
    case "short":
      return "New short";
    case "post":
      return "New community post";
    case "video":
      return "New video";
    default:
      return "Value changed";
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || token.length < 16) {
    return new Response("Not found", { status: 404 });
  }

  const tokenData = await adminDb.query({
    feedTokens: { $: { where: { token } } },
  });
  const tokenRow = tokenData?.feedTokens?.[0] as
    | { id: string; userId: string; token: string }
    | undefined;

  if (!tokenRow) {
    return new Response("Not found", { status: 404 });
  }

  const userId = tokenRow.userId;

  const data = await adminDb.query({
    monitors: { $: { where: { userId } } },
  });

  const monitors = data?.monitors || [];
  const baseUrl = new URL(request.url).origin;
  const selfUrl = `${baseUrl}/api/feed/${token}`;

  if (monitors.length === 0) {
    const empty = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Keen Changes</title>
  <id>${selfUrl}</id>
  <updated>${new Date().toISOString()}</updated>
  <link href="${selfUrl}" rel="self"/>
</feed>`;
    return new Response(empty, {
      headers: { "Content-Type": "application/atom+xml; charset=utf-8" },
    });
  }

  const monitorMap = new Map(
    monitors.map((m: Record<string, unknown>) => [m.id, m])
  );

  const notifData = await adminDb.query({
    notifications: { $: { order: { serverCreatedAt: "desc" }, limit: 100 } },
  });

  const notifications = (notifData?.notifications || []).filter(
    (n: Record<string, unknown>) => monitorMap.has(n.monitorId as string)
  );

  const entries = notifications
    .map((n: Record<string, unknown>) => {
      const monitor = monitorMap.get(n.monitorId as string) as
        | Record<string, unknown>
        | undefined;
      if (!monitor) return "";
      const kind = n.kind as string | undefined;
      const label = labelFor(kind);
      const published = n.sentAt
        ? new Date(n.sentAt as number).toISOString()
        : new Date().toISOString();
      const linkHref = (n.itemUrl as string) || (monitor.url as string);
      return `  <entry>
    <title>${escapeXml(monitor.name as string)}: ${escapeXml(label)}</title>
    <id>${baseUrl}/notification/${n.id}</id>
    <updated>${published}</updated>
    <published>${published}</published>
    <link href="${escapeXml(linkHref)}" rel="alternate"/>
    <category term="${escapeXml(kind || "change")}"/>
    <content type="text">${escapeXml((n.oldValue as string) || "(empty)")} → ${escapeXml((n.newValue as string) || "")}</content>
  </entry>`;
    })
    .filter(Boolean)
    .join("\n");

  const feed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Keen Changes</title>
  <id>${selfUrl}</id>
  <updated>${new Date().toISOString()}</updated>
  <link href="${selfUrl}" rel="self"/>
${entries}
</feed>`;

  return new Response(feed, {
    headers: { "Content-Type": "application/atom+xml; charset=utf-8" },
  });
}
