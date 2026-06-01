"use client";

import { useState } from "react";
import { db, tx } from "@/lib/instant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Settings } from "lucide-react";

const SPACE_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6",
];

const SPACE_ICONS = ["📁", "⭐", "🎮", "💻", "🏠", "📚", "🎯", "🔬", "💼", "🌍"];

interface SpaceSettingsDialogProps {
  space: {
    id: string;
    name: string;
    color?: string;
    icon?: string;
    archived?: boolean;
  };
}

export function SpaceSettingsDialog({ space }: SpaceSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(space.name);
  const [color, setColor] = useState(space.color || SPACE_COLORS[0]);
  const [icon, setIcon] = useState(space.icon || "📁");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await db.transact(
        tx.spaces[space.id].update({ name: name.trim(), color, icon })
      );
      toast.success("Space updated");
      setOpen(false);
    } catch {
      toast.error("Failed to update space");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    try {
      await db.transact(tx.spaces[space.id].update({ archived: true }));
      toast.success("Space archived");
      setOpen(false);
    } catch {
      toast.error("Failed to archive space");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7" />}>
        <Settings className="h-3.5 w-3.5" />
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Space Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {SPACE_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={`text-xl rounded p-1 ${
                    icon === ic ? "ring-2 ring-primary bg-accent" : "hover:bg-accent"
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {SPACE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full ${
                    color === c ? "ring-2 ring-offset-2 ring-primary" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button
              variant="outline"
              onClick={handleArchive}
              className="text-muted-foreground"
            >
              Archive
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
