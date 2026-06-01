"use client";

import { useState } from "react";
import { db, tx, id } from "@/lib/instant";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Send, BookOpen, Pencil, Check, X } from "lucide-react";

type ChannelType = "email" | "discord" | "slack" | "telegram";

interface NotificationChannel {
  id: string;
  userId: string;
  type: ChannelType;
  config: string;
  enabled: boolean;
  createdAt: number;
}

const CHANNEL_LABELS: Record<ChannelType, string> = {
  email: "Email",
  discord: "Discord",
  slack: "Slack",
  telegram: "Telegram",
};

const CHANNEL_ICONS: Record<ChannelType, string> = {
  email: "✉️",
  discord: "💬",
  slack: "#️⃣",
  telegram: "📨",
};

function DefaultEmailCard({ userId, userEmail }: { userId: string; userEmail: string }) {
  const { data: prefsData } = db.useQuery({ userPrefs: { $: { where: { userId } } } });
  const prefs = prefsData?.userPrefs?.[0] as { id?: string; notificationEmail?: string } | undefined;
  const currentEmail = prefs?.notificationEmail || userEmail;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setDraft(currentEmail);
    setEditing(true);
  }

  async function save() {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user/prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, notificationEmail: draft.trim() }),
      });
      if (!res.ok) throw new Error();
      toast.success("Notification email updated");
      setEditing(false);
    } catch {
      toast.error("Failed to update email");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-3 p-4 rounded-lg border border-input">
      <span className="text-xl">✉️</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Default</p>
        {editing ? (
          <Input
            type="email"
            className="h-7 text-xs mt-1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            autoFocus
          />
        ) : (
          <p className="text-xs text-muted-foreground truncate">{currentEmail}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {editing ? (
          <>
            <Button variant="ghost" size="sm" onClick={save} disabled={saving || !draft.trim()}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={startEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function AddChannelForm({ userId, onAdded }: { userId: string; onAdded: () => void }) {
  const [type, setType] = useState<ChannelType>("discord");
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function setField(key: string, value: string) {
    setConfigValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const channelId = id();
      await db.transact(
        tx.notificationChannels[channelId].update({
          userId,
          type,
          config: JSON.stringify(configValues),
          enabled: true,
          createdAt: Date.now(),
        })
      );
      toast.success("Notification channel added");
      setConfigValues({});
      onAdded();
    } catch {
      toast.error("Failed to add channel");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-input p-4">
      <h3 className="font-medium text-sm">Add Channel</h3>
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input
          placeholder="e.g. My Discord server"
          value={configValues.name || ""}
          onChange={(e) => setField("name", e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label>Type</Label>
        <div className="flex gap-2 flex-wrap">
          {(["discord", "slack", "telegram", "email"] as ChannelType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setType(t); setConfigValues({}); }}
              className={`px-3 py-1.5 rounded-md border text-sm transition-colors ${
                type === t
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input hover:bg-accent"
              }`}
            >
              {CHANNEL_ICONS[t]} {CHANNEL_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {type === "discord" && (
        <div className="space-y-1.5">
          <Label>Discord Webhook URL</Label>
          <Input
            type="url"
            placeholder="https://discord.com/api/webhooks/..."
            value={configValues.webhookUrl || ""}
            onChange={(e) => setField("webhookUrl", e.target.value)}
            required
          />
        </div>
      )}

      {type === "slack" && (
        <div className="space-y-1.5">
          <Label>Slack Webhook URL</Label>
          <Input
            type="url"
            placeholder="https://hooks.slack.com/services/..."
            value={configValues.webhookUrl || ""}
            onChange={(e) => setField("webhookUrl", e.target.value)}
            required
          />
        </div>
      )}

      {type === "telegram" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Bot Token</Label>
            <Input
              placeholder="123456:ABC-DEF..."
              value={configValues.botToken || ""}
              onChange={(e) => setField("botToken", e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Chat ID</Label>
            <Input
              placeholder="-1001234567890"
              value={configValues.chatId || ""}
              onChange={(e) => setField("chatId", e.target.value)}
              required
            />
          </div>
        </div>
      )}

      {type === "email" && (
        <div className="space-y-1.5">
          <Label>Email Address</Label>
          <Input
            type="email"
            placeholder="you@example.com"
            value={configValues.to || ""}
            onChange={(e) => setField("to", e.target.value)}
            required
          />
        </div>
      )}

      <Button type="submit" size="sm" disabled={saving}>
        {saving ? "Adding..." : "Add Channel"}
      </Button>
    </form>
  );
}

function ChannelCard({
  channel,
  userId,
}: {
  channel: NotificationChannel;
  userId: string;
}) {
  const [testing, setTesting] = useState(false);

  const config = (() => {
    try { return JSON.parse(channel.config) as Record<string, string>; }
    catch { return {}; }
  })();

  const name = config.name || null;
  const detail =
    config.webhookUrl
      ? config.webhookUrl.replace(/^https?:\/\//, "").slice(0, 50) + "..."
      : config.to || config.chatId || "Configured";

  async function handleToggle(enabled: boolean) {
    try {
      await db.transact(tx.notificationChannels[channel.id].update({ enabled }));
    } catch {
      toast.error("Failed to update");
    }
  }

  async function handleDelete() {
    try {
      await db.transact(tx.notificationChannels[channel.id].delete());
      toast.success("Channel removed");
    } catch {
      toast.error("Failed to remove channel");
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const res = await fetch(`/api/notification-channels/${channel.id}/test`, {
        method: "POST",
        headers: { "x-user-id": userId },
      });
      if (res.ok) toast.success("Test notification sent");
      else toast.error("Test failed");
    } catch {
      toast.error("Test failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="flex items-center gap-3 p-4 rounded-lg border border-input">
      <span className="text-xl">{CHANNEL_ICONS[channel.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name ?? detail}</p>
        {name && <p className="text-xs text-muted-foreground truncate">{detail}</p>}
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={channel.enabled}
          onCheckedChange={handleToggle}
        />
        <Button variant="ghost" size="sm" onClick={handleTest} disabled={testing}>
          <Send className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function NotificationTutorial() {
  return (
    <div className="rounded-lg border border-border">
      <div className="px-4 py-3 border-b border-border">
        <span className="flex items-center gap-2 text-sm font-medium">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          How notification channels work
        </span>
      </div>
      <div className="px-4 pb-4 space-y-4 text-sm pt-4">
          <p className="text-muted-foreground">
            Notification channels control where Keen sends alerts when a monitor detects a change. You can add multiple channels and they all fire in parallel.
          </p>

          <div className="space-y-2">
            <p className="font-medium">💬 Discord</p>
            <p className="text-muted-foreground">Create an incoming webhook in Discord: open your server → channel settings → Integrations → Webhooks → New Webhook. Copy the URL and paste it here. Keen sends a rich embed with the old and new values.</p>
          </div>

          <div className="space-y-2">
            <p className="font-medium">#️⃣ Slack</p>
            <p className="text-muted-foreground">Go to <code className="text-xs bg-muted px-1 py-0.5 rounded">api.slack.com/apps</code> → Create New App → Incoming Webhooks → Add New Webhook to Workspace. Paste the webhook URL here. Keen sends a Block Kit message with a link back to the monitor.</p>
          </div>

          <div className="space-y-2">
            <p className="font-medium">📨 Telegram</p>
            <p className="text-muted-foreground">
              Talk to <code className="text-xs bg-muted px-1 py-0.5 rounded">@BotFather</code> on Telegram to create a bot and get a Bot Token. Then start a chat with your bot (or add it to a group) and get the Chat ID by messaging <code className="text-xs bg-muted px-1 py-0.5 rounded">@userinfobot</code>. Enter both values here.
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-medium">✉️ Email</p>
            <p className="text-muted-foreground">Enter any email address. Keen sends a plain HTML email via the configured SMTP account whenever a change is detected. You can set a different notification email per channel if you want alerts to go to multiple addresses.</p>
          </div>

          <div className="space-y-2">
            <p className="font-medium">Quiet hours & digest mode</p>
            <p className="text-muted-foreground">
              Each channel's config supports optional fields:
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-3">
              <li><code className="bg-muted px-1 py-0.5 rounded">quietHours</code> — suppress notifications between two hours and release them when the window ends. Example: <code className="bg-muted px-1 py-0.5 rounded">{`{"start": 22, "end": 8}`}</code></li>
              <li><code className="bg-muted px-1 py-0.5 rounded">digest</code> — batch all changes and deliver at a set hour. Example: <code className="bg-muted px-1 py-0.5 rounded">{`{"enabled": true, "hour": 9}`}</code></li>
            </ul>
            <p className="text-muted-foreground text-xs">These are set on the worker side — UI controls for them are coming soon.</p>
          </div>

          <div className="space-y-1 rounded-md bg-muted/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">💡 Tip: use the <strong>Test</strong> button (paper plane icon) after adding a channel to confirm it's working before your next monitor check fires.</p>
          </div>
      </div>
    </div>
  );
}

export default function NotificationsSettingsPage() {
  const { isLoading, user } = db.useAuth();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  const { data } = db.useQuery(
    user ? { notificationChannels: { $: { where: { userId: user.id } } } } : null
  );
  const channels = (data?.notificationChannels || []) as NotificationChannel[];
  const sorted = [...channels].sort((a, b) => b.createdAt - a.createdAt);

  if (isLoading) return null;
  if (!user) { router.push("/login"); return null; }

  const userEmail = (user as unknown as { email?: string }).email ?? "";

  const channelTypes: ChannelType[] = ["email", "discord", "slack", "telegram"];
  const grouped = channelTypes
    .map((type) => ({ type, items: sorted.filter((ch) => ch.type === type) }))
    .filter(({ type, items }) => type === "email" || items.length > 0);

  return (
    <div className="flex-1">
      <Navbar />
      <main className="w-full px-6 py-4">
        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-semibold">Notifications</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Configure where to receive alerts when your monitors detect changes.
                </p>
              </div>
              <Button size="sm" onClick={() => setShowForm(!showForm)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Channel
              </Button>
            </div>

            {showForm && (
              <div className="mb-6">
                <AddChannelForm userId={user.id} onAdded={() => setShowForm(false)} />
              </div>
            )}

            <div className="space-y-6">
              {grouped.map(({ type, items }) => (
                <div key={type}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    {CHANNEL_ICONS[type]} {CHANNEL_LABELS[type]}
                  </p>
                  <div className="space-y-2">
                    {type === "email" && (
                      <DefaultEmailCard userId={user.id} userEmail={userEmail} />
                    )}
                    {items.map((ch) => (
                      <ChannelCard key={ch.id} channel={ch} userId={user.id} />
                    ))}
                  </div>
                </div>
              ))}
              {sorted.length === 0 && !showForm && (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-xs mt-1">Add Discord, Slack, Telegram, or extra email addresses to get notified when changes are detected.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowForm(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add a channel
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="w-96 shrink-0 sticky top-16 max-h-[calc(100vh-6.1rem)] overflow-y-auto self-start">
            <NotificationTutorial />
          </div>
        </div>
      </main>
    </div>
  );
}
