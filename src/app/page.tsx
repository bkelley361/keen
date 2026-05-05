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
import { Trash2, Pencil, History, RefreshCw } from "lucide-react";

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
  const [checking, setChecking] = useState(false);

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
        console.group(`[WatchTower] Check: ${monitor.name}`);
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

  return (
    <Card className={`transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 ${monitor.type === "youtube" ? "row-span-2" : ""}`}>
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
                  <div className="relative aspect-video rounded overflow-hidden border border-border/50">
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
              <Link href={`/monitors/edit?id=${monitor.id}`}>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <Pencil className="h-3 w-3" />
                </Button>
              </Link>
              <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogTrigger
                  render={<Button variant="ghost" size="sm" className="h-6 w-6 p-0" />}
                >
                  <History className="h-3 w-3" />
                </DialogTrigger>
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
                      (notifications as unknown as NotificationData[]).map(
                        (n) => (
                          <div
                            key={n.id}
                            className="border rounded-lg p-4 space-y-2"
                          >
                            <p className="text-sm text-muted-foreground">
                              {n.sentAt
                                ? new Date(n.sentAt).toLocaleString()
                                : "Unknown"}
                            </p>
                            <div className="text-base">
                              <span className="text-red-400 line-through">
                                {n.oldValue || "(empty)"}
                              </span>
                              {" → "}
                              <span className="text-green-400 font-medium">
                                {n.newValue}
                              </span>
                            </div>
                          </div>
                        )
                      )
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    />
                  }
                >
                  <Trash2 className="h-3 w-3" />
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete monitor?</DialogTitle>
                    <DialogDescription>
                      This will permanently delete &quot;{monitor.name}&quot; and
                      all its notification history.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setDeleteOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={deleteMonitor}>
                      Delete
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
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
  const [refreshing, setRefreshing] = useState(false);

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

  function deleteFeed(e: React.MouseEvent) {
    e.preventDefault();
    const items = allItemsData.data?.feedItems || [];
    const txns = items.map((i) => tx.feedItems[i.id].delete());
    txns.push(tx.feeds[feed.id].delete());
    db.transact(txns);
    toast.success("Feed deleted");
  }

  return (
    <Link href={`/feeds/${feed.id}`} className="block">
      <Card className="transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 cursor-pointer">
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
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => { e.preventDefault(); refresh(); }}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  onClick={deleteFeed}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
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
            <aside className="lg:w-72 shrink-0">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-muted-foreground">
                  {monitors.length} monitor{monitors.length !== 1 ? "s" : ""} · {feeds.length} feed{feeds.length !== 1 ? "s" : ""}
                </p>
                <div className="flex gap-2">
                  <Link href="/feeds/new">
                    <Button variant="outline" size="default">+ Feed</Button>
                  </Link>
                  <Link href="/monitors/new">
                    <Button size="default">+ Monitor</Button>
                  </Link>
                </div>
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
