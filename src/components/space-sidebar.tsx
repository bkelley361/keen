"use client";

import { useState } from "react";
import { db, tx, id } from "@/lib/instant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, ChevronDown, ChevronRight, Settings, Archive } from "lucide-react";

const SPACE_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6",
];

const SPACE_ICONS = ["📁", "⭐", "🎮", "💻", "🏠", "📚", "🎯", "🔬", "💼", "🌍"];

interface Space {
  id: string;
  userId: string;
  name: string;
  color?: string;
  icon?: string;
  archived?: boolean;
  createdAt: number;
}

interface SpaceSidebarProps {
  userId: string;
  selectedSpaceId: string | null;
  onSelectSpace: (id: string | null) => void;
  collapsedSpaces: Set<string>;
  onToggleCollapse: (id: string) => void;
}

function NewSpaceForm({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(SPACE_COLORS[0]);
  const [icon, setIcon] = useState("📁");
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const spaceId = id();
      await db.transact(
        tx.spaces[spaceId].update({
          userId,
          name: name.trim(),
          color,
          icon,
          archived: false,
          createdAt: Date.now(),
        })
      );
      toast.success("Space created");
      onDone();
    } catch {
      toast.error("Failed to create space");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleCreate} className="p-2 space-y-2">
      <Input
        placeholder="Space name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-7 text-sm"
        autoFocus
      />
      <div className="flex flex-wrap gap-1">
        {SPACE_ICONS.map((ic) => (
          <button
            key={ic}
            type="button"
            onClick={() => setIcon(ic)}
            className={`text-base rounded p-0.5 ${icon === ic ? "ring-2 ring-primary" : ""}`}
          >
            {ic}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {SPACE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={`h-5 w-5 rounded-full ${color === c ? "ring-2 ring-offset-1 ring-primary" : ""}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex gap-1">
        <Button type="submit" size="sm" className="h-7 text-xs flex-1" disabled={saving}>
          {saving ? "Creating..." : "Create"}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function SpaceSidebar({
  userId,
  selectedSpaceId,
  onSelectSpace,
  collapsedSpaces,
  onToggleCollapse,
}: SpaceSidebarProps) {
  const [showNewForm, setShowNewForm] = useState(false);

  const { data } = db.useQuery(
    userId ? { spaces: { $: { where: { userId, archived: false } } } } : null
  );
  const spaces = (data?.spaces || []) as Space[];
  const sorted = [...spaces].sort((a, b) => a.createdAt - b.createdAt);

  return (
    <nav className="w-52 shrink-0 space-y-0.5">
      <button
        onClick={() => onSelectSpace(null)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
          selectedSpaceId === null
            ? "bg-accent text-accent-foreground font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
        }`}
      >
        All monitors
      </button>

      {sorted.map((space) => {
        const isSelected = selectedSpaceId === space.id;
        const isCollapsed = collapsedSpaces.has(space.id);
        return (
          <div key={space.id}>
            <button
              onClick={() => onSelectSpace(space.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors group ${
                isSelected
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse(space.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
              <span
                className="text-base leading-none"
                style={{ color: space.color || undefined }}
              >
                {space.icon || "📁"}
              </span>
              <span className="flex-1 text-left truncate">{space.name}</span>
            </button>
          </div>
        );
      })}

      <div className="pt-1">
        {showNewForm ? (
          <NewSpaceForm userId={userId} onDone={() => setShowNewForm(false)} />
        ) : (
          <button
            onClick={() => setShowNewForm(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <Plus className="h-3 w-3" />
            New Space
          </button>
        )}
      </div>
    </nav>
  );
}
