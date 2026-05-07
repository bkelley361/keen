"use client";

import { use, Suspense, useState, useEffect } from "react";
import { db, tx } from "@/lib/instant";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark } from "lucide-react";

function ArticleContent({ feedId }: { feedId: string }) {
  const { user } = db.useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const itemId = searchParams.get("item");
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const { data } = db.useQuery(
    itemId ? { feedItems: { $: { where: { id: itemId } } } } : null
  );

  const item = data?.feedItems?.[0] as unknown as {
    id: string;
    feedId: string;
    title: string;
    link: string;
    pubDate: number;
    read: boolean;
    bookmarked?: boolean;
  } | undefined;

  useEffect(() => {
    if (!item?.link) return;
    setLoading(true);
    fetch(`/api/feeds/article?url=${encodeURIComponent(item.link)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.content) {
          setContent(data.content);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [item?.link]);

  if (!user) {
    router.push("/login");
    return null;
  }

  if (data && !item) {
    router.push(`/feeds/${feedId}`);
    return null;
  }

  if (item && !item.read) {
    db.transact(tx.feedItems[item.id].update({ read: true }));
  }

  function toggleRead() {
    if (!item) return;
    db.transact(tx.feedItems[item.id].update({ read: !item.read }));
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.push(`/feeds/${feedId}`)}>
          ← Back to feed
        </Button>
        {item && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => db.transact(tx.feedItems[item.id].update({ bookmarked: !item.bookmarked }))}
              className={item.bookmarked ? "text-primary" : ""}
            >
              <Bookmark className={`h-4 w-4 ${item.bookmarked ? "fill-current" : ""}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={toggleRead}>
              {item.read ? "Mark unread" : "Mark read"}
            </Button>
          </div>
        )}
      </div>
      {item ? (
        <article>
          <h1 className="text-2xl font-bold mb-2">{item.title}</h1>
          <div className="flex items-center gap-3 mb-6">
            <p className="text-sm text-muted-foreground">
              {item.pubDate ? new Date(item.pubDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : ""}
            </p>
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              Open original ↗
            </a>
          </div>
          {loading ? (
            <p className="text-muted-foreground">Loading article...</p>
          ) : content ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none [&_img]:rounded-md [&_a]:text-primary [&_a]:underline [&_pre]:overflow-x-auto [&_figure]:my-4 [&_figcaption]:text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : error ? (
            <p className="text-muted-foreground italic">
              Could not load article content.{" "}
              <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Read on the original site ↗
              </a>
            </p>
          ) : null}
        </article>
      ) : (
        <p className="text-muted-foreground">Loading...</p>
      )}
    </main>
  );
}

export default function ArticlePage({ params }: { params: Promise<{ feedId: string }> }) {
  const { feedId } = use(params);

  return (
    <div className="flex-1">
      <Navbar />
      <Suspense fallback={<div className="max-w-2xl mx-auto px-6 py-8"><p className="text-muted-foreground">Loading...</p></div>}>
        <ArticleContent feedId={feedId} />
      </Suspense>
    </div>
  );
}
