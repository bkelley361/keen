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
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Trash2, Pencil, History, RefreshCw, Bell, Activity, ExternalLink, Pause, Play, Copy, Folder, Archive, ArchiveRestore, Tag, CheckCheck } from "lucide-react";
import { HistoryTab } from "@/components/history-tab";

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
  group?: string;
  archived?: boolean;
  tags?: string;
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

function MonitorCard({ monitor, userId, hideThumbnails }: { monitor: MonitorData; userId: string; hideThumbnails: boolean }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupInput, setGroupInput] = useState("");
  const [tagsOpen, setTagsOpen] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [historyTab, setHistoryTab] = useState<"notifications" | "snapshots">("notifications");

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
          <Card className={`transition-all hover:border-primary/60 ${monitor.type === "youtube" && !hideThumbnails ? "row-span-2" : ""}`} />
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
            <CardDescription className="text-xs mt-0.5 flex items-center gap-1.5 flex-wrap">
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
              {monitor.tags && monitor.tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                <span key={t} className="text-[9px] px-1.5 py-0 bg-muted text-muted-foreground rounded-sm">{t}</span>
              ))}
            </CardDescription>
          </div>
          <Switch checked={monitor.active} onCheckedChange={toggleActive} className="shrink-0 scale-75" />
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="space-y-2">
          {monitor.type === "youtube" && lastValue ? (
            <div>
              {extractVideoId(lastValue) && !hideThumbnails ? (
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
                <p className="text-sm font-bold font-mono truncate">
                  {extractVideoId(lastValue) ? extractVideoTitle(lastValue) : lastValue}
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
              {(monitor.lastStatus === "changed" || monitor.lastStatus === "error") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => db.transact(tx.monitors[monitor.id].update({ lastStatus: "ok" }))}
                  title="Mark as read"
                >
                  <CheckCheck className="h-3 w-3" />
                </Button>
              )}
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
        <ContextMenuItem onClick={() => { setGroupInput(monitor.group ?? ""); setGroupOpen(true); }}>
          <Folder className="h-4 w-4" />
          Set group
        </ContextMenuItem>
        <ContextMenuItem onClick={() => { setTagsInput(monitor.tags ?? ""); setTagsOpen(true); }}>
          <Tag className="h-4 w-4" />
          Tags
        </ContextMenuItem>
        <ContextMenuItem onClick={() => db.transact(tx.monitors[monitor.id].update({ archived: !monitor.archived }))}>
          {monitor.archived ? <><ArchiveRestore className="h-4 w-4" />Unarchive</> : <><Archive className="h-4 w-4" />Archive</>}
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

      <Dialog open={tagsOpen} onOpenChange={setTagsOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Tags</DialogTitle>
            <DialogDescription>Comma-separated tags for &quot;{monitor.name}&quot;.</DialogDescription>
          </DialogHeader>
          <input
            className="w-full border border-border rounded px-3 py-1.5 text-sm bg-background outline-none focus:ring-1 focus:ring-ring"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="news, youtube, tech"
            onKeyDown={(e) => { if (e.key === "Enter") { db.transact(tx.monitors[monitor.id].update({ tags: tagsInput.trim() || null })); setTagsOpen(false); } }}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setTagsOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => { db.transact(tx.monitors[monitor.id].update({ tags: tagsInput.trim() || null })); setTagsOpen(false); }}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Set group</DialogTitle>
            <DialogDescription>Assign &quot;{monitor.name}&quot; to a group. Leave blank to remove from group.</DialogDescription>
          </DialogHeader>
          <input
            className="w-full border border-border rounded px-3 py-1.5 text-sm bg-background outline-none focus:ring-1 focus:ring-ring"
            value={groupInput}
            onChange={(e) => setGroupInput(e.target.value)}
            placeholder="Group name"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                db.transact(tx.monitors[monitor.id].update({ group: groupInput.trim() || null }));
                setGroupOpen(false);
              }
            }}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setGroupOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => {
              db.transact(tx.monitors[monitor.id].update({ group: groupInput.trim() || null }));
              setGroupOpen(false);
            }}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>History</DialogTitle>
            <DialogDescription>{monitor.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-1 border-b border-border">
              <button
                className={`px-3 py-1.5 text-sm -mb-px border-b-2 transition-colors ${historyTab === "notifications" ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                onClick={() => setHistoryTab("notifications")}
              >
                Notifications
              </button>
              <button
                className={`px-3 py-1.5 text-sm -mb-px border-b-2 transition-colors ${historyTab === "snapshots" ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                onClick={() => setHistoryTab("snapshots")}
              >
                Snapshots
              </button>
            </div>

            {historyTab === "notifications" ? (
              <div className="max-h-80 overflow-y-auto space-y-3">
                {notifications.length === 0 ? (
                  <p className="text-base text-muted-foreground py-6 text-center">
                    No changes detected yet
                  </p>
                ) : (
                  (notifications as unknown as NotificationData[]).map((n) => (
                    <div key={n.id} className="border border-border p-4 space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {n.sentAt ? new Date(n.sentAt).toLocaleString() : "Unknown"}
                      </p>
                      <div className="text-base [overflow-wrap:anywhere]">
                        <span className="text-red-400 line-through">{n.oldValue || "(empty)"}</span>
                        {" → "}
                        <span className="text-green-400 font-medium">{n.newValue}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <HistoryTab monitorId={monitor.id} monitorType={monitor.type} userId={userId} />
              </div>
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
  group?: string;
  archived?: boolean;
  tags?: string;
}

function FeedCard({ feed, userId }: { feed: FeedData; userId: string }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupInput, setGroupInput] = useState("");
  const [tagsOpen, setTagsOpen] = useState(false);
  const [tagsInput, setTagsInput] = useState("");

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
              <CardDescription className="text-xs mt-0.5 flex items-center gap-1.5 flex-wrap">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  RSS
                </Badge>
                {unreadCount > 0 && (
                  <span className="font-medium">{unreadCount} unread</span>
                )}
                {feed.tags && feed.tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                  <span key={t} className="text-[9px] px-1.5 py-0 bg-muted text-muted-foreground rounded-sm">{t}</span>
                ))}
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
                {unreadCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      const items = data?.feedItems || [];
                      if (items.length) db.transact(items.map((i) => tx.feedItems[i.id].update({ read: true })));
                    }}
                    title="Mark all as read"
                  >
                    <CheckCheck className="h-3 w-3" />
                  </Button>
                )}
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
        <ContextMenuItem onClick={() => { setGroupInput(feed.group ?? ""); setGroupOpen(true); }}>
          <Folder className="h-4 w-4" />
          Set group
        </ContextMenuItem>
        <ContextMenuItem onClick={() => { setTagsInput(feed.tags ?? ""); setTagsOpen(true); }}>
          <Tag className="h-4 w-4" />
          Tags
        </ContextMenuItem>
        <ContextMenuItem onClick={() => db.transact(tx.feeds[feed.id].update({ archived: !feed.archived }))}>
          {feed.archived ? <><ArchiveRestore className="h-4 w-4" />Unarchive</> : <><Archive className="h-4 w-4" />Archive</>}
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

      <Dialog open={tagsOpen} onOpenChange={setTagsOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Tags</DialogTitle>
            <DialogDescription>Comma-separated tags for &quot;{feed.name}&quot;.</DialogDescription>
          </DialogHeader>
          <input
            className="w-full border border-border rounded px-3 py-1.5 text-sm bg-background outline-none focus:ring-1 focus:ring-ring"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="news, tech, rss"
            onKeyDown={(e) => { if (e.key === "Enter") { db.transact(tx.feeds[feed.id].update({ tags: tagsInput.trim() || null })); setTagsOpen(false); } }}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setTagsOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => { db.transact(tx.feeds[feed.id].update({ tags: tagsInput.trim() || null })); setTagsOpen(false); }}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Set group</DialogTitle>
            <DialogDescription>Assign &quot;{feed.name}&quot; to a group. Leave blank to remove from group.</DialogDescription>
          </DialogHeader>
          <input
            className="w-full border border-border rounded px-3 py-1.5 text-sm bg-background outline-none focus:ring-1 focus:ring-ring"
            value={groupInput}
            onChange={(e) => setGroupInput(e.target.value)}
            placeholder="Group name"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                db.transact(tx.feeds[feed.id].update({ group: groupInput.trim() || null }));
                setGroupOpen(false);
              }
            }}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setGroupOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => {
              db.transact(tx.feeds[feed.id].update({ group: groupInput.trim() || null }));
              setGroupOpen(false);
            }}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

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


function Dashboard() {
  const { user } = db.useAuth();
  const [showArchived, setShowArchived] = useState(false);
  const { data, isLoading: monitorsLoading } = db.useQuery({
    monitors: { $: { where: { userId: user!.id } } },
  });
  const { data: feedsLoadData, isLoading: feedsLoading } = db.useQuery({
    feeds: { $: { where: { userId: user!.id } } },
  });
  const isLoading = monitorsLoading || feedsLoading;

  const feedsData = feedsLoadData;

  const { data: prefsData, isLoading: prefsLoading } = db.useQuery({
    userPrefs: { $: { where: { userId: user!.id } } },
  });

  const allMonitors = data?.monitors || [];
  const allFeeds = feedsData?.feeds || [];
  const monitors = showArchived
    ? allMonitors.filter((m) => (m as unknown as MonitorData).archived)
    : allMonitors.filter((m) => !(m as unknown as MonitorData).archived);
  const feeds = showArchived
    ? allFeeds.filter((f) => (f as unknown as FeedData).archived)
    : allFeeds.filter((f) => !(f as unknown as FeedData).archived);
  const archivedCount = allMonitors.filter((m) => (m as unknown as MonitorData).archived).length +
    allFeeds.filter((f) => (f as unknown as FeedData).archived).length;

  useEffect(() => {
    if (showArchived && monitors.length === 0 && feeds.length === 0) {
      setShowArchived(false);
    }
  }, [showArchived, monitors.length, feeds.length]);
  const prefs = prefsData?.userPrefs?.[0] as { hideThumbnails?: boolean; cardSort?: string } | undefined;

  const { data: unreadData } = db.useQuery({
    feedItems: { $: { where: { read: false } } },
  });
  const totalUnread = unreadData?.feedItems?.length ?? 0;
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) Keen` : "Keen";
  }, [totalUnread]);
  const hideThumbnails = prefs?.hideThumbnails ?? false;
  const cardSort = (prefs?.cardSort ?? "added") as "added" | "name" | "last-checked" | "status";
  const anyLoading = monitorsLoading || feedsLoading || prefsLoading;
  const hasContent = allMonitors.length > 0 || allFeeds.length > 0;

  type CardItem =
    | { kind: "monitor"; data: (typeof monitors)[number] }
    | { kind: "feed"; data: (typeof feeds)[number] };

  const statusOrder = { changed: 0, error: 1, ok: 2, undefined: 3 };

  const sortedCards: CardItem[] = [
    ...monitors.map((m) => ({ kind: "monitor" as const, data: m })),
    ...feeds.map((f) => ({ kind: "feed" as const, data: f })),
  ].sort((a, b) => {
    if (cardSort === "name") {
      return a.data.name.localeCompare(b.data.name);
    }
    if (cardSort === "last-checked") {
      const aTime = (a.kind === "monitor" ? (a.data as unknown as MonitorData).lastChecked : (a.data as unknown as FeedData).lastFetch) ?? 0;
      const bTime = (b.kind === "monitor" ? (b.data as unknown as MonitorData).lastChecked : (b.data as unknown as FeedData).lastFetch) ?? 0;
      return bTime - aTime;
    }
    if (cardSort === "status") {
      const aStatus = a.kind === "monitor" ? ((a.data as unknown as MonitorData).lastStatus ?? "undefined") : "ok";
      const bStatus = b.kind === "monitor" ? ((b.data as unknown as MonitorData).lastStatus ?? "undefined") : "ok";
      return (statusOrder[aStatus as keyof typeof statusOrder] ?? 3) - (statusOrder[bStatus as keyof typeof statusOrder] ?? 3);
    }
    return 0;
  });

  const groupedCards: { label: string | null; items: CardItem[] }[] = [];
  for (const card of sortedCards) {
    const g = ((card.data as unknown as { group?: string }).group) || null;
    const existing = groupedCards.find((gc) => gc.label === g);
    if (existing) existing.items.push(card);
    else groupedCards.push({ label: g, items: [card] });
  }
  groupedCards.sort((a, b) => {
    if (a.label === null) return 1;
    if (b.label === null) return -1;
    return a.label.localeCompare(b.label);
  });

  return (
    <div className="flex-1">
      <Navbar />
      <main className="w-full px-6 py-4">
        {anyLoading ? null : !hasContent ? (
          <Card className="border-dashed mt-4">
            <CardContent className="py-16 text-center">
              <div className="max-w-sm mx-auto space-y-4">
                <p className="text-lg text-muted-foreground">
                  No monitors or feeds yet. Add something to get started.
                </p>
                <div className="flex flex-col items-center gap-3">
                  <Link href="/monitors/new">
                    <Button size="lg">Add Monitor</Button>
                  </Link>
                  <Link href="/templates" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    or browse templates
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 min-w-0">
              {archivedCount > 0 && (
                <div className="mb-3 lg:hidden">
                  <button
                    onClick={() => setShowArchived((v) => !v)}
                    className={`text-[11px] px-2.5 py-1 border font-medium transition-colors flex items-center gap-1 ${showArchived ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
                  >
                    <Archive className="h-3 w-3" />
                    {showArchived ? "Hide archived" : `Archived (${archivedCount})`}
                  </button>
                </div>
              )}
              <div className="flex items-center gap-1.5 mb-4 lg:hidden">
                <Link href="/monitors/new">
                  <Button size="sm">Add Monitor</Button>
                </Link>
                <Link href="/templates">
                  <Button variant="outline" size="sm">Templates</Button>
                </Link>
                <Link href="/feeds/saved">
                  <Button variant="outline" size="sm">Saved</Button>
                </Link>
                <Dialog>
                  <DialogTrigger
                    render={
                      <button className="ml-auto text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                        <Activity className="h-3.5 w-3.5" />
                        Activity
                      </button>
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
              </div>
              {showArchived && monitors.length === 0 && feeds.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">No archived items</p>
              )}
              <div className="space-y-6">
                {groupedCards.map(({ label, items }) => (
                  <div key={label ?? "__ungrouped__"}>
                    {label && (
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
                    )}
                    <div className="grid grid-flow-dense gap-3 sm:grid-cols-2 lg:grid-cols-3 auto-rows-[1fr]">
                      {items.map((item) =>
                        item.kind === "monitor" ? (
                          <MonitorCard
                            key={item.data.id}
                            monitor={item.data as unknown as MonitorData}
                            userId={user!.id}
                            hideThumbnails={hideThumbnails}
                          />
                        ) : (
                          <FeedCard
                            key={item.data.id}
                            feed={item.data as unknown as FeedData}
                            userId={user!.id}
                          />
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <aside className="hidden lg:flex lg:flex-col lg:w-72 shrink-0 sticky top-16 max-h-[calc(100vh-6.1rem)] self-start">
              <Link href="/monitors/new" className="w-full block mb-2">
                <Button size="sm" className="w-full">Add Monitor</Button>
              </Link>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <Link href="/templates" className="w-full">
                  <Button variant="outline" size="sm" className="w-full">Templates</Button>
                </Link>
                <Link href="/feeds/saved" className="w-full">
                  <Button variant="outline" size="sm" className="w-full">Saved Articles</Button>
                </Link>
              </div>
              {archivedCount > 0 && (
                <button
                  onClick={() => setShowArchived((v) => !v)}
                  className={`w-full mb-4 text-[11px] px-2.5 py-1.5 border font-medium transition-colors flex items-center justify-center gap-1.5 ${showArchived ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
                >
                  <Archive className="h-3 w-3" />
                  {showArchived ? "Hide archived" : `Archived (${archivedCount})`}
                </button>
              )}
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

  if (!isLoading && !user) {
    router.push("/login");
    return null;
  }

  if (isLoading || !user) {
    return (
      <div className="flex-1">
        <Navbar />
      </div>
    );
  }

  return <Dashboard />;
}
