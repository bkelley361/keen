"use client";

import { useState, useEffect, Suspense } from "react";
import { db, tx, id } from "@/lib/instant";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { SaveAsTemplateDialog } from "@/components/save-as-template-dialog";
import { BookmarkPlus } from "lucide-react";

function NewFeedForm() {
  const { isLoading, user } = db.useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [feedUrl, setFeedUrl] = useState("");

  useEffect(() => {
    const paramName = searchParams.get("name");
    const paramFeedUrl = searchParams.get("feedUrl");
    if (paramName) setName(paramName);
    if (paramFeedUrl) setFeedUrl(paramFeedUrl);
  }, [searchParams]);
  const [saving, setSaving] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [created, setCreated] = useState(false);
  const [savedName, setSavedName] = useState("");
  const [savedFeedUrl, setSavedFeedUrl] = useState("");

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const feedId = id();
      db.transact(
        tx.feeds[feedId].update({
          userId: user!.id,
          name: name.trim(),
          feedUrl: feedUrl.trim(),
          active: true,
          lastFetch: 0,
          itemCount: 0,
          createdAt: Date.now(),
        })
      );

      await fetch("/api/feeds/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedId, userId: user!.id }),
      });

      toast.success("Feed added!");
      setSavedName(name.trim());
      setSavedFeedUrl(feedUrl.trim());
      setCreated(true);
    } catch {
      toast.error("Failed to add feed");
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <div className="flex-1">
        <Navbar />
        <main className="max-w-lg mx-auto px-6 py-8">
          <div className="border border-border p-6 space-y-4">
            <p className="text-base font-medium">Feed added!</p>
            <p className="text-sm text-muted-foreground">
              Want to save <span className="font-medium">{savedName}</span> as a reusable template?
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTemplateDialogOpen(true)}
                className="gap-1.5"
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                Save as template
              </Button>
              <Button size="sm" onClick={() => router.push("/")}>
                Go to dashboard
              </Button>
            </div>
          </div>
        </main>
        <SaveAsTemplateDialog
          open={templateDialogOpen}
          onOpenChange={(open) => {
            setTemplateDialogOpen(open);
            if (!open) router.push("/");
          }}
          userId={user.id}
          defaultName={savedName}
          source={{
            sourceType: "feed",
            feedUrl: savedFeedUrl,
            urlPlaceholder: savedFeedUrl,
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex-1">
      <Navbar />
      <main className="max-w-lg mx-auto px-6 py-8">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => router.push("/")}>
          ← Back
        </Button>
        <h1 className="text-xl font-semibold mb-6">Add RSS Feed</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="e.g. Hacker News, TechCrunch"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="feedUrl">Feed URL</Label>
            <Input
              id="feedUrl"
              type="url"
              placeholder="https://example.com/rss.xml"
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              RSS or Atom feed URL
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => router.push("/")}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Adding..." : "Add Feed"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default function NewFeedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>}>
      <NewFeedForm />
    </Suspense>
  );
}
