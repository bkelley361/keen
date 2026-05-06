"use client";

import { db, tx } from "@/lib/instant";
import { X } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function timeAgo(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface NotifRow {
  id: string;
  monitorId: string;
  oldValue?: string;
  newValue?: string;
  sentAt?: number;
  kind?: string;
}

type FilterKind = "all" | "video" | "short" | "post" | "webpage";

const FILTERS: { value: FilterKind; label: string }[] = [
  { value: "all", label: "All" },
  { value: "video", label: "Video" },
  { value: "short", label: "Short" },
  { value: "post", label: "Post" },
  { value: "webpage", label: "Web" },
];

export function ActivityFeed({ userId }: { userId: string }) {
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [filter, setFilter] = useState<FilterKind>("all");

  const { data } = db.useQuery({
    monitors: { $: { where: { userId } } },
  });

  const monitors = data?.monitors || [];
  const monitorIds = monitors.map((m) => m.id);

  const { data: notifData } = db.useQuery({
    notifications: {
      $: {
        order: { serverCreatedAt: "desc" },
        limit: 30,
      },
    },
  });

  const monitorMap = new Map(monitors.map((m) => [m.id, m]));
  const allNotifications = (notifData?.notifications || []).filter((n) =>
    monitorIds.includes((n as unknown as { monitorId: string }).monitorId)
  );
  const notifications = allNotifications.filter((n) => {
    if (filter === "all") return true;
    const k = (n as unknown as NotifRow).kind;
    if (filter === "webpage") return !k || k === "webpage";
    return k === filter;
  });

  function confirmDelete() {
    if (!pendingDelete) return;
    db.transact(tx.notifications[pendingDelete.id].delete());
    setPendingDelete(null);
  }

  return (
    <div className="lg:sticky lg:top-6 lg:border-l lg:border-border lg:pl-6">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 hidden lg:block">
        Recent Activity
      </h3>
      <div className="flex gap-1 mb-2 flex-wrap">
        {FILTERS.map((f) => {
          const count =
            f.value === "all"
              ? allNotifications.length
              : allNotifications.filter((n) => {
                  const k = (n as unknown as NotifRow).kind;
                  if (f.value === "webpage") return !k || k === "webpage";
                  return k === f.value;
                }).length;
          if (f.value !== "all" && count === 0) return null;
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`text-[10px] px-2 py-0.5 rounded-none border transition-colors font-semibold tracking-wide uppercase ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              {f.label}
              {count > 0 && <span className="ml-1 opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>
      <div className="lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto overflow-x-hidden space-y-1">
        {notifications.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">
            No changes detected yet
          </p>
        ) : (
          notifications.map((n) => {
            const notif = n as unknown as NotifRow;
            const monitor = monitorMap.get(notif.monitorId) as
              | Record<string, unknown>
              | undefined;
            const monitorName = (monitor?.name as string) || "Unknown";
            return (
              <div
                key={notif.id}
                role="button"
                tabIndex={0}
                onClick={() =>
                  setPendingDelete({ id: notif.id, name: monitorName })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setPendingDelete({ id: notif.id, name: monitorName });
                  }
                }}
                className="group relative py-1.5 lg:pr-6 border-b border-border/30 last:border-0 cursor-pointer hover:bg-muted/40 -mx-1 px-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-medium break-words min-w-0 flex-1">
                    {monitorName}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                    {notif.sentAt ? timeAgo(notif.sentAt) : ""}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
                  <span className="text-red-400/70 line-through">
                    {notif.oldValue || "(empty)"}
                  </span>
                  {" → "}
                  <span className="text-green-400 font-medium">
                    {notif.newValue}
                  </span>
                </div>
                <span
                  aria-hidden="true"
                  className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 p-1 text-muted-foreground/60 group-hover:text-destructive items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                >
                  <X className="h-3 w-3" />
                </span>
              </div>
            );
          })
        )}
      </div>

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <DialogContent className="max-w-[20rem] sm:max-w-sm p-4">
          <DialogHeader>
            <DialogTitle className="text-base">Delete activity?</DialogTitle>
            <DialogDescription className="text-xs">
              Remove this change record from {pendingDelete?.name}&apos;s
              history.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPendingDelete(null)}
            >
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
