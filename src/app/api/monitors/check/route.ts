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
  const body = await request.json();
  const { monitorId, userId } = body;

  if (!monitorId || !userId) {
    return Response.json({ error: "Missing monitorId or userId" }, { status: 400 });
  }

  const data = await adminDb.query({
    monitors: { $: { where: { id: monitorId } } },
  });

  const monitor = data?.monitors?.[0] as {
    id: string;
    userId: string;
    name: string;
    type: string;
    url: string;
    selector?: string;
    clickSelector?: string;
    lastValue?: string;
  } | undefined;

  if (!monitor) {
    return Response.json({ error: "Monitor not found" }, { status: 404 });
  }

  if (monitor.userId !== userId) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  let newValue: string | null = null;
  let notificationUrl = monitor.url;
  let debug: string[] = [];

  if (monitor.type === "webpage") {
    const result = await scrapeWebpage(monitor.url, monitor.selector || "", monitor.clickSelector || undefined);
    newValue = result.value;
    debug = result.debug;
    console.log(`[check] Monitor "${monitor.name}" debug:`, debug);
  } else if (monitor.type === "youtube") {
    const ytResult = await checkYouTube(monitor.url);
    if (ytResult) {
      newValue = `${ytResult.title} (${ytResult.videoId})`;
      notificationUrl = ytResult.videoUrl;
      debug.push(`[youtube] Found: ${newValue}`);
    } else {
      debug.push("[youtube] No result returned");
    }
  }

  if (newValue === null) {
    await adminDb.transact(
      adminDb.tx.monitors[monitor.id].update({ lastChecked: Date.now(), lastStatus: "error" })
    );
    return Response.json({ error: "Failed to fetch value", checked: true, changed: false, debug }, { status: 200 });
  }

  const changed = monitor.lastValue !== "" && monitor.lastValue !== newValue;

  await adminDb.transact(
    adminDb.tx.monitors[monitor.id].update({
      lastValue: newValue,
      lastChecked: Date.now(),
      lastStatus: changed ? "changed" : "ok",
    })
  );

  if (changed) {
    try {
      const userData = await adminDb.auth.getUser({ id: monitor.userId });
      const userEmail = userData?.email;

      if (userEmail) {
        await sendChangeNotification({
          to: userEmail,
          monitorName: monitor.name,
          monitorUrl: notificationUrl,
          oldValue: monitor.lastValue || "",
          newValue,
          type: monitor.type as "webpage" | "youtube",
        });
      }
    } catch (error) {
      console.error(`Failed to send notification for monitor ${monitor.id}:`, error);
    }

    const notifId = instantId();
    await adminDb.transact(
      adminDb.tx.notifications[notifId].update({
        monitorId: monitor.id,
        oldValue: monitor.lastValue || "",
        newValue,
        sentAt: Date.now(),
      })
    );
  }

  return Response.json({
    checked: true,
    changed,
    newValue,
    debug,
  });
}
