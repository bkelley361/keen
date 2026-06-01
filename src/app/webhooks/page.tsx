"use client";

import { useState } from "react";
import { db, tx } from "@/lib/instant";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Send,
  RefreshCw,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const ALL_EVENTS = [
  "website.changed",
  "price.dropped",
  "price.increased",
  "rss.new_item",
  "youtube.new_video",
  "monitor.error",
];

interface WebhookEndpoint {
  id: string;
  url: string;
  description?: string;
  secret: string;
  eventSubscriptions: string;
  enabled: boolean;
  createdAt: number;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  status: string;
  responseCode?: number;
  attemptCount: number;
  createdAt: number;
  lastAttemptAt?: number;
}

function AddWebhookForm({
  userId,
  onAdded,
}: {
  userId: string;
  onAdded: () => void;
}) {
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [events, setEvents] = useState<string[]>(["*"]);
  const [saving, setSaving] = useState(false);

  function toggleEvent(event: string) {
    if (event === "*") {
      setEvents(["*"]);
      return;
    }
    const without = events.filter((e) => e !== "*");
    if (without.includes(event)) {
      const next = without.filter((e) => e !== event);
      setEvents(next.length ? next : ["*"]);
    } else {
      setEvents([...without, event]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          url: url.trim(),
          description: description.trim(),
          eventSubscriptions: events,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      toast.success(
        "Webhook created! Copy the secret — it won't be shown again.",
        {
          description: `Secret: ${data.secret}`,
          duration: 15000,
        },
      );
      setUrl("");
      setDescription("");
      setEvents(["*"]);
      onAdded();
    } catch {
      toast.error("Failed to create webhook");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-input p-4"
    >
      <h3 className="font-medium text-sm">Add Endpoint</h3>
      <div className="space-y-1.5">
        <Label htmlFor="webhook-url">URL</Label>
        <Input
          id="webhook-url"
          type="url"
          placeholder="https://example.com/webhook"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="webhook-desc">
          Description <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="webhook-desc"
          placeholder="e.g. Discord bot"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Events</Label>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "*", label: "All events" },
            ...ALL_EVENTS.map((ev) => ({ id: ev, label: ev })),
          ].map(({ id, label }) => {
            const checked =
              id === "*" ? events.includes("*") : events.includes(id);
            return (
              <label
                key={id}
                className="flex items-center gap-1.5 text-sm cursor-pointer select-none"
              >
                <span
                  onClick={() => toggleEvent(id)}
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                    checked
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-input bg-background hover:border-primary/60"
                  }`}
                >
                  {checked && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path
                        d="M1 4L3.5 6.5L9 1"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span onClick={() => toggleEvent(id)}>{label}</span>
              </label>
            );
          })}
        </div>
      </div>
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? "Creating..." : "Create Endpoint"}
      </Button>
    </form>
  );
}

function DeliveryStatusBadge({ status }: { status: string }) {
  if (status === "delivered")
    return (
      <Badge className="bg-green-500/10 text-green-600 border-green-200">
        delivered
      </Badge>
    );
  if (status === "failed")
    return (
      <Badge className="bg-red-500/10 text-red-600 border-red-200">
        failed
      </Badge>
    );
  return <Badge variant="secondary">{status}</Badge>;
}

function EndpointCard({
  endpoint,
  userId,
}: {
  endpoint: WebhookEndpoint;
  userId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data } = db.useQuery(
    expanded
      ? { webhookDeliveries: { $: { where: { webhookId: endpoint.id } } } }
      : null,
  );
  const deliveries = (data?.webhookDeliveries || []) as WebhookDelivery[];
  const sorted = [...deliveries]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 20);

  async function handleTest() {
    setTesting(true);
    try {
      const res = await fetch(`/api/webhooks/${endpoint.id}/test`, {
        method: "POST",
        headers: { "x-user-id": userId },
      });
      const data = await res.json();
      if (data.ok) toast.success(`Test delivered (HTTP ${data.status})`);
      else toast.error(`Test failed (HTTP ${data.status || "no response"})`);
    } catch {
      toast.error("Test request failed");
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await db.transact(tx.webhookEndpoints[endpoint.id].delete());
      toast.success("Endpoint deleted");
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  async function handleReplay(deliveryId: string) {
    try {
      const res = await fetch(
        `/api/webhooks/${endpoint.id}/replay/${deliveryId}`,
        {
          method: "POST",
          headers: { "x-user-id": userId },
        },
      );
      const data = await res.json();
      if (data.ok) toast.success(`Replayed (HTTP ${data.status})`);
      else toast.error(`Replay failed (HTTP ${data.status || "no response"})`);
    } catch {
      toast.error("Replay failed");
    }
  }

  const subs = (() => {
    try {
      return JSON.parse(endpoint.eventSubscriptions) as string[];
    } catch {
      return ["*"];
    }
  })();

  return (
    <div className="rounded-lg border border-input overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div className="flex-1 min-w-0">
          {endpoint.description && (
            <p className="text-sm font-medium truncate">{endpoint.description}</p>
          )}
          <p className="font-mono text-xs text-muted-foreground truncate mt-0.5">{endpoint.url}</p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {subs.map((s) => (
              <Badge key={s} variant="secondary" className="text-xs">
                {s}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTest}
            disabled={testing}
          >
            <Send className="h-3.5 w-3.5 mr-1" />
            {testing ? "Sending..." : "Test"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-input p-4">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">
            Delivery Log
          </h4>
          {sorted.length === 0 ? (
            <p className="text-xs text-muted-foreground">No deliveries yet.</p>
          ) : (
            <div className="space-y-2">
              {sorted.map((d) => (
                <div key={d.id} className="flex items-center gap-3 text-xs">
                  <DeliveryStatusBadge status={d.status} />
                  <span className="text-muted-foreground">
                    {new Date(d.createdAt).toLocaleString()}
                  </span>
                  {d.responseCode && (
                    <span className="text-muted-foreground">
                      HTTP {d.responseCode}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    attempt {d.attemptCount}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 ml-auto"
                    onClick={() => handleReplay(d.id)}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Replay
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WebhookTutorial() {
  return (
    <div className="rounded-lg border border-border">
      <div className="px-4 py-3 border-b border-border">
        <span className="flex items-center gap-2 text-sm font-medium">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          How webhooks work
        </span>
      </div>
      <div className="px-4 pb-4 space-y-4 text-sm pt-4">
        <p className="text-muted-foreground">
          When a monitor detects a change, Keen sends an HTTP POST to your
          endpoint with a JSON payload describing what changed.
        </p>

        <div className="space-y-1">
          <p className="font-medium">1. Add an endpoint</p>
          <p className="text-muted-foreground">
            Point Keen at any URL that can accept a POST request — a Discord
            bot, a Slack app, a Make/Zapier webhook, or your own server.
          </p>
        </div>

        <div className="space-y-1">
          <p className="font-medium">2. Choose events</p>
          <p className="text-muted-foreground">
            Subscribe to specific event types or use{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">*</code> to
            receive everything. Available events:
          </p>
          <ul className="text-xs text-muted-foreground space-y-0.5 mt-1 ml-3">
            <li>
              <code className="bg-muted px-1 py-0.5 rounded">
                website.changed
              </code>{" "}
              — a webpage monitor value changed
            </li>
            <li>
              <code className="bg-muted px-1 py-0.5 rounded">
                price.dropped
              </code>{" "}
              /{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                price.increased
              </code>{" "}
              — price moved
            </li>
            <li>
              <code className="bg-muted px-1 py-0.5 rounded">rss.new_item</code>{" "}
              — new RSS article published
            </li>
            <li>
              <code className="bg-muted px-1 py-0.5 rounded">
                youtube.new_video
              </code>{" "}
              — new YouTube video uploaded
            </li>
            <li>
              <code className="bg-muted px-1 py-0.5 rounded">
                monitor.error
              </code>{" "}
              — a check failed
            </li>
          </ul>
        </div>

        <div className="space-y-1">
          <p className="font-medium">3. Verify the signature</p>
          <p className="text-muted-foreground">
            Every delivery includes three headers you can use to verify
            authenticity:
          </p>
          <div className="bg-muted rounded p-3 font-mono text-xs space-y-1 mt-1 overflow-x-auto break-all">
            <p>X-Keen-Signature: sha256=&lt;hmac&gt;</p>
            <p>X-Keen-Event: website.changed</p>
            <p>X-Keen-Timestamp: 1716900000</p>
          </div>
          <p className="text-muted-foreground text-xs mt-1">
            Compute{" "}
            <code className="bg-muted px-1 py-0.5 rounded">
              HMAC-SHA256(secret, rawBody)
            </code>{" "}
            and compare it to the signature header to confirm the payload came
            from Keen.
          </p>
        </div>

        <div className="space-y-1">
          <p className="font-medium">4. Payload shape</p>
          <div className="bg-muted rounded p-3 font-mono text-xs mt-1 overflow-x-auto">
            <pre className="whitespace-pre-wrap break-all">{`{
  "event": "price.dropped",
  "timestamp": "2026-05-28T12:00:00Z",
  "monitorId": "abc123",
  "source": { "type": "webpage", "url": "https://..." },
  "changes": { "oldValue": "$299", "newValue": "$249" }
}`}</pre>
          </div>
        </div>

        <div className="space-y-1">
          <p className="font-medium">5. Retries</p>
          <p className="text-muted-foreground">
            If your endpoint returns a non-2xx response, Keen retries up to 3
            times with exponential backoff (30 s → 5 min → 1 hr). You can also
            replay any delivery manually from the log.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function WebhooksPage() {
  const { isLoading, user } = db.useAuth();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  const { data } = db.useQuery(
    user ? { webhookEndpoints: { $: { where: { userId: user.id } } } } : null,
  );
  const endpoints = (data?.webhookEndpoints || []) as WebhookEndpoint[];
  const sorted = [...endpoints].sort((a, b) => b.createdAt - a.createdAt);

  if (isLoading) return null;
  if (!user) {
    router.push("/login");
    return null;
  }

  return (
    <div className="flex-1">
      <Navbar />
      <main className="w-full px-6 py-4">
        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-semibold">Webhooks</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Receive real-time events when your monitors detect changes.
                </p>
              </div>
              <Button size="sm" onClick={() => setShowForm(!showForm)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Endpoint
              </Button>
            </div>

            {showForm && (
              <div className="mb-6">
                <AddWebhookForm
                  userId={user.id}
                  onAdded={() => setShowForm(false)}
                />
              </div>
            )}

            {sorted.length === 0 && !showForm ? (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-sm">No webhook endpoints yet.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowForm(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add your first endpoint
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {sorted.map((ep) => (
                  <EndpointCard
                    key={ep.id}
                    endpoint={ep}
                    userId={user.id}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="w-96 shrink-0 sticky top-16 max-h-[calc(100vh-6.1rem)] overflow-y-auto self-start">
            <WebhookTutorial />
          </div>
        </div>
      </main>
    </div>
  );
}
