"use client";

import { useState, useEffect, Suspense } from "react";
import { db, tx } from "@/lib/instant";
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

function EditMonitorForm() {
  const { isLoading: authLoading, user } = db.useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const monitorId = searchParams.get("id");

  const { data, isLoading: dataLoading } = db.useQuery(
    monitorId ? { monitors: { $: { where: { id: monitorId } } } } : null
  );

  const monitor = data?.monitors?.[0] as
    | {
        id: string;
        userId: string;
        name: string;
        type: string;
        url: string;
        selector?: string;
        clickSelector?: string;
      }
    | undefined;

  const [type, setType] = useState<"webpage" | "youtube">("webpage");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selector, setSelector] = useState("");
  const [clickSelector, setClickSelector] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (monitor && !loaded) {
      setType((monitor.type as "webpage" | "youtube") || "webpage");
      setName(monitor.name || "");
      setUrl(monitor.url || "");
      setSelector(monitor.selector || "");
      setClickSelector(monitor.clickSelector || "");
      setLoaded(true);
    }
  }, [monitor, loaded]);

  if (authLoading || dataLoading) {
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

  if (!monitorId || (!dataLoading && !monitor)) {
    router.push("/");
    return null;
  }

  if (monitor && monitor.userId !== user.id) {
    router.push("/");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (type === "youtube") {
      const channelMatch = url.match(/youtube\.com\/channel\/([a-zA-Z0-9_-]+)/);
      const handleMatch = url.match(/youtube\.com\/@([a-zA-Z0-9_-]+)/);
      if (!channelMatch && !handleMatch) {
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
      db.transact(
        tx.monitors[monitorId!].update({
          name: name.trim(),
          type,
          url: url.trim(),
          selector: type === "webpage" ? selector.trim() : "",
          clickSelector:
            type === "webpage" && clickSelector.trim()
              ? clickSelector.trim()
              : "",
        })
      );
      toast.success("Monitor updated!");
      router.push("/");
    } catch {
      toast.error("Failed to update monitor");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1">
      <Navbar />
      <main className="max-w-lg mx-auto px-6 py-8">
        <h1 className="text-xl font-semibold mb-6">Edit Monitor</h1>
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
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default function EditMonitorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>}>
      <EditMonitorForm />
    </Suspense>
  );
}
