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
import { Settings, LogOut, Mail, ImageOff, Sun, Moon, ArrowUpDown, Copy, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTheme } from "next-themes";
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

export function Navbar() {
  const { user } = db.useAuth();

  return (
    <nav className="border-b border-border bg-background sticky top-0 z-50">
      <div className="w-full px-6 h-16 flex items-center justify-between">
        <Link href="/" className="font-bold text-2xl tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>
          Keen
        </Link>
        <div className="flex items-center gap-4">
          {user && (
            <SettingsMenu userId={user.id} userEmail={user.email ?? ""} />
          )}
        </div>
      </div>
    </nav>
  );
}
