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
import { Bookmark } from "lucide-react";

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
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.push("/")}>
            ← Back
          </Button>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead}>
                Mark read
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
        <div className="mb-4">
          <h1 className="text-xl font-semibold">{feed?.name as string || "Feed"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unreadCount} unread · {items.length} total{bookmarkCount > 0 ? ` · ${bookmarkCount} bookmarked` : ""}
          </p>
        </div>
        <div className="flex gap-1.5 mb-3">
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
            Saved{bookmarkCount > 0 ? ` ${bookmarkCount}` : ""}
          </button>
        </div>

        <Input
          placeholder="Search articles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3 h-8 text-sm"
        />

        <div className="space-y-1">
          {filteredItems.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">{search ? "No matching articles" : "No articles yet"}</p>
          ) : (
            filteredItems.map((item) => (
              <div key={item.id} className="group relative flex items-center">
                <Link
                  href={`/feeds/${feedId}/article?item=${item.id}`}
                  onClick={() => markRead(item.id)}
                  className="block flex-1 min-w-0"
                >
                  <div className={`flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors ${item.read ? "opacity-60" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm truncate ${item.read ? "font-normal" : "font-medium"}`}>
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.pubDate ? timeAgo(item.pubDate) : ""}
                      </p>
                    </div>
                    {!item.read && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0 shrink-0">
                        new
                      </Badge>
                    )}
                  </div>
                </Link>
                <div className="absolute right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.preventDefault(); db.transact(tx.feedItems[item.id].update({ bookmarked: !item.bookmarked })); }}
                    className={`p-1 rounded hover:text-primary transition-colors ${item.bookmarked ? "text-primary" : "text-muted-foreground"}`}
                    title={item.bookmarked ? "Remove bookmark" : "Bookmark"}
                  >
                    <Bookmark className={`h-3 w-3 ${item.bookmarked ? "fill-current" : ""}`} />
                  </button>
                  <button
                    onClick={() => db.transact(tx.feedItems[item.id].update({ read: !item.read }))}
                    className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded"
                    title={item.read ? "Mark unread" : "Mark read"}
                  >
                    {item.read ? "unread" : "read"}
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
