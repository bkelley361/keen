"use client";

import { useState } from "react";
import { db, tx, id } from "@/lib/instant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Globe, Lock } from "lucide-react";

interface MonitorTemplateSource {
  sourceType: "monitor";
  type: string;
  mode: string;
  selector?: string;
  clickSelector?: string;
  urlPlaceholder?: string;
}

interface FeedTemplateSource {
  sourceType: "feed";
  feedUrl?: string;
  urlPlaceholder?: string;
}

type TemplateSource = MonitorTemplateSource | FeedTemplateSource;

interface SaveAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  source: TemplateSource;
  defaultName?: string;
}

const CATEGORY_OPTIONS = [
  { value: "price", label: "Price" },
  { value: "youtube", label: "YouTube" },
  { value: "tech", label: "Tech" },
  { value: "news", label: "News" },
  { value: "sports", label: "Sports" },
  { value: "jobs", label: "Jobs" },
  { value: "other", label: "Other" },
];

export function SaveAsTemplateDialog({
  open,
  onOpenChange,
  userId,
  source,
  defaultName = "",
}: SaveAsTemplateDialogProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🌐");
  const [category, setCategory] = useState("other");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  function reset() {
    setName(defaultName);
    setDescription("");
    setIcon("🌐");
    setCategory("other");
    setIsPublic(false);
    setSaving(false);
  }

  function handleOpenChange(val: boolean) {
    if (!val) reset();
    onOpenChange(val);
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const templateId = id();
      const base = {
        userId,
        name: name.trim(),
        description: description.trim() || undefined,
        icon: icon.trim() || "🌐",
        category,
        isPublic,
        sourceType: source.sourceType,
        createdAt: Date.now(),
      };

      const extra =
        source.sourceType === "monitor"
          ? {
              type: source.type,
              mode: source.mode,
              selector: source.selector || undefined,
              clickSelector: source.clickSelector || undefined,
              urlPlaceholder: source.urlPlaceholder || undefined,
            }
          : {
              feedUrl: source.feedUrl || undefined,
              urlPlaceholder: source.urlPlaceholder || undefined,
            };

      db.transact(tx.monitorTemplates[templateId].update({ ...base, ...extra }));
      toast.success(isPublic ? "Template saved and published!" : "Template saved privately.");
      handleOpenChange(false);
    } catch {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Save as template</DialogTitle>
          <DialogDescription>
            Save this {source.sourceType} config as a reusable template.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Icon + Name row */}
          <div className="flex gap-2">
            <div className="space-y-1.5 w-16 shrink-0">
              <Label htmlFor="tpl-icon">Icon</Label>
              <Input
                id="tpl-icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="text-center text-lg px-1"
                maxLength={2}
              />
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Amazon Price Tracker"
                autoFocus
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="tpl-desc">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this template monitor?"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Category</Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`text-xs px-2.5 py-1 border transition-colors ${
                    category === c.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Visibility toggle */}
          <div className="space-y-1.5">
            <Label>Visibility</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm border transition-colors ${
                  !isPublic
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <Lock className="h-3.5 w-3.5" />
                Private
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm border transition-colors ${
                  isPublic
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                Public
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isPublic
                ? "Visible to all users in the public template store."
                : "Only visible to you in My Templates."}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !name.trim()}>
              {saving ? "Saving..." : "Save template"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
