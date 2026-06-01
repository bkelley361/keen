"use client";

import { db } from "@/lib/instant";

interface Space {
  id: string;
  name: string;
  color?: string;
  icon?: string;
}

interface SpaceSelectInlineProps {
  userId: string;
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
}

export function SpaceSelectInline({ userId, value, onChange, label = "Space" }: SpaceSelectInlineProps) {
  const { data } = db.useQuery(
    userId ? { spaces: { $: { where: { userId, archived: false } } } } : null
  );
  const spaces = (data?.spaces || []) as Space[];

  if (spaces.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium leading-none">{label} <span className="text-muted-foreground text-xs">(optional)</span></label>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">No space</option>
        {spaces.map((s) => (
          <option key={s.id} value={s.id}>
            {s.icon} {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
