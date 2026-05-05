"use client";

import { db } from "@/lib/instant";

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

export function ActivityFeed({ userId }: { userId: string }) {
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
  const notifications = (notifData?.notifications || []).filter((n) =>
    monitorIds.includes((n as unknown as { monitorId: string }).monitorId)
  );

  return (
    <div className="lg:sticky lg:top-6 lg:border-l lg:border-border/50 lg:pl-6">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Recent Activity
      </h3>
      <div className="max-h-[calc(100vh-12rem)] overflow-y-auto space-y-1">
        {notifications.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">
            No changes detected yet
          </p>
        ) : (
          notifications.map((n) => {
            const notif = n as unknown as {
              id: string;
              monitorId: string;
              oldValue?: string;
              newValue?: string;
              sentAt?: number;
            };
            const monitor = monitorMap.get(notif.monitorId);
            return (
              <div
                key={notif.id}
                className="py-1.5 border-b border-border/30 last:border-0"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium truncate">
                    {(monitor as Record<string, unknown>)?.name as string || "Unknown"}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                    {notif.sentAt ? timeAgo(notif.sentAt) : ""}
                  </span>
                </div>
                <div className="text-[11px] truncate text-muted-foreground">
                  <span className="text-red-400/70 line-through">
                    {notif.oldValue || "(empty)"}
                  </span>
                  {" → "}
                  <span className="text-green-400 font-medium">
                    {notif.newValue}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
