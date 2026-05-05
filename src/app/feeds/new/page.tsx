"use client";

import { useState } from "react";
import { db, tx, id } from "@/lib/instant";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function NewFeedPage() {
  const { isLoading, user } = db.useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [saving, setSaving] = useState(false);

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

      // Fetch articles immediately
      await fetch("/api/feeds/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedId, userId: user!.id }),
      });

      toast.success("Feed added!");
      router.push("/");
    } catch {
      toast.error("Failed to add feed");
    } finally {
      setSaving(false);
    }
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
