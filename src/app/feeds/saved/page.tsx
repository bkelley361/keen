"use client";

import { db, tx } from "@/lib/instant";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";

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

export default function SavedPage() {
  const { user } = db.useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");

  const { data: savedData } = db.useQuery({
    feedItems: { $: { where: { bookmarked: true }, order: { serverCreatedAt: "desc" } } },
  });

  const { data: feedsData } = db.useQuery(
    user ? { feeds: { $: { where: { userId: user.id } } } } : null
  );

  if (!user) {
    router.push("/login");
    return null;
  }

  const feedMap = new Map(
    (feedsData?.feeds ?? []).map((f) => [f.id, f.name as string])
  );

  const items = ([...(savedData?.feedItems ?? [])] as unknown as {
    id: string;
    feedId: string;
    title: string;
    link: string;
    pubDate: number;
    read: boolean;
    bookmarked: boolean;
  }[]).sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0));

  const filtered = search.trim()
    ? items.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div className="flex-1">
      <Navbar />
      <main className="max-w-2xl mx-auto px-6 py-8">
        <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => router.push("/")}>
          ← Back
        </Button>
        <div className="mb-4">
          <h1 className="text-xl font-semibold">Saved Articles</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {items.length} saved{items.length !== 1 ? " articles" : " article"} across all feeds
          </p>
        </div>

        <Input
          placeholder="Search saved articles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3 h-8 text-sm"
        />

        <div className="divide-y divide-border border-t border-b border-border">
          {filtered.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              {search ? "No matching saved articles" : "No saved articles yet. Bookmark articles from any feed to see them here."}
            </p>
          ) : (
            filtered.map((item) => (
              <div key={item.id} className={`flex items-center gap-3 px-1 py-2.5 transition-colors hover:bg-muted/30 ${item.read ? "opacity-60" : ""}`}>
                <Link
                  href={`/feeds/${item.feedId}/article?item=${item.id}`}
                  className="flex-1 min-w-0"
                >
                  <p className={`text-sm truncate ${item.read ? "font-normal" : "font-medium"}`}>
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {feedMap.get(item.feedId) ?? "Unknown feed"}
                    {item.pubDate ? ` · ${timeAgo(item.pubDate)}` : ""}
                    {!item.read && <span className="ml-2 text-primary font-medium">New</span>}
                  </p>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      db.transact(tx.feedItems[item.id].update({ bookmarked: false }));
                      toast.success("Removed from saved");
                    }}
                    className="flex items-center gap-1.5 text-xs px-2 py-1 border border-primary/50 text-primary bg-primary/5 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 transition-colors"
                    title="Remove save"
                  >
                    <BookmarkCheck className="h-3.5 w-3.5" />
                    Saved
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
