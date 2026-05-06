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

function decodeJsonString(s: string): string {
  try {
    return JSON.parse(`"${s}"`);
  } catch {
    return s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }
}

function looksLikeJsonGarbage(s: string): boolean {
  return /"(navigationEndpoint|clickTrackingParams|commandMetadata|webCommandMetadata|browseEndpoint|webPageType|apiUrl)"/.test(s);
}

function sanitizeTitle(raw: string, fallback: string): string {
  const decoded = decodeJsonString(raw).replace(/\s*-\s*play Short$/i, "").trim();
  if (!decoded || looksLikeJsonGarbage(decoded)) return fallback;
  return decoded;
}

async function resolveChannelId(url: string): Promise<string | null> {
  console.log(`[yt] resolveChannelId: ${url}`);
  const channelMatch = url.match(/youtube\.com\/channel\/([a-zA-Z0-9_-]+)/);
  if (channelMatch) {
    console.log(`[yt] resolved from /channel/ path: ${channelMatch[1]}`);
    return channelMatch[1];
  }

  const handleMatch = url.match(/youtube\.com\/@([a-zA-Z0-9_-]+)/);
  if (!handleMatch) {
    console.log(`[yt] no channel or handle match in url`);
    return null;
  }

  console.log(`[yt] fetching handle page to resolve channelId for @${handleMatch[1]}`);
  const pageResponse = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  const pageHtml = await pageResponse.text();
  console.log(`[yt] handle page status=${pageResponse.status} bytes=${pageHtml.length}`);
  const channelIdMatch = pageHtml.match(/"externalId":"(UC[a-zA-Z0-9_-]+)"/);
  console.log(`[yt] resolved channelId: ${channelIdMatch ? channelIdMatch[1] : "null"}`);
  return channelIdMatch ? channelIdMatch[1] : null;
}

async function checkYouTubeFeed(channelId: string): Promise<YouTubeResult | null> {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  console.log(`[yt] feed fetch: ${feedUrl}`);
  const response = await fetch(feedUrl);
  const xml = await response.text();
  console.log(`[yt] feed status=${response.status} bytes=${xml.length}`);

  const titleMatch = xml.match(/<entry>[\s\S]*?<title>(.*?)<\/title>/);
  const videoIdMatch = xml.match(/<yt:videoId>(.*?)<\/yt:videoId>/);

  if (!titleMatch || !videoIdMatch) {
    console.log(`[yt] feed no match (title=${!!titleMatch}, videoId=${!!videoIdMatch})`);
    return null;
  }

  console.log(`[yt] feed found: "${titleMatch[1]}" (${videoIdMatch[1]})`);
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
    console.log(`[yt] shorts fetch: ${shortsUrl}`);
    const response = await fetch(shortsUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const html = await response.text();
    console.log(`[yt] shorts status=${response.status} bytes=${html.length}`);

    const idMatch = html.match(/"shortsLockupViewModel"[\s\S]*?"videoId":"([a-zA-Z0-9_-]{11})"/)
      || html.match(/"reelWatchEndpoint":\{"videoId":"([a-zA-Z0-9_-]{11})"/)
      || html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (!idMatch) {
      console.log(`[yt] shorts no videoId`);
      return null;
    }
    const videoId = idMatch[1];

    const headlineMatch = html.match(new RegExp(`"videoId":"${videoId}"[\\s\\S]{0,800}?"headline":\\{"simpleText":"((?:\\\\.|[^"\\\\])*)"`))
      || html.match(new RegExp(`"videoId":"${videoId}"[\\s\\S]{0,800}?"accessibilityText":"((?:\\\\.|[^"\\\\])*)"`));
    const title = headlineMatch
      ? sanitizeTitle(headlineMatch[1], "Hidden or unavailable short")
      : "Hidden or unavailable short";

    console.log(`[yt] shorts found: "${title}" (${videoId})`);
    return {
      title,
      videoId,
      videoUrl: `https://www.youtube.com/shorts/${videoId}`,
      contentType: "short",
    };
  } catch (error) {
    console.error(`[yt] shorts error:`, error);
    return null;
  }
}

async function checkYouTubePosts(channelId: string): Promise<YouTubeResult | null> {
  try {
    const communityUrl = `https://www.youtube.com/channel/${channelId}/community`;
    console.log(`[yt] posts fetch: ${communityUrl}`);
    const response = await fetch(communityUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const html = await response.text();
    console.log(`[yt] posts status=${response.status} bytes=${html.length}`);

    const idMatch = html.match(/"postId":"([a-zA-Z0-9_-]+)"/);
    if (!idMatch) {
      console.log(`[yt] posts no postId`);
      return null;
    }
    const postId = idMatch[1];

    const textRunsMatch = html.match(new RegExp(`"postId":"${postId}"[\\s\\S]{0,2000}?"contentText":\\{"runs":\\[([\\s\\S]*?)\\]\\}`));
    let title = "Hidden or unavailable post";
    if (textRunsMatch) {
      const runs = Array.from(textRunsMatch[1].matchAll(/"text":"((?:\\.|[^"\\])*)"/g));
      const joined = runs.map((r) => decodeJsonString(r[1])).join("").trim();
      if (joined && !looksLikeJsonGarbage(joined)) {
        title = joined.slice(0, 280);
      }
    }

    console.log(`[yt] posts found: "${title}" (${postId})`);
    return {
      title,
      videoId: postId,
      videoUrl: `https://www.youtube.com/post/${postId}`,
      contentType: "post",
    };
  } catch (error) {
    console.error(`[yt] posts error:`, error);
    return null;
  }
}

interface YouTubeCheckResult {
  video: YouTubeResult | null;
  short: YouTubeResult | null;
  post: YouTubeResult | null;
}

async function checkYouTube(url: string): Promise<YouTubeCheckResult | null> {
  try {
    console.log(`[yt] checkYouTube start: ${url}`);
    const channelId = await resolveChannelId(url);
    if (!channelId) {
      console.log(`[yt] checkYouTube aborted: no channelId`);
      return null;
    }

    const [video, short, post] = await Promise.all([
      checkYouTubeFeed(channelId),
      checkYouTubeShorts(channelId),
      checkYouTubePosts(channelId),
    ]);

    console.log(`[yt] checkYouTube results: video=${!!video} short=${!!short} post=${!!post}`);
    return { video, short, post };
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
      lastShortId?: string;
      lastShortTitle?: string;
      lastPostId?: string;
      lastPostText?: string;
    };

    let newValue: string | null = null;
    let notificationUrl = m.url;
    const ytExtras: {
      lastShortId?: string;
      lastShortTitle?: string;
      lastPostId?: string;
      lastPostText?: string;
    } = {};

    const extraNotifs: { kind: "short" | "post"; oldValue: string; newValue: string; itemUrl: string }[] = [];

    if (m.type === "webpage") {
      const result = await scrapeWebpage(m.url, m.selector || "", m.clickSelector || undefined);
      newValue = result.value;
      if (result.debug.length) {
        console.log(`[cron] Monitor "${m.name}" debug:`, result.debug);
      }
    } else if (m.type === "youtube") {
      const ytResult = await checkYouTube(m.url);
      if (ytResult) {
        if (ytResult.video) {
          newValue = `${ytResult.video.title} (${ytResult.video.videoId})`;
          notificationUrl = ytResult.video.videoUrl;
        }
        if (ytResult.short) {
          ytExtras.lastShortId = ytResult.short.videoId;
          ytExtras.lastShortTitle = ytResult.short.title;
          if (m.lastShortId && m.lastShortId !== ytResult.short.videoId) {
            extraNotifs.push({
              kind: "short",
              oldValue: m.lastShortTitle || m.lastShortId || "",
              newValue: `${ytResult.short.title} (${ytResult.short.videoId})`,
              itemUrl: ytResult.short.videoUrl,
            });
          }
        }
        if (ytResult.post) {
          ytExtras.lastPostId = ytResult.post.videoId;
          ytExtras.lastPostText = ytResult.post.title;
          if (m.lastPostId && m.lastPostId !== ytResult.post.videoId) {
            extraNotifs.push({
              kind: "post",
              oldValue: m.lastPostText || m.lastPostId || "",
              newValue: ytResult.post.title,
              itemUrl: ytResult.post.videoUrl,
            });
          }
        }
      }
    }

    for (const n of extraNotifs) {
      const notifId = instantId();
      await adminDb.transact(
        adminDb.tx.notifications[notifId].update({
          monitorId: m.id,
          oldValue: n.oldValue,
          newValue: n.newValue,
          sentAt: Date.now(),
          kind: n.kind,
          itemUrl: n.itemUrl,
        })
      );
    }

    if (newValue === null) {
      results.push({ id: m.id, changed: false, error: "Failed to fetch" });
      await adminDb.transact(
        adminDb.tx.monitors[m.id].update({ lastChecked: Date.now(), lastStatus: "error", ...ytExtras })
      );
      continue;
    }

    const changed = m.lastValue !== "" && m.lastValue !== newValue;

    await adminDb.transact(
      adminDb.tx.monitors[m.id].update({
        lastValue: newValue,
        lastChecked: Date.now(),
        lastStatus: changed ? "changed" : "ok",
        ...ytExtras,
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

      const notifId = instantId();
      await adminDb.transact(
        adminDb.tx.notifications[notifId].update({
          monitorId: m.id,
          oldValue: m.lastValue || "",
          newValue,
          sentAt: Date.now(),
          kind: m.type === "youtube" ? "video" : "webpage",
          itemUrl: notificationUrl,
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
