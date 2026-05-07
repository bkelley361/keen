"use client";

import { db, tx, id as instantId } from "@/lib/instant";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Settings, LogOut, Mail, ImageOff, Sun, Moon, ArrowUpDown, Copy, RefreshCw, Search } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Menu } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";

const itemClass = "flex cursor-pointer select-none items-center justify-between gap-2 px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground";
const sectionLabelClass = "px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground";

function ChangeEmailDialog({
  userId,
  currentEmail,
  notificationEmail,
  onClose,
}: {
  userId: string;
  currentEmail: string;
  notificationEmail: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState(notificationEmail || currentEmail);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/user/prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, notificationEmail: email }),
      });
      if (!res.ok) throw new Error();
      toast.success("Notification email updated");
      onClose();
    } catch {
      toast.error("Failed to update email");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="notif-email">Notification email</Label>
        <Input
          id="notif-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={currentEmail}
        />
        <p className="text-xs text-muted-foreground">
          Change alerts will be sent here instead of your login email.
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving || !email}>
          Save
        </Button>
      </div>
    </div>
  );
}

function SettingsMenu({ userId, userEmail }: { userId: string; userEmail: string }) {
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [feedToken, setFeedToken] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);

  const { data: prefsData } = db.useQuery({
    userPrefs: { $: { where: { userId } } },
  });
  const prefs = prefsData?.userPrefs?.[0] as { notificationEmail?: string; hideThumbnails?: boolean; cardSort?: string } | undefined;
  const notificationEmail = prefs?.notificationEmail ?? "";
  const hideThumbnails = prefs?.hideThumbnails ?? false;
  const cardSort = (prefs?.cardSort ?? "added") as "added" | "name" | "last-checked" | "status";

  const { theme, setTheme } = useTheme();

  const prefsId = (prefsData?.userPrefs?.[0] as { id?: string } | undefined)?.id;

  function savePref(update: Record<string, unknown>) {
    const recordId = prefsId ?? instantId();
    db.transact(tx.userPrefs[recordId].update({ userId, ...update }));
  }

  const sortLabels: Record<string, string> = {
    added: "Added",
    name: "Name",
    "last-checked": "Last checked",
    status: "Status",
  };
  const sortCycle: Array<"added" | "name" | "last-checked" | "status"> = ["added", "name", "last-checked", "status"];

  const feedUrl = feedToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/feed/${feedToken}`
    : "";

  async function loadFeedToken(regenerate = false) {
    setFeedLoading(true);
    try {
      const res = await fetch("/api/feed-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, regenerate }),
      });
      const data = await res.json();
      if (data.token) setFeedToken(data.token);
      else toast.error("Failed to load feed URL");
    } catch {
      toast.error("Failed to load feed URL");
    } finally {
      setFeedLoading(false);
    }
  }

  function copyFeedUrl() {
    if (!feedUrl) return;
    navigator.clipboard.writeText(feedUrl);
    toast.success("Feed URL copied");
  }

  async function regenerateFeed() {
    if (!confirm("Regenerate feed URL? The old URL will stop working.")) return;
    await loadFeedToken(true);
    toast.success("New feed URL generated");
  }

  return (
    <>
      <Menu.Root
        onOpenChange={(open) => {
          if (open && !feedToken) loadFeedToken(false);
        }}
      >
        <Menu.Trigger
          render={
            <Button variant="outline" size="default">
              <Settings className="h-4 w-4" />
            </Button>
          }
        />
        <Menu.Portal>
          <Menu.Positioner sideOffset={6} align="end" style={{ zIndex: 9999 }}>
            <Menu.Popup
              className={cn(
                "min-w-52 overflow-hidden border border-border bg-popover p-1 text-popover-foreground shadow-sm",
                "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
                "origin-[var(--transform-origin)] transition-opacity duration-100"
              )}
            >
              {/* Account header */}
              <div className="px-2 py-1.5 text-xs text-muted-foreground border-b border-border mb-1 truncate">
                {notificationEmail || userEmail}
              </div>

              {/* Account section */}
              <div className={sectionLabelClass}>Account</div>
              <Menu.Item
                closeOnClick={false}
                className={itemClass}
                onClick={() => setEmailDialogOpen(true)}
              >
                <span className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Notification email
                </span>
              </Menu.Item>

              {/* RSS Feed section */}
              <div className="-mx-1 my-1 h-px bg-border" />
              <div className={sectionLabelClass}>RSS Feed</div>
              <div className="px-2 py-1.5 space-y-2" onMouseDown={(e) => e.preventDefault()}>
                <Input
                  value={feedLoading ? "Loading..." : (feedUrl || "—")}
                  readOnly
                  onFocus={(e) => e.currentTarget.select()}
                  className="font-mono text-xs h-7"
                  tabIndex={-1}
                />
                <div className="flex gap-1.5">
                  <button
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1 text-xs border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
                    onClick={copyFeedUrl}
                    tabIndex={-1}
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </button>
                  <button
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1 text-xs border border-border hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
                    onClick={regenerateFeed}
                    disabled={feedLoading}
                    tabIndex={-1}
                  >
                    <RefreshCw className={`h-3 w-3 ${feedLoading ? "animate-spin" : ""}`} />
                    Regenerate
                  </button>
                </div>
              </div>

              {/* Display section */}
              <div className="-mx-1 my-1 h-px bg-border" />
              <div className={sectionLabelClass}>Display</div>
              <Menu.Item
                closeOnClick={false}
                className={itemClass}
                onClick={() => savePref({ hideThumbnails: !hideThumbnails })}
              >
                <span className="flex items-center gap-2">
                  <ImageOff className="h-4 w-4" />
                  Hide YT thumbnails
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded-sm font-medium ${hideThumbnails ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {hideThumbnails ? "On" : "Off"}
                </span>
              </Menu.Item>
              <Menu.Item
                closeOnClick={false}
                className={itemClass}
                onClick={() => {
                  const next = sortCycle[(sortCycle.indexOf(cardSort) + 1) % sortCycle.length];
                  savePref({ cardSort: next });
                }}
              >
                <span className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4" />
                  Sort cards
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded-sm font-medium bg-muted text-muted-foreground">
                  {sortLabels[cardSort]}
                </span>
              </Menu.Item>
              <Menu.Item
                closeOnClick={false}
                className={itemClass}
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                <span className="flex items-center gap-2">
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  Theme
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded-sm font-medium bg-muted text-muted-foreground capitalize">
                  {theme ?? "system"}
                </span>
              </Menu.Item>

              {/* Sign out */}
              <div className="-mx-1 my-1 h-px bg-border" />
              <Menu.Item
                className={cn(itemClass, "text-destructive data-[highlighted]:text-destructive")}
                onClick={() => db.auth.signOut()}
              >
                <span className="flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </span>
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Notification email</DialogTitle>
            <DialogDescription>
              Set a different email address to receive change alerts.
            </DialogDescription>
          </DialogHeader>
          <ChangeEmailDialog
            userId={userId}
            currentEmail={userEmail}
            notificationEmail={notificationEmail}
            onClose={() => setEmailDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function GlobalSearch({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { data: feedsData } = db.useQuery({ feeds: { $: { where: { userId } } } });
  const { data: monitorsData } = db.useQuery({ monitors: { $: { where: { userId } } } });
  const { data: itemsData } = db.useQuery({ feedItems: { $: { where: {} } } });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const q = query.trim().toLowerCase();

  const feedResults = q
    ? (feedsData?.feeds || []).filter((f) => {
        const feed = f as unknown as { name: string; feedUrl: string; tags?: string };
        return feed.name.toLowerCase().includes(q) || feed.feedUrl.toLowerCase().includes(q) || (feed.tags ?? "").toLowerCase().includes(q);
      })
    : [];

  const monitorResults = q
    ? (monitorsData?.monitors || []).filter((m) => {
        const mon = m as unknown as { name: string; url: string; tags?: string };
        return mon.name.toLowerCase().includes(q) || mon.url.toLowerCase().includes(q) || (mon.tags ?? "").toLowerCase().includes(q);
      })
    : [];

  const feedMap = new Map((feedsData?.feeds || []).map((f) => [f.id, f.name as string]));

  const articleResults = q
    ? (itemsData?.feedItems || [])
        .filter((i) => {
          const item = i as unknown as { title: string; feedId: string };
          return item.title.toLowerCase().includes(q);
        })
        .slice(0, 20)
    : [];

  const hasResults = feedResults.length > 0 || monitorResults.length > 0 || articleResults.length > 0;

  return (
    <>
      <Button variant="outline" size="default" onClick={() => setOpen(true)}>
        <Search className="h-4 w-4" />
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="absolute left-1/2 top-[12%] -translate-x-1/2 w-full max-w-lg px-4">
            {/* Search input — fixed position, never moves */}
            <div className="flex items-center gap-2 border border-border bg-popover px-3 shadow-lg">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
                placeholder="Search feeds, monitors, articles..."
                className="flex-1 py-3 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </div>

            {/* Results — appear below, don't affect input position */}
            <div className="border border-t-0 border-border bg-popover shadow-lg max-h-[50vh] overflow-y-auto">
              {!q && (
                <p className="text-sm text-muted-foreground text-center py-8">Start typing to search</p>
              )}
              {q && !hasResults && (
                <p className="text-sm text-muted-foreground text-center py-8">No results for &quot;{query}&quot;</p>
              )}
              {monitorResults.length > 0 && (
                <div>
                  <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Monitors</p>
                  {monitorResults.map((m) => {
                    const monitor = m as unknown as { id: string; name: string; url: string; lastStatus?: string };
                    return (
                      <button
                        key={monitor.id}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                        onClick={() => { setOpen(false); router.push("/"); }}
                      >
                        <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${monitor.lastStatus === "error" ? "bg-red-500" : monitor.lastStatus === "changed" ? "bg-amber-500" : "bg-green-500"}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{monitor.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{monitor.url}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {feedResults.length > 0 && (
                <div>
                  <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Feeds</p>
                  {feedResults.map((f) => {
                    const feed = f as unknown as { id: string; name: string; feedUrl: string };
                    return (
                      <button
                        key={feed.id}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                        onClick={() => { setOpen(false); router.push(`/feeds/${feed.id}`); }}
                      >
                        <span className="inline-block h-2 w-2 rounded-full shrink-0 bg-blue-500" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{feed.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{feed.feedUrl}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {articleResults.length > 0 && (
                <div>
                  <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Articles</p>
                  {articleResults.map((i) => {
                    const item = i as unknown as { id: string; title: string; feedId: string; read: boolean };
                    return (
                      <button
                        key={item.id}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                        onClick={() => { setOpen(false); router.push(`/feeds/${item.feedId}/article?item=${item.id}`); }}
                      >
                        <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${item.read ? "bg-muted-foreground/30" : "bg-orange-500"}`} />
                        <div className="min-w-0">
                          <p className={`text-sm truncate ${item.read ? "font-normal text-muted-foreground" : "font-medium"}`}>{item.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{feedMap.get(item.feedId) ?? "Unknown feed"}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RefreshAllButton({ userId }: { userId: string }) {
  const [refreshing, setRefreshing] = useState(false);

  const { data: feedsData } = db.useQuery({
    feeds: { $: { where: { userId } } },
  });

  const { data: monitorsData } = db.useQuery({
    monitors: { $: { where: { userId, active: true } } },
  });

  async function refreshAll() {
    setRefreshing(true);
    try {
      const feeds = feedsData?.feeds || [];
      const monitors = monitorsData?.monitors || [];

      const [feedResults, monitorResults] = await Promise.all([
        Promise.all(
          feeds.map((feed) =>
            fetch("/api/feeds/fetch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ feedId: feed.id, userId }),
            }).then((r) => r.json()).catch(() => ({ added: 0 }))
          )
        ),
        Promise.all(
          monitors.map((monitor) =>
            fetch("/api/monitors/check", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ monitorId: monitor.id, userId }),
            }).then((r) => r.json()).catch(() => ({ changed: false }))
          )
        ),
      ]);

      const newArticles = feedResults.reduce((sum, r) => sum + (r.added || 0), 0);
      const changes = monitorResults.filter((r) => r.changed).length;

      if (newArticles > 0 || changes > 0) {
        const parts = [];
        if (changes > 0) parts.push(`${changes} monitor change${changes !== 1 ? "s" : ""}`);
        if (newArticles > 0) parts.push(`${newArticles} new article${newArticles !== 1 ? "s" : ""}`);
        toast.success(parts.join(" · "));
      } else {
        toast.info("Everything is up to date");
      }
    } catch {
      toast.error("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Button variant="outline" size="default" onClick={refreshAll} disabled={refreshing}>
      <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
    </Button>
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
        <div className="flex items-center gap-2">
          {user && (
            <>
              <GlobalSearch userId={user.id} />
              <RefreshAllButton userId={user.id} />
              <SettingsMenu userId={user.id} userEmail={user.email ?? ""} />
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
