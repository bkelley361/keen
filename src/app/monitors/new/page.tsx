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

  const [mode, setMode] = useState<"standard" | "price">("standard");
  const [type, setType] = useState<"webpage" | "youtube">("webpage");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selector, setSelector] = useState("");
  const [clickSelector, setClickSelector] = useState("");
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectedPrice, setDetectedPrice] = useState<string | null>(null);

  useEffect(() => {
    const paramUrl = searchParams.get("url");
    const paramSelector = searchParams.get("selector");
    const paramName = searchParams.get("name");

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
          createdAt: Date.now(),
        })
      );
      toast.success("Monitor created!");
      router.push("/");
    } catch {
      toast.error("Failed to create monitor");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1">
      <Navbar />
      <main className="max-w-lg mx-auto px-6 py-8">
        <h1 className="text-xl font-semibold mb-6">New Monitor</h1>

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
        </div>

        {mode === "price" ? (
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
