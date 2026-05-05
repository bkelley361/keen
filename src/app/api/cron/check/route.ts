import { adminDb } from "@/lib/instant-admin";
import { sendChangeNotification } from "@/lib/email";
import { scrapeWebpage } from "@/lib/scraper";
import { id as instantId } from "@instantdb/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface YouTubeResult {
  title: string;
  videoId: string;
  videoUrl: string;
  contentType: "video" | "short" | "post";
}

async function resolveChannelId(url: string): Promise<string | null> {
  const channelMatch = url.match(/youtube\.com\/channel\/([a-zA-Z0-9_-]+)/);
  if (channelMatch) return channelMatch[1];

  const handleMatch = url.match(/youtube\.com\/@([a-zA-Z0-9_-]+)/);
  if (!handleMatch) return null;

  const pageResponse = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  const pageHtml = await pageResponse.text();
  const channelIdMatch = pageHtml.match(/"externalId":"(UC[a-zA-Z0-9_-]+)"/);
  return channelIdMatch ? channelIdMatch[1] : null;
}

async function checkYouTubeFeed(channelId: string): Promise<YouTubeResult | null> {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const response = await fetch(feedUrl);
  const xml = await response.text();

  const titleMatch = xml.match(/<entry>[\s\S]*?<title>(.*?)<\/title>/);
  const videoIdMatch = xml.match(/<yt:videoId>(.*?)<\/yt:videoId>/);

  if (!titleMatch || !videoIdMatch) return null;

  return {
    title: titleMatch[1],
    videoId: videoIdMatch[1],
    videoUrl: `https://www.youtube.com/watch?v=${videoIdMatch[1]}`,
    contentType: "video",
  };
}

async function checkYouTubeShorts(channelId: string): Promise<YouTubeResult | null> {
  try {
    const shortsUrl = `https://www.youtube.com/channel/${channelId}/shorts`;
    const response = await fetch(shortsUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const html = await response.text();

    const shortMatch = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"[\s\S]*?"title":\{"runs":\[\{"text":"(.*?)"\}/);
    if (!shortMatch) return null;

    return {
      title: shortMatch[2],
      videoId: shortMatch[1],
      videoUrl: `https://www.youtube.com/shorts/${shortMatch[1]}`,
      contentType: "short",
    };
  } catch {
    return null;
  }
}

async function checkYouTubePosts(channelId: string): Promise<YouTubeResult | null> {
  try {
    const communityUrl = `https://www.youtube.com/channel/${channelId}/community`;
    const response = await fetch(communityUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const html = await response.text();

    const postMatch = html.match(/"postId":"([a-zA-Z0-9_-]+)"[\s\S]*?"text":"(.*?)"/);
    if (!postMatch) return null;

    return {
      title: postMatch[2].slice(0, 100),
      videoId: postMatch[1],
      videoUrl: `https://www.youtube.com/post/${postMatch[1]}`,
      contentType: "post",
    };
  } catch {
    return null;
  }
}

async function checkYouTube(url: string): Promise<YouTubeResult | null> {
  try {
    const channelId = await resolveChannelId(url);
    if (!channelId) return null;

    const [feedResult, shortsResult, postsResult] = await Promise.all([
      checkYouTubeFeed(channelId),
      checkYouTubeShorts(channelId),
      checkYouTubePosts(channelId),
    ]);

    const results = [feedResult, shortsResult, postsResult].filter(
      (r): r is YouTubeResult => r !== null
    );

    if (results.length === 0) return null;

    return results[0];
  } catch (error) {
    console.error(`Failed to check YouTube for ${url}:`, error);
    return null;
  }
}

export async function POST(request: Request) {
  // Verify cron secret
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await adminDb.query({
    monitors: { $: { where: { active: true } } },
  });

  const monitors = data?.monitors || [];
  const results: { id: string; changed: boolean; error?: string }[] = [];

  for (const monitor of monitors) {
    const m = monitor as {
      id: string;
      userId: string;
      name: string;
      type: string;
      url: string;
      selector?: string;
      clickSelector?: string;
      lastValue?: string;
    };

    let newValue: string | null = null;
    let notificationUrl = m.url;

    if (m.type === "webpage") {
      const result = await scrapeWebpage(m.url, m.selector || "", m.clickSelector || undefined);
      newValue = result.value;
      if (result.debug.length) {
        console.log(`[cron] Monitor "${m.name}" debug:`, result.debug);
      }
    } else if (m.type === "youtube") {
      const ytResult = await checkYouTube(m.url);
      if (ytResult) {
        newValue = `${ytResult.title} (${ytResult.videoId})`;
        notificationUrl = ytResult.videoUrl;
      }
    }

    if (newValue === null) {
      results.push({ id: m.id, changed: false, error: "Failed to fetch" });
      await adminDb.transact(
        adminDb.tx.monitors[m.id].update({ lastChecked: Date.now(), lastStatus: "error" })
      );
      continue;
    }

    const changed = m.lastValue !== "" && m.lastValue !== newValue;

    await adminDb.transact(
      adminDb.tx.monitors[m.id].update({
        lastValue: newValue,
        lastChecked: Date.now(),
        lastStatus: changed ? "changed" : "ok",
      })
    );

    if (changed) {
      // Get user email for notification
      try {
        const userData = await adminDb.auth.getUser({ id: m.userId });
        const userEmail = userData?.email;

        if (userEmail) {
          await sendChangeNotification({
            to: userEmail,
            monitorName: m.name,
            monitorUrl: notificationUrl,
            oldValue: m.lastValue || "",
            newValue,
            type: m.type as "webpage" | "youtube",
          });
        }
      } catch (error) {
        console.error(`Failed to send notification for monitor ${m.id}:`, error);
      }

      // Create notification record
      const notifId = instantId();
      await adminDb.transact(
        adminDb.tx.notifications[notifId].update({
          monitorId: m.id,
          oldValue: m.lastValue || "",
          newValue,
          sentAt: Date.now(),
        })
      );
    }

    results.push({ id: m.id, changed });
  }

  // Also refresh RSS feeds
  const feedData = await adminDb.query({
    feeds: { $: { where: { active: true } } },
  });
  const feeds = feedData?.feeds || [];
  let feedsRefreshed = 0;

  for (const feed of feeds) {
    const f = feed as { id: string; userId: string; feedUrl: string };
    try {
      const response = await fetch(f.feedUrl, {
        headers: {
          "User-Agent": "WatchTower/1.0 RSS Reader",
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
        },
      });
      const xml = await response.text();
      const { load } = await import("cheerio");
      const $ = load(xml, { xml: true });

      const items: { title: string; link: string; pubDate: number; description: string }[] = [];
      $("item").each((_, el) => {
        items.push({
          title: $(el).find("title").first().text().trim(),
          link: $(el).find("link").first().text().trim() || $(el).find("link").attr("href") || "",
          pubDate: new Date($(el).find("pubDate").text() || $(el).find("dc\\:date").text() || Date.now()).getTime(),
          description: $(el).find("description").first().text().trim() || $(el).find("content\\:encoded").first().text().trim() || "",
        });
      });
      if (items.length === 0) {
        $("entry").each((_, el) => {
          items.push({
            title: $(el).find("title").first().text().trim(),
            link: $(el).find("link[rel='alternate']").attr("href") || $(el).find("link").attr("href") || "",
            pubDate: new Date($(el).find("published").text() || $(el).find("updated").text() || Date.now()).getTime(),
            description: $(el).find("summary").first().text().trim() || $(el).find("content").first().text().trim() || "",
          });
        });
      }

      const existingData = await adminDb.query({
        feedItems: { $: { where: { feedId: f.id } } },
      });
      const existingLinks = new Set(
        (existingData?.feedItems || []).map((i: Record<string, unknown>) => i.link)
      );

      for (const item of items.slice(0, 20)) {
        if (existingLinks.has(item.link)) continue;
        const itemId = instantId();
        await adminDb.transact(
          adminDb.tx.feedItems[itemId].update({
            feedId: f.id,
            title: item.title,
            link: item.link,
            pubDate: item.pubDate,
            description: item.description,
            read: false,
            addedAt: Date.now(),
          })
        );
      }

      await adminDb.transact(
        adminDb.tx.feeds[f.id].update({ lastFetch: Date.now() })
      );
      feedsRefreshed++;
    } catch (error) {
      console.error(`Failed to refresh feed ${f.id}:`, error);
    }
  }

  return Response.json({
    checked: monitors.length,
    results,
    feedsRefreshed,
    timestamp: new Date().toISOString(),
  });
}

// Also support GET for easy testing
export async function GET(request: Request) {
  const cronSecret = request.headers.get("x-cron-secret") ||
    new URL(request.url).searchParams.get("secret");

  if (cronSecret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Delegate to POST handler
  return POST(request);
}
