import { checkYouTube } from "./youtube";
import { scrapeWebpage } from "./webpage";

export type CostClass = "low" | "medium" | "high";

export interface MonitorCheckResult {
  value: string | null;
  error?: string;
  costClass: CostClass;
  notificationUrl?: string;
  ytExtras?: {
    lastShortId?: string;
    lastShortTitle?: string;
    lastPostId?: string;
    lastPostText?: string;
  };
  ytExtraEvents?: Array<{
    kind: "short" | "post";
    oldValue: string;
    newValue: string;
    itemUrl: string;
  }>;
}

export interface MonitorData {
  id: string;
  type: string;
  url: string;
  selector?: string;
  clickSelector?: string;
  lastValue?: string;
  lastShortId?: string;
  lastShortTitle?: string;
  lastPostId?: string;
  lastPostText?: string;
}

export async function runMonitorCheck(monitor: MonitorData): Promise<MonitorCheckResult> {
  if (monitor.type === "youtube") {
    const result = await checkYouTube(monitor.url);
    if (!result) {
      return { value: null, error: "YouTube check failed", costClass: "low" };
    }

    const ytExtras: MonitorCheckResult["ytExtras"] = {};
    const ytExtraEvents: MonitorCheckResult["ytExtraEvents"] = [];
    let notificationUrl = monitor.url;

    let value: string | null = null;
    if (result.video) {
      value = `${result.video.title} (${result.video.videoId})`;
      notificationUrl = result.video.videoUrl;
    }

    if (result.short) {
      ytExtras.lastShortId = result.short.videoId;
      ytExtras.lastShortTitle = result.short.title;
      if (monitor.lastShortId && monitor.lastShortId !== result.short.videoId) {
        ytExtraEvents.push({
          kind: "short",
          oldValue: monitor.lastShortTitle || monitor.lastShortId || "",
          newValue: `${result.short.title} (${result.short.videoId})`,
          itemUrl: result.short.videoUrl,
        });
      }
    }

    if (result.post) {
      ytExtras.lastPostId = result.post.videoId;
      ytExtras.lastPostText = result.post.title;
      if (monitor.lastPostId && monitor.lastPostId !== result.post.videoId) {
        ytExtraEvents.push({
          kind: "post",
          oldValue: monitor.lastPostText || monitor.lastPostId || "",
          newValue: result.post.title,
          itemUrl: result.post.videoUrl,
        });
      }
    }

    return { value, costClass: "low", notificationUrl, ytExtras, ytExtraEvents };
  }

  if (monitor.type === "webpage") {
    const costClass = monitor.clickSelector ? "high" : "medium";
    const result = await scrapeWebpage(monitor.url, monitor.selector || "");
    return { value: result.value, costClass, error: result.value === null ? "Scrape failed" : undefined };
  }

  return { value: null, error: `Unknown monitor type: ${monitor.type}`, costClass: "medium" };
}

// Lower number = higher BullMQ priority
export function getCostClassPriority(costClass?: string): number {
  if (costClass === "low") return 1;
  if (costClass === "medium") return 5;
  if (costClass === "high") return 10;
  return 5;
}

export function detectCostClass(type: string, clickSelector?: string): CostClass {
  if (type === "rss" || type === "youtube") return "low";
  if (clickSelector) return "high";
  return "medium";
}
