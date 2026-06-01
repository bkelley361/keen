export interface YouTubeResult {
  title: string;
  videoId: string;
  videoUrl: string;
  contentType: "video" | "short" | "post";
}

export interface YouTubeCheckResult {
  video: YouTubeResult | null;
  short: YouTubeResult | null;
  post: YouTubeResult | null;
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

async function checkFeed(channelId: string): Promise<YouTubeResult | null> {
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

async function checkShorts(channelId: string): Promise<YouTubeResult | null> {
  try {
    const shortsUrl = `https://www.youtube.com/channel/${channelId}/shorts`;
    const response = await fetch(shortsUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const html = await response.text();

    const idMatch =
      html.match(/"shortsLockupViewModel"[\s\S]*?"videoId":"([a-zA-Z0-9_-]{11})"/) ||
      html.match(/"reelWatchEndpoint":\{"videoId":"([a-zA-Z0-9_-]{11})"/) ||
      html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (!idMatch) return null;
    const videoId = idMatch[1];

    const headlineMatch =
      html.match(new RegExp(`"videoId":"${videoId}"[\\s\\S]{0,800}?"headline":\\{"simpleText":"((?:\\\\.|[^"\\\\])*)"`)) ||
      html.match(new RegExp(`"videoId":"${videoId}"[\\s\\S]{0,800}?"accessibilityText":"((?:\\\\.|[^"\\\\])*)"`));
    const title = headlineMatch ? sanitizeTitle(headlineMatch[1], "Hidden or unavailable short") : "Hidden or unavailable short";

    return { title, videoId, videoUrl: `https://www.youtube.com/shorts/${videoId}`, contentType: "short" };
  } catch {
    return null;
  }
}

async function checkPosts(channelId: string): Promise<YouTubeResult | null> {
  try {
    const communityUrl = `https://www.youtube.com/channel/${channelId}/community`;
    const response = await fetch(communityUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const html = await response.text();

    const idMatch = html.match(/"postId":"([a-zA-Z0-9_-]+)"/);
    if (!idMatch) return null;
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

    return { title, videoId: postId, videoUrl: `https://www.youtube.com/post/${postId}`, contentType: "post" };
  } catch {
    return null;
  }
}

export async function checkYouTube(url: string): Promise<YouTubeCheckResult | null> {
  try {
    const channelId = await resolveChannelId(url);
    if (!channelId) return null;

    const [video, short, post] = await Promise.all([
      checkFeed(channelId),
      checkShorts(channelId),
      checkPosts(channelId),
    ]);

    return { video, short, post };
  } catch (error) {
    console.error(`[youtube] Failed to check ${url}:`, error);
    return null;
  }
}
