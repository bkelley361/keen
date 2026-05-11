"use client";

import { useState, use } from "react";
import { db, tx } from "@/lib/instant";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck } from "lucide-react";

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

export default function FeedPage({ params }: { params: Promise<{ feedId: string }> }) {
  const { feedId } = use(params);
  const { user } = db.useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [showBookmarks, setShowBookmarks] = useState(false);

  const { data } = db.useQuery({
    feeds: { $: { where: { id: feedId } } },
  });

  const { data: itemsData } = db.useQuery({
    feedItems: { $: { where: { feedId }, order: { serverCreatedAt: "desc" } } },
  });

  const feed = data?.feeds?.[0] as Record<string, unknown> | undefined;
  const items = ([...(itemsData?.feedItems || [])] as unknown as {
    id: string;
    title: string;
    link: string;
    pubDate: number;
    description: string;
    read: boolean;
    bookmarked?: boolean;
  }[]).sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0));

  if (!user) {
    router.push("/login");
    return null;
  }

  if (data && !feed) {
    router.push("/");
    return null;
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/feeds/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedId, userId: user!.id }),
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

  function markRead(itemId: string) {
    db.transact(tx.feedItems[itemId].update({ read: true }));
  }

  function markAllRead() {
    const unread = items.filter((i) => !i.read);
    if (unread.length === 0) return;
    const txns = unread.map((i) => tx.feedItems[i.id].update({ read: true }));
    db.transact(txns);
    toast.success(`Marked ${unread.length} as read`);
  }

  function deleteFeed() {
    const txns = items.map((i) => tx.feedItems[i.id].delete());
    txns.push(tx.feeds[feedId].delete());
    db.transact(txns);
    toast.success("Feed deleted");
    router.push("/");
  }

  const unreadCount = items.filter((i) => !i.read).length;
  const bookmarkCount = items.filter((i) => i.bookmarked).length;
  const baseItems = showBookmarks ? items.filter((i) => i.bookmarked) : items;
  const filteredItems = search.trim()
    ? baseItems.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()))
    : baseItems;

  return (
    <div className="flex-1">
      <Navbar />
      <main className="max-w-2xl mx-auto px-6 py-8">
        <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => router.push("/")}>
          ← Back
        </Button>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">{feed?.name as string || "Feed"}</h1>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead}>
                Mark all read
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={deleteFeed}>
              Delete
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {unreadCount > 0 ? `${unreadCount} unread · ` : ""}{items.length} articles{bookmarkCount > 0 ? ` · ${bookmarkCount} saved` : ""}
        </p>
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1.5">
            <button
              onClick={() => setShowBookmarks(false)}
              className={`text-[11px] px-2.5 py-1 border font-medium transition-colors ${!showBookmarks ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
            >
              All
            </button>
            <button
              onClick={() => setShowBookmarks(true)}
              className={`text-[11px] px-2.5 py-1 border font-medium transition-colors flex items-center gap-1 ${showBookmarks ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
            >
              <Bookmark className="h-3 w-3" />
              Saved{bookmarkCount > 0 ? ` (${bookmarkCount})` : ""}
            </button>
          </div>
          <Link href="/feeds/saved" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <BookmarkCheck className="h-3 w-3" />
            All saved
          </Link>
        </div>

        <Input
          placeholder="Search articles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3 h-8 text-sm"
        />

        <div className="divide-y divide-border border-t border-b border-border">
          {filteredItems.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">{search ? "No matching articles" : "No articles yet"}</p>
          ) : (
            filteredItems.map((item) => (
              <div key={item.id} className={`flex items-center gap-3 px-1 py-2.5 transition-colors hover:bg-muted/30 ${item.read ? "opacity-60" : ""}`}>
                <Link
                  href={`/feeds/${feedId}/article?item=${item.id}`}
                  onClick={() => markRead(item.id)}
                  className="flex-1 min-w-0"
                >
                  <p className={`text-sm truncate ${item.read ? "font-normal" : "font-medium"}`}>
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.pubDate ? timeAgo(item.pubDate) : ""}
                    {!item.read && <span className="ml-2 text-primary font-medium">New</span>}
                  </p>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      const next = !item.bookmarked;
                      db.transact(tx.feedItems[item.id].update({ bookmarked: next }));
                      toast.success(next ? "Article saved" : "Removed from saved");
                    }}
                    className={`flex items-center gap-1.5 text-xs px-2 py-1 border transition-colors ${item.bookmarked ? "border-primary/50 text-primary bg-primary/5 hover:bg-primary/10" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                    title={item.bookmarked ? "Remove save" : "Save"}
                  >
                    {item.bookmarked ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                    {item.bookmarked ? "Saved" : "Save"}
                  </button>
                  <button
                    onClick={() => db.transact(tx.feedItems[item.id].update({ read: !item.read }))}
                    className="flex items-center gap-1.5 text-xs px-2 py-1 border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    {item.read ? "Mark unread" : "Mark read"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
