import { adminDb } from "@/lib/instant-admin";
import { id as instantId } from "@instantdb/admin";
import * as cheerio from "cheerio";

export const dynamic = "force-dynamic";

interface FeedItem {
  title: string;
  link: string;
  pubDate: number;
  description: string;
  content: string;
}

function parseDate(dateStr: string): number {
  if (!dateStr) return Date.now();
  const parsed = new Date(dateStr).getTime();
  return isNaN(parsed) ? Date.now() : parsed;
}

function extractContentEncoded(itemXml: string): string {
  // content:encoded is tricky with cheerio namespace handling,
  // so extract it with regex from the raw item XML
  const match = itemXml.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i);
  if (!match) return "";
  let content = match[1].trim();
  // Unwrap CDATA
  if (content.startsWith("<![CDATA[")) {
    content = content.slice(9);
    if (content.endsWith("]]>")) content = content.slice(0, -3);
  }
  return content.trim();
}

function parseFeed(xml: string): FeedItem[] {
  const $ = cheerio.load(xml, { xml: true });
  const items: FeedItem[] = [];

  // RSS 2.0
  $("item").each((_, el) => {
    const $el = $(el);
    // Get the raw XML of this item to extract content:encoded
    const itemXml = $.xml($el);
    const contentEncoded = extractContentEncoded(itemXml);

    // description fallback — get raw HTML inside it
    const descEl = $el.find("description").first();
    const description = descEl.length > 0 ? (descEl.html() || descEl.text()).trim() : "";

    // link can be a text node or href attribute
    const link = $el.find("link").first().text().trim() ||
      $el.find("link").attr("href") ||
      $el.find("guid").text().trim() || "";

    items.push({
      title: $el.find("title").first().text().trim(),
      link,
      pubDate: parseDate(
        $el.find("pubDate").text() ||
        $el.find("dc\\:date").text()
      ),
      description: description || "",
      content: contentEncoded || description || "",
    });
  });

  // Atom
  if (items.length === 0) {
    $("entry").each((_, el) => {
      const $el = $(el);
      const link = $el.find("link[rel='alternate']").attr("href") ||
        $el.find("link").attr("href") || "";

      const contentEl = $el.find("content").first();
      const summaryEl = $el.find("summary").first();
      const contentHtml = (contentEl.length > 0 ? (contentEl.html() || contentEl.text()) : "").trim();
      const summaryHtml = (summaryEl.length > 0 ? (summaryEl.html() || summaryEl.text()) : "").trim();

      items.push({
        title: $el.find("title").first().text().trim(),
        link,
        pubDate: parseDate(
          $el.find("published").text() ||
          $el.find("updated").text()
        ),
        description: summaryHtml || contentHtml || "",
        content: contentHtml || summaryHtml || "",
      });
    });
  }

  return items.sort((a, b) => b.pubDate - a.pubDate);
}

export async function POST(request: Request) {
  const { feedId, userId } = await request.json();

  if (!feedId || !userId) {
    return Response.json({ error: "feedId and userId required" }, { status: 400 });
  }

  const data = await adminDb.query({
    feeds: { $: { where: { id: feedId } } },
  });

  const feed = data?.feeds?.[0] as Record<string, unknown> | undefined;
  if (!feed || feed.userId !== userId) {
    return Response.json({ error: "Feed not found" }, { status: 404 });
  }

  try {
    const response = await fetch(feed.feedUrl as string, {
      headers: {
        "User-Agent": "WatchTower/1.0 RSS Reader",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      },
    });
    const xml = await response.text();
    const items = parseFeed(xml);

    // Get existing items to avoid duplicates
    const existingData = await adminDb.query({
      feedItems: { $: { where: { feedId } } },
    });
    const existingLinks = new Set(
      (existingData?.feedItems || []).map((i: Record<string, unknown>) => i.link)
    );

    // Insert new items — only metadata, no content (fetched on demand)
    let added = 0;
    for (const item of items.slice(0, 50)) {
      if (existingLinks.has(item.link)) continue;
      const itemId = instantId();
      await adminDb.transact(
        adminDb.tx.feedItems[itemId].update({
          feedId,
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          read: false,
          addedAt: Date.now(),
        })
      );
      added++;
    }

    await adminDb.transact(
      adminDb.tx.feeds[feedId].update({
        lastFetch: Date.now(),
        itemCount: (existingData?.feedItems?.length || 0) + added,
      })
    );

    return Response.json({ fetched: items.length, added });
  } catch {
    return Response.json({ error: "Failed to fetch feed" }, { status: 500 });
  }
}
