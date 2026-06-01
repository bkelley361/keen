"use client";

import { useState, useEffect, Suspense } from "react";
import { db, tx, id } from "@/lib/instant";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { TEMPLATES } from "@/lib/templates";
import Link from "next/link";
import { SaveAsTemplateDialog } from "@/components/save-as-template-dialog";
import { BookmarkPlus } from "lucide-react";
import { SpaceSelectInline } from "@/components/space-select-inline";

function extractChannelId(url: string): string | null {
  const channelMatch = url.match(/youtube\.com\/channel\/([a-zA-Z0-9_-]+)/);
  if (channelMatch) return channelMatch[1];

  const handleMatch = url.match(/youtube\.com\/@([a-zA-Z0-9_-]+)/);
  if (handleMatch) return `@${handleMatch[1]}`;

  return null;
}

function NewMonitorForm() {
  const { isLoading, user } = db.useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<"standard" | "price" | "feed">("standard");
  const [type, setType] = useState<"webpage" | "youtube">("webpage");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selector, setSelector] = useState("");
  const [clickSelector, setClickSelector] = useState("");
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectedPrice, setDetectedPrice] = useState<string | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [created, setCreated] = useState(false);
  const [feedUrl, setFeedUrl] = useState("");

  useEffect(() => {
    const templateId = searchParams.get("templateId");
    const paramUrl = searchParams.get("url");
    const paramSelector = searchParams.get("selector");
    const paramName = searchParams.get("name");

    if (templateId) {
      const tpl = TEMPLATES.find((t) => t.id === templateId);
      if (tpl) {
        setType(tpl.type);
        setMode(tpl.mode);
        setName(tpl.name);
        if (tpl.selector) setSelector(tpl.selector);
        if (tpl.clickSelector) setClickSelector(tpl.clickSelector);
        return;
      }
    }

    const paramMode = searchParams.get("mode");
    if (paramMode === "feed") {
      setMode("feed");
      const paramFeedUrl = searchParams.get("feedUrl");
      if (paramFeedUrl) setFeedUrl(paramFeedUrl);
      if (paramName) setName(paramName);
      return;
    }

    if (paramUrl) {
      setUrl(paramUrl);
      setType("webpage");
    }
    if (paramSelector) setSelector(paramSelector);
    if (paramName) setName(paramName);
    else if (paramUrl) {
      try {
        setName(new URL(paramUrl).hostname.replace(/^www\./, ""));
      } catch {}
    }
  }, [searchParams]);

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

  async function detectPrice() {
    if (!url.trim()) {
      toast.error("Enter a URL first");
      return;
    }
    setDetecting(true);
    setDetectedPrice(null);
    try {
      const res = await fetch("/api/monitors/detect-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const result = await res.json();
      if (result.selector) {
        setSelector(result.selector);
        setDetectedPrice(result.detectedPrice);
        toast.success(`Found price: ${result.detectedPrice}`);
      } else {
        toast.error(result.error || "Could not detect price");
      }
    } catch {
      toast.error("Failed to detect price");
    } finally {
      setDetecting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (type === "youtube") {
      const channelId = extractChannelId(url);
      if (!channelId) {
        toast.error(
          "Invalid YouTube URL. Use format: youtube.com/channel/ID or youtube.com/@handle"
        );
        return;
      }
    }

    if (type === "webpage" && !selector.trim()) {
      toast.error("CSS selector is required for webpage monitors");
      return;
    }

    setSaving(true);
    try {
      const monitorId = id();
      db.transact(
        tx.monitors[monitorId].update({
          userId: user!.id,
          name: name.trim(),
          type,
          url: url.trim(),
          selector: type === "webpage" ? selector.trim() : "",
          clickSelector: type === "webpage" && clickSelector.trim() ? clickSelector.trim() : "",
          lastValue: "",
          lastChecked: 0,
          active: true,
          spaceId: spaceId || null,
          status: "active",
          frequencySeconds: 14400,
          createdAt: Date.now(),
        })
      );
      toast.success("Monitor created!");
      setCreated(true);
    } catch {
      toast.error("Failed to create monitor");
    } finally {
      setSaving(false);
    }
  }

  async function handleFeedSubmit(e: React.FormEvent) {
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
      setCreated(true);
    } catch {
      toast.error("Failed to add feed");
    } finally {
      setSaving(false);
    }
  }

  const activeTemplate = (() => {
    const templateId = searchParams.get("templateId");
    return templateId ? TEMPLATES.find((t) => t.id === templateId) : null;
  })();

  if (created) {
    const isFeed = mode === "feed";
    return (
      <div className="flex-1">
        <Navbar />
        <main className="max-w-lg mx-auto px-6 py-8">
          <div className="border border-border p-6 space-y-4">
            <p className="text-base font-medium">{isFeed ? "Feed added!" : "Monitor created!"}</p>
            <p className="text-sm text-muted-foreground">
              Want to save <span className="font-medium">{name}</span> as a reusable template?
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
          defaultName={name}
          source={
            isFeed
              ? { sourceType: "feed", feedUrl: feedUrl || undefined, urlPlaceholder: feedUrl || undefined }
              : { sourceType: "monitor", type, mode, selector: selector || undefined, clickSelector: clickSelector || undefined, urlPlaceholder: url || undefined }
          }
        />
      </div>
    );
  }

  return (
    <div className="flex-1">
      <Navbar />
      <main className="max-w-lg mx-auto px-6 py-8">
        <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => router.push("/")}>
          ← Back
        </Button>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">New Monitor</h1>
          {!activeTemplate && (
            <Link href="/templates" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Browse templates
            </Link>
          )}
        </div>

        {activeTemplate && (
          <div className="flex items-center justify-between gap-2 mb-5 px-3 py-2 border border-border bg-muted/40 text-sm">
            <span>
              <span className="mr-1.5">{activeTemplate.icon}</span>
              Using template: <span className="font-medium">{activeTemplate.name}</span>
            </span>
            <Link href="/templates" className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0">
              Change
            </Link>
          </div>
        )}

        <div className="flex gap-2 mb-6">
          <Button
            variant={mode === "standard" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("standard")}
          >
            Standard
          </Button>
          <Button
            variant={mode === "price" ? "default" : "outline"}
            size="sm"
            onClick={() => { setMode("price"); setType("webpage"); }}
          >
            Watch Price
          </Button>
          <Button
            variant={mode === "feed" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("feed")}
          >
            RSS Feed
          </Button>
        </div>

        {mode === "feed" ? (
          <form onSubmit={handleFeedSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="feed-name">Name</Label>
              <Input
                id="feed-name"
                placeholder="e.g. Hacker News, TechCrunch"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="feed-url">Feed URL</Label>
              <Input
                id="feed-url"
                type="url"
                placeholder="https://example.com/rss.xml"
                value={feedUrl}
                onChange={(e) => setFeedUrl(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">RSS or Atom feed URL</p>
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
        ) : mode === "price" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g. GPU Price on Amazon"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="url">Product URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://amazon.com/dp/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={detectPrice}
              disabled={detecting}
            >
              {detecting ? "Detecting..." : "Detect Price"}
            </Button>

            {detectedPrice && (
              <div className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm">
                Detected: <span className="font-bold">{detectedPrice}</span>
                <span className="text-muted-foreground ml-2">({selector})</span>
              </div>
            )}

            <SpaceSelectInline userId={user!.id} value={spaceId} onChange={setSpaceId} />

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => router.push("/")}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !selector}>
                {saving ? "Creating..." : "Create Monitor"}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder={type === "youtube" ? "e.g. Fireship" : "e.g. GPU Price on Amazon"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as "webpage" | "youtube")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="webpage">Web Page</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                type="url"
                placeholder={
                  type === "youtube"
                    ? "https://youtube.com/@channelname"
                    : "https://example.com/product"
                }
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>

            {type === "webpage" && (
              <div className="space-y-1.5">
                <Label htmlFor="selector">CSS Selector</Label>
                <Input
                  id="selector"
                  className="font-mono"
                  placeholder=".price, #product-price, td:nth-child(1) > a"
                  value={selector}
                  onChange={(e) => setSelector(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Right-click the element → Inspect → Copy selector
                </p>
              </div>
            )}

            {type === "webpage" && (
              <div className="space-y-1.5">
                <Label htmlFor="clickSelector">
                  Click Before <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="clickSelector"
                  className="font-mono"
                  placeholder="e.g. [data-tab='specs'], .tab-button"
                  value={clickSelector}
                  onChange={(e) => setClickSelector(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Click a tab or button before extracting the value
                </p>
              </div>
            )}

            <SpaceSelectInline userId={user!.id} value={spaceId} onChange={setSpaceId} />

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => router.push("/")}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating..." : "Create Monitor"}
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

export default function NewMonitorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>}>
      <NewMonitorForm />
    </Suspense>
  );
}
