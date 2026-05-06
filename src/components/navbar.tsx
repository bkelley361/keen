"use client";

import { db } from "@/lib/instant";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { Rss } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function FeedUrlDialog({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(regenerate = false) {
    setLoading(true);
    try {
      const res = await fetch("/api/feed-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, regenerate }),
      });
      const data = await res.json();
      if (data.token) setToken(data.token);
      else toast.error("Failed to load feed URL");
    } catch {
      toast.error("Failed to load feed URL");
    } finally {
      setLoading(false);
    }
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && !token) load(false);
  }

  const feedUrl = token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/feed/${token}`
    : "";

  function copy() {
    if (!feedUrl) return;
    navigator.clipboard.writeText(feedUrl);
    toast.success("Feed URL copied");
  }

  async function regenerate() {
    if (!confirm("Regenerate feed URL? The old URL will stop working.")) return;
    await load(true);
    toast.success("New feed URL generated");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Rss className="h-4 w-4 mr-1.5" />
            RSS
          </Button>
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Your change feed</DialogTitle>
          <DialogDescription>
            A private Atom feed of every detected change (webpages, YouTube
            videos, shorts, and community posts). Subscribe in any RSS reader.
            Keep this URL private — anyone with it can read your feed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={loading ? "Loading..." : feedUrl}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
            className="font-mono text-xs"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={regenerate} disabled={loading}>
              Regenerate
            </Button>
            <Button onClick={copy} disabled={loading || !feedUrl}>
              Copy
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Navbar() {
  const { user } = db.useAuth();

  return (
    <nav className="border-b border-border bg-background sticky top-0 z-50">
      <div className="w-full px-6 h-16 flex items-center justify-between">
        <Link href="/" className="font-bold text-2xl tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>
          Keen
        </Link>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          {user && (
            <>
              <FeedUrlDialog userId={user.id} />
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user.email}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => db.auth.signOut()}
              >
                Sign out
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
