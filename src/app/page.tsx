"use client";

import { db, tx } from "@/lib/instant";
import { Navbar } from "@/components/navbar";
import { ActivityFeed } from "@/components/activity-feed";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Trash2, Pencil, History, RefreshCw, Bell, Activity, ExternalLink, Pause, Play, TrendingUp, Copy } from "lucide-react";

interface MonitorData {
  id: string;
  name: string;
  type: string;
  url: string;
  selector?: string;
  lastValue?: string | { value: string; debug?: string[] };
  lastChecked?: number;
  lastStatus?: "ok" | "changed" | "error";
  active: boolean;
  lastShortId?: string;
  lastShortTitle?: string;
  lastPostId?: string;
  lastPostText?: string;
  seenShortId?: string;
  seenPostId?: string;
}

function resolveLastValue(raw: MonitorData["lastValue"]): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === "string") return raw;
  return raw.value;
}

interface NotificationData {
  id: string;
  oldValue?: string;
  newValue?: string;
  sentAt?: number;
}

function timeAgo(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function extractVideoId(lastValue: string): string | null {
  const match = lastValue.match(/\(([a-zA-Z0-9_-]{11})\)$/);
  return match ? match[1] : null;
}

function extractVideoTitle(lastValue: string): string {
  return lastValue.replace(/\s*\([a-zA-Z0-9_-]{11}\)$/, "");
}

function MonitorCard({ monitor, userId }: { monitor: MonitorData; userId: string }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [checking, setChecking] = useState(false);

  const hasNewShort = !!monitor.lastShortId && monitor.lastShortId !== monitor.seenShortId;
  const hasNewPost = !!monitor.lastPostId && monitor.lastPostId !== monitor.seenPostId;
  const hasExtras = !!monitor.lastShortId || !!monitor.lastPostId;
  const hasUnseenExtras = hasNewShort || hasNewPost;

  function openExtras(open: boolean) {
    setExtrasOpen(open);
    if (open && hasUnseenExtras) {
      const updates: { seenShortId?: string; seenPostId?: string } = {};
      if (monitor.lastShortId) updates.seenShortId = monitor.lastShortId;
      if (monitor.lastPostId) updates.seenPostId = monitor.lastPostId;
      db.transact(tx.monitors[monitor.id].update(updates));
    }
  }

  const { data } = db.useQuery({
    notifications: {
      $: {
        where: { monitorId: monitor.id },
        order: { serverCreatedAt: "desc" },
        limit: 20,
      },
    },
  });

  const notifications = data?.notifications || [];

  function toggleActive() {
    db.transact(tx.monitors[monitor.id].update({ active: !monitor.active }));
  }

  function deleteMonitor() {
    db.transact(tx.monitors[monitor.id].delete());
    setDeleteOpen(false);
  }

  async function checkNow() {
    setChecking(true);
    try {
      const res = await fetch("/api/monitors/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monitorId: monitor.id, userId }),
      });
      const result = await res.json();
      if (result.debug?.length) {
        console.group(`[Keen] Check: ${monitor.name}`);
        result.debug.forEach((line: string) => console.log(line));
        console.groupEnd();
      }
      if (result.changed) {
        toast.success(`Change detected! New value: ${result.newValue}`);
      } else if (result.error) {
        toast.error(result.error);
      } else {
        toast.info(`No changes. Value: ${result.newValue}`);
      }
    } catch {
      toast.error("Failed to check monitor");
    } finally {
      setChecking(false);
    }
  }

  const lastValue = resolveLastValue(monitor.lastValue);

  function markExtrasRead() {
    const updates: { seenShortId?: string; seenPostId?: string } = {};
    if (monitor.lastShortId) updates.seenShortId = monitor.lastShortId;
    if (monitor.lastPostId) updates.seenPostId = monitor.lastPostId;
    if (Object.keys(updates).length) {
      db.transact(tx.monitors[monitor.id].update(updates));
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <Card className={`transition-all hover:border-primary/60 ${monitor.type === "youtube" ? "row-span-2" : ""}`} />
        }
      >
      <CardHeader className="p-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                  !monitor.lastChecked
                    ? "bg-muted-foreground/40"
                    : monitor.lastStatus === "error"
                    ? "bg-red-500"
                    : monitor.lastStatus === "changed"
                    ? "bg-amber-500"
                    : "bg-green-500"
                }`}
                title={
                  !monitor.lastChecked
                    ? "Not checked yet"
                    : monitor.lastStatus === "error"
                    ? "Last check failed"
                    : monitor.lastStatus === "changed"
                    ? "Change detected"
                    : "OK"
                }
              />
              <CardTitle className="text-sm font-semibold truncate">
                {monitor.name}
              </CardTitle>
            </div>
            <CardDescription className="text-xs mt-0.5 flex items-center gap-1.5">
              <Badge
                variant={monitor.type === "youtube" ? "default" : "secondary"}
                className="text-[10px] px-1.5 py-0"
              >
                {monitor.type === "youtube" ? "YT" : "Web"}
              </Badge>
              <a
                href={monitor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline truncate"
              >
                {new URL(monitor.url).hostname.replace(/^www\./, "")}
              </a>
            </CardDescription>
          </div>
          <Switch checked={monitor.active} onCheckedChange={toggleActive} className="shrink-0 scale-75" />
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="space-y-2">
          {monitor.type === "youtube" && lastValue ? (
            <div>
              {extractVideoId(lastValue) ? (
                <a
                  href={`https://www.youtube.com/watch?v=${extractVideoId(lastValue)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <div className="relative aspect-video overflow-hidden border border-border/50">
                    <Image
                      src={`https://i.ytimg.com/vi/${extractVideoId(lastValue)}/mqdefault.jpg`}
                      alt={extractVideoTitle(lastValue)}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                  <p className="text-xs font-medium mt-1 line-clamp-1 group-hover:text-primary transition-colors">
                    {extractVideoTitle(lastValue)}
                  </p>
                </a>
              ) : (
                <p className="text-xs font-mono bg-muted/50 border border-border/50 px-2 py-1 rounded truncate">
                  {lastValue}
                </p>
              )}
            </div>
          ) : monitor.type === "webpage" ? (
            <p className="text-sm font-bold font-mono truncate">
              {lastValue || "Not checked yet"}
            </p>
          ) : (
            <p className="text-xs font-mono bg-muted/50 border border-border/50 px-2 py-1 rounded truncate">
              {lastValue || "Not checked yet"}
            </p>
          )}
          <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
            <p className="text-[11px] text-muted-foreground">
              {monitor.lastChecked
                ? timeAgo(monitor.lastChecked)
                : "Never"}
            </p>
            <div className="flex gap-0.5">
              <Button
                variant="outline"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={checkNow}
                disabled={checking}
              >
                <RefreshCw className={`h-3 w-3 ${checking ? "animate-spin" : ""}`} />
              </Button>
              {monitor.type === "youtube" && hasExtras && (
                <Dialog open={extrasOpen} onOpenChange={openExtras}>
                  <DialogTrigger
                    render={<Button variant="ghost" size="sm" className="h-6 w-6 p-0 relative" />}
                  >
                    <Bell className="h-3 w-3" />
                    {hasUnseenExtras && (
                      <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
                    )}
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Shorts & Community Posts</DialogTitle>
                      <DialogDescription>{monitor.name}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5">
                      <section className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Latest Short
                          </h3>
                          {hasNewShort && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0">New</Badge>
                          )}
                        </div>
                        {monitor.lastShortId ? (
                          <a
                            href={`https://www.youtube.com/shorts/${monitor.lastShortId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex gap-3 border border-border/60 p-2.5 hover:border-primary/40 hover:bg-muted/40 transition-colors"
                          >
                            <div className="relative h-24 w-[72px] shrink-0 overflow-hidden bg-muted">
                              <Image
                                src={`https://i.ytimg.com/vi/${monitor.lastShortId}/hqdefault.jpg`}
                                alt={monitor.lastShortTitle || "Short"}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
                              <p className="text-sm font-medium line-clamp-3 break-words">
                                {monitor.lastShortTitle || monitor.lastShortId}
                              </p>
                              <p className="text-[11px] text-muted-foreground font-mono truncate">
                                {monitor.lastShortId}
                              </p>
                            </div>
                          </a>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">None detected yet.</p>
                        )}
                      </section>

                      <section className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Latest Community Post
                          </h3>
                          {hasNewPost && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0">New</Badge>
                          )}
                        </div>
                        {monitor.lastPostId ? (
                          <a
                            href={`https://www.youtube.com/post/${monitor.lastPostId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block border border-border/60 p-3 hover:border-primary/40 hover:bg-muted/40 transition-colors"
                          >
                            <p className="text-sm whitespace-pre-wrap break-words line-clamp-6">
                              {monitor.lastPostText || monitor.lastPostId}
                            </p>
                          </a>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">None detected yet.</p>
                        )}
                      </section>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </div>
      </CardContent>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => window.open(monitor.url, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink className="h-4 w-4" />
          Open URL
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            navigator.clipboard.writeText(monitor.url);
            toast.success("URL copied");
          }}
        >
          <Copy className="h-4 w-4" />
          Copy URL
        </ContextMenuItem>
        {monitor.type === "youtube" && (() => {
          const vid = lastValue ? extractVideoId(lastValue) : null;
          if (!vid) return null;
          const videoUrl = `https://www.youtube.com/watch?v=${vid}`;
          return (
            <ContextMenuItem
              onClick={() => {
                navigator.clipboard.writeText(videoUrl);
                toast.success("Video URL copied");
              }}
            >
              <Copy className="h-4 w-4" />
              Copy latest video URL
            </ContextMenuItem>
          );
        })()}
        <ContextMenuItem onClick={checkNow} disabled={checking}>
          <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
          Check now
        </ContextMenuItem>
        <ContextMenuItem onClick={toggleActive}>
          {monitor.active ? (
            <>
              <Pause className="h-4 w-4" />
              Pause
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Resume
            </>
          )}
        </ContextMenuItem>
        {monitor.type === "youtube" && hasUnseenExtras && (
          <ContextMenuItem onClick={markExtrasRead}>
            <Bell className="h-4 w-4" />
            Mark shorts/posts read
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          render={<Link href={`/monitors/edit?id=${monitor.id}`} />}
        >
          <Pencil className="h-4 w-4" />
          Edit
        </ContextMenuItem>
        <ContextMenuItem onClick={() => setDetailOpen(true)}>
          <History className="h-4 w-4" />
          History
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => setDeleteOpen(true)}
          className="text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change History</DialogTitle>
            <DialogDescription>{monitor.name}</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-3">
            {notifications.length === 0 ? (
              <p className="text-base text-muted-foreground py-6 text-center">
                No changes detected yet
              </p>
            ) : (
              (notifications as unknown as NotificationData[]).map((n) => (
                <div
                  key={n.id}
                  className="border border-border p-4 space-y-2"
                >
                  <p className="text-sm text-muted-foreground">
                    {n.sentAt
                      ? new Date(n.sentAt).toLocaleString()
                      : "Unknown"}
                  </p>
                  <div className="text-base [overflow-wrap:anywhere]">
                    <span className="text-red-400 line-through">
                      {n.oldValue || "(empty)"}
                    </span>
                    {" → "}
                    <span className="text-green-400 font-medium">
                      {n.newValue}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete monitor?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{monitor.name}&quot; and all
              its notification history.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteMonitor}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ContextMenu>
  );
}

interface FeedData {
  id: string;
  name: string;
  feedUrl: string;
  active: boolean;
  lastFetch?: number;
  itemCount?: number;
}

function FeedCard({ feed, userId }: { feed: FeedData; userId: string }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data } = db.useQuery({
    feedItems: {
      $: {
        where: { feedId: feed.id, read: false },
        limit: 50,
      },
    },
  });

  const allItemsData = db.useQuery({
    feedItems: { $: { where: { feedId: feed.id } } },
  });

  const unreadCount = data?.feedItems?.length || 0;

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/feeds/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedId: feed.id, userId }),
      });
      const result = await res.json();
      if (result.added > 0) {
        toast.success(`${result.added} new article${result.added > 1 ? "s" : ""}`);
      } else {
        toast.info("No new articles");
      }
    } catch {
      toast.error("Failed to refresh");
    } finally {
      setRefreshing(false);
    }
  }

  function deleteFeed() {
    const items = allItemsData.data?.feedItems || [];
    const txns = items.map((i) => tx.feedItems[i.id].delete());
    txns.push(tx.feeds[feed.id].delete());
    db.transact(txns);
    setDeleteOpen(false);
    toast.success("Feed deleted");
  }

  function openFeed() {
    router.push(`/feeds/${feed.id}`);
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <Card
            onClick={openFeed}
            className="transition-all hover:border-primary/60 cursor-pointer"
          />
        }
      >
        <CardHeader className="p-3 pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-block h-2 w-2 rounded-full shrink-0 ${unreadCount > 0 ? "bg-orange-500" : "bg-green-500"}`}
                  title={unreadCount > 0 ? `${unreadCount} unread` : "All read"}
                />
                <CardTitle className="text-sm font-semibold truncate">
                  {feed.name}
                </CardTitle>
              </div>
              <CardDescription className="text-xs mt-0.5 flex items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  RSS
                </Badge>
                {unreadCount > 0 && (
                  <span className="font-medium">{unreadCount} unread</span>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="space-y-2">
            <p className="text-sm font-bold font-mono truncate">
              {unreadCount > 0 ? `${unreadCount} new` : "All caught up"}
            </p>
            <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
              <p className="text-[11px] text-muted-foreground">
                {feed.lastFetch ? timeAgo(feed.lastFetch) : "Never"}
              </p>
              <div className="flex gap-0.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => { e.stopPropagation(); refresh(); }}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={openFeed}>
          <ExternalLink className="h-4 w-4" />
          Open feed
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => window.open(feed.feedUrl, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink className="h-4 w-4" />
          Open source URL
        </ContextMenuItem>
        <ContextMenuItem onClick={refresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => setDeleteOpen(true)}
          className="text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete feed?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{feed.name}&quot; and all its
              saved articles.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteFeed}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ContextMenu>
  );
}

function SummaryButton({ userId, className, compact }: { userId: string; className?: string; compact?: boolean }) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  const { data: monitorsData } = db.useQuery({
    monitors: { $: { where: { userId } } },
  });
  const myMonitorIds = new Set((monitorsData?.monitors || []).map((m) => m.id));

  const { data: notifData } = db.useQuery({
    notifications: {
      $: { order: { serverCreatedAt: "desc" }, limit: 100 },
    },
  });

  const recent = (notifData?.notifications || []).filter((n) => {
    const row = n as unknown as { monitorId: string; sentAt?: number };
    return (
      myMonitorIds.has(row.monitorId) &&
      typeof row.sentAt === "number" &&
      row.sentAt >= cutoff
    );
  });

  if (recent.length === 0) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className={`gap-1.5 ${className || ""}`}
      >
        <TrendingUp className="h-4 w-4" />
        <span className={`text-muted-foreground font-normal ${compact ? "text-[11px]" : ""}`}>
          {compact ? "0 in 24h" : "No changes in 24h"}
        </span>
      </Button>
    );
  }

  const counts = { video: 0, short: 0, post: 0, webpage: 0 };
  for (const n of recent) {
    const k = (n as unknown as { kind?: string }).kind;
    if (k === "video") counts.video++;
    else if (k === "short") counts.short++;
    else if (k === "post") counts.post++;
    else counts.webpage++;
  }

  const parts: string[] = [];
  if (counts.video) parts.push(`${counts.video} video${counts.video !== 1 ? "s" : ""}`);
  if (counts.short) parts.push(`${counts.short} short${counts.short !== 1 ? "s" : ""}`);
  if (counts.post) parts.push(`${counts.post} post${counts.post !== 1 ? "s" : ""}`);
  if (counts.webpage) parts.push(`${counts.webpage} webpage${counts.webpage !== 1 ? "s" : ""}`);

  const monitorMap = new Map((monitorsData?.monitors || []).map((m) => [m.id, m]));

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className={`gap-1.5 ${compact ? "text-[11px]" : ""} ${className || ""}`}>
            <TrendingUp className={`text-primary ${compact ? "h-3 w-3" : "h-4 w-4"}`} />
            <span className="font-semibold">{recent.length}</span>
            <span className="text-muted-foreground font-normal">in 24h</span>
          </Button>
        }
      />
      <DialogContent className="max-w-[22rem] sm:max-w-md max-h-[75vh] overflow-y-auto p-4">
        <DialogHeader>
          <DialogTitle className="text-base">Last 24 hours</DialogTitle>
          <DialogDescription className="text-xs">
            {recent.length} change{recent.length !== 1 ? "s" : ""} · {parts.join(" · ")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 mt-2">
          {recent.map((n) => {
            const row = n as unknown as {
              id: string;
              monitorId: string;
              newValue?: string;
              sentAt?: number;
              kind?: string;
              itemUrl?: string;
            };
            const monitor = monitorMap.get(row.monitorId) as
              | Record<string, unknown>
              | undefined;
            const url = row.itemUrl || (monitor?.url as string | undefined);
            return (
              <a
                key={row.id}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col gap-0.5 text-xs py-1.5 px-2 border border-border/40 hover:border-primary/40 hover:bg-muted/40 transition-colors [overflow-wrap:anywhere]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">
                    {(monitor?.name as string) || "Unknown"}
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-[9px] px-1.5 py-0 shrink-0"
                  >
                    {row.kind || "change"}
                  </Badge>
                </div>
                <span className="text-muted-foreground">
                  {row.newValue}
                </span>
              </a>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Dashboard() {
  const { user } = db.useAuth();
  const { data, isLoading } = db.useQuery({
    monitors: { $: { where: { userId: user!.id } } },
  });

  const { data: feedsData } = db.useQuery({
    feeds: { $: { where: { userId: user!.id } } },
  });

  const monitors = data?.monitors || [];
  const feeds = feedsData?.feeds || [];
  const hasContent = monitors.length > 0 || feeds.length > 0;

  return (
    <div className="flex-1">
      <Navbar />
      <main className="w-full px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground text-lg">Loading...</p>
          </div>
        ) : !hasContent ? (
          <Card className="border-dashed mt-4">
            <CardContent className="py-16 text-center">
              <div className="max-w-sm mx-auto space-y-4">
                <p className="text-lg text-muted-foreground">
                  No monitors or feeds yet. Add something to get started.
                </p>
                <div className="flex gap-2 justify-center">
                  <Link href="/feeds/new">
                    <Button variant="outline" size="lg">Add RSS Feed</Button>
                  </Link>
                  <Link href="/monitors/new">
                    <Button size="lg">Create Monitor</Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-4 gap-1.5 mb-4 lg:hidden">
                <SummaryButton userId={user!.id} className="w-full px-2" compact />
                <Dialog>
                  <DialogTrigger
                    render={
                      <Button variant="outline" size="sm" className="w-full px-2 text-[11px]">
                        <Activity className="h-3 w-3" />
                        <span className="ml-1">Activity</span>
                      </Button>
                    }
                  />
                  <DialogContent className="max-w-[22rem] sm:max-w-sm max-h-[75vh] overflow-y-auto p-4">
                    <DialogHeader>
                      <DialogTitle className="text-base">Recent Activity</DialogTitle>
                      <DialogDescription className="text-xs">
                        Latest changes across your monitors
                      </DialogDescription>
                    </DialogHeader>
                    <ActivityFeed userId={user!.id} />
                  </DialogContent>
                </Dialog>
                <Link href="/feeds/new" className="w-full">
                  <Button size="sm" className="w-full px-2 text-[11px]">Feed</Button>
                </Link>
                <Link href="/monitors/new" className="w-full">
                  <Button size="sm" className="w-full px-2 text-[11px]">Monitor</Button>
                </Link>
              </div>
              <div className="grid grid-flow-dense gap-3 sm:grid-cols-2 lg:grid-cols-3 auto-rows-[1fr]">
                {monitors.map((monitor) => (
                  <MonitorCard
                    key={monitor.id}
                    monitor={monitor as unknown as MonitorData}
                    userId={user!.id}
                  />
                ))}
                {feeds.map((feed) => (
                  <FeedCard
                    key={feed.id}
                    feed={feed as unknown as FeedData}
                    userId={user!.id}
                  />
                ))}
              </div>
            </div>
            <aside className="hidden lg:block lg:w-72 shrink-0">
              <div className="grid grid-cols-3 gap-2 mb-4">
                <SummaryButton userId={user!.id} className="w-full" />
                <Link href="/feeds/new" className="w-full">
                  <Button size="sm" className="w-full">Feed</Button>
                </Link>
                <Link href="/monitors/new" className="w-full">
                  <Button size="sm" className="w-full">Monitor</Button>
                </Link>
              </div>
              <ActivityFeed userId={user!.id} />
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

export default function Home() {
  const { isLoading, user } = db.useAuth();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  return <Dashboard />;
}
