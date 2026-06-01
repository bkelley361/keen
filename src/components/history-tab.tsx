"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/instant";
import { Button } from "@/components/ui/button";
import { DiffViewer } from "@/components/diff-viewer";
import { PriceGraph } from "@/components/price-graph";
import { Clock, GitCompare } from "lucide-react";

interface Snapshot {
  id: string;
  monitorId: string;
  contentHash: string;
  contentText?: string;
  numericValue?: number;
  createdAt: number;
}

interface HistoryTabProps {
  monitorId: string;
  monitorType: string;
  userId: string;
}

export function HistoryTab({ monitorId, monitorType, userId }: HistoryTabProps) {
  const [selectedA, setSelectedA] = useState<string | null>(null);
  const [selectedB, setSelectedB] = useState<string | null>(null);
  const [diff, setDiff] = useState<Array<{ type: string; text: string }> | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  const { data } = db.useQuery({
    snapshots: { $: { where: { monitorId } } },
  });

  const snapshots = (data?.snapshots || []) as Snapshot[];
  const sorted = [...snapshots].sort((a, b) => b.createdAt - a.createdAt);

  const isPriceMonitor =
    monitorType === "webpage" && sorted.some((s) => s.numericValue !== undefined);

  // Auto-select the two most recent for comparison
  useEffect(() => {
    if (sorted.length >= 2 && !selectedA && !selectedB) {
      setSelectedA(sorted[1].id);
      setSelectedB(sorted[0].id);
    }
  }, [sorted.length]);

  async function fetchDiff() {
    if (!selectedA || !selectedB) return;
    setLoadingDiff(true);
    try {
      const res = await fetch(
        `/api/monitors/${monitorId}/diff?a=${selectedA}&b=${selectedB}`,
        { headers: { "x-user-id": userId } }
      );
      const data = await res.json();
      setDiff(data.diff || null);
    } catch {
      setDiff(null);
    } finally {
      setLoadingDiff(false);
    }
  }

  useEffect(() => {
    if (selectedA && selectedB) {
      fetchDiff();
    }
  }, [selectedA, selectedB]);

  if (sorted.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        No change history yet. History is recorded each time a change is detected.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isPriceMonitor && (
        <div>
          <h4 className="text-sm font-medium mb-2">Price History</h4>
          <PriceGraph snapshots={sorted} />
        </div>
      )}

      {monitorType === "webpage" && sorted.length >= 2 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Compare Snapshots</h4>
          <div className="flex gap-2 mb-3 text-sm">
            <select
              value={selectedA || ""}
              onChange={(e) => setSelectedA(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              {sorted.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.createdAt).toLocaleString()}
                </option>
              ))}
            </select>
            <span className="flex items-center text-muted-foreground">→</span>
            <select
              value={selectedB || ""}
              onChange={(e) => setSelectedB(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              {sorted.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.createdAt).toLocaleString()}
                </option>
              ))}
            </select>
          </div>
          {loadingDiff ? (
            <p className="text-sm text-muted-foreground">Computing diff...</p>
          ) : diff ? (
            <DiffViewer diff={diff as Array<{ type: "added" | "removed" | "unchanged"; text: string }>} />
          ) : null}
        </div>
      )}

      <div>
        <h4 className="text-sm font-medium mb-2">Timeline</h4>
        <div className="space-y-2">
          {sorted.map((snapshot) => (
            <div
              key={snapshot.id}
              className="flex items-start gap-3 text-sm p-2 rounded-md hover:bg-accent/50"
            >
              <Clock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-muted-foreground text-xs">
                  {new Date(snapshot.createdAt).toLocaleString()}
                </p>
                {snapshot.numericValue !== undefined ? (
                  <p className="font-medium">${snapshot.numericValue.toFixed(2)}</p>
                ) : snapshot.contentText ? (
                  <p className="truncate text-muted-foreground">{snapshot.contentText}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
