"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import type { Rule, RuleGroup, RuleOperator } from "@/lib/rules";

const FIELD_OPTIONS = [
  { value: "value", label: "Current value" },
  { value: "oldValue", label: "Previous value" },
  { value: "price", label: "Price (numeric)" },
  { value: "title", label: "Title" },
  { value: "url", label: "URL" },
];

const OPERATOR_OPTIONS: { value: RuleOperator; label: string }[] = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "lt", label: "less than" },
  { value: "gt", label: "greater than" },
  { value: "lte", label: "less than or equal" },
  { value: "gte", label: "greater than or equal" },
  { value: "regex", label: "matches regex" },
];

function defaultRule(): Rule {
  return { field: "value", operator: "contains", value: "" };
}

interface RuleRowProps {
  rule: Rule;
  onChange: (r: Rule) => void;
  onRemove: () => void;
}

function RuleRow({ rule, onChange, onRemove }: RuleRowProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={rule.field}
        onChange={(e) => onChange({ ...rule, field: e.target.value })}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
      >
        {FIELD_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <select
        value={rule.operator}
        onChange={(e) => onChange({ ...rule, operator: e.target.value as RuleOperator })}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
      >
        {OPERATOR_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <Input
        value={rule.value}
        onChange={(e) => onChange({ ...rule, value: e.target.value })}
        placeholder="value"
        className="h-9 w-36"
      />

      <label className="flex items-center gap-1 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={!!rule.not}
          onChange={(e) => onChange({ ...rule, not: e.target.checked })}
          className="rounded"
        />
        NOT
      </label>

      <Button variant="ghost" size="icon" onClick={onRemove} className="h-9 w-9 text-muted-foreground hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface RuleBuilderProps {
  value: RuleGroup | null;
  onChange: (group: RuleGroup | null) => void;
}

export function RuleBuilder({ value, onChange }: RuleBuilderProps) {
  const group: RuleGroup = value || { logic: "AND", rules: [] };

  function updateRule(index: number, updated: Rule) {
    const rules = [...group.rules];
    rules[index] = updated;
    onChange({ ...group, rules });
  }

  function removeRule(index: number) {
    const rules = group.rules.filter((_, i) => i !== index);
    onChange(rules.length === 0 ? null : { ...group, rules });
  }

  function addRule() {
    onChange({ ...group, rules: [...group.rules, defaultRule()] });
  }

  function toggleLogic() {
    onChange({ ...group, logic: group.logic === "AND" ? "OR" : "AND" });
  }

  if (group.rules.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">No rules — all changes will trigger notifications.</p>
        <Button variant="outline" size="sm" onClick={addRule}>
          <Plus className="h-4 w-4 mr-1" />
          Add rule
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {group.rules.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Match</span>
          <button
            type="button"
            onClick={toggleLogic}
            className="px-2 py-0.5 rounded border border-input text-sm font-medium hover:bg-accent"
          >
            {group.logic === "AND" ? "ALL rules" : "ANY rule"}
          </button>
          <span className="text-sm text-muted-foreground">to send notification</span>
        </div>
      )}

      <div className="space-y-2">
        {group.rules.map((rule, i) => {
          if ("logic" in rule) return null; // nested groups not shown in basic UI
          return (
            <RuleRow
              key={i}
              rule={rule as Rule}
              onChange={(r) => updateRule(i, r)}
              onRemove={() => removeRule(i)}
            />
          );
        })}
      </div>

      <Button variant="outline" size="sm" onClick={addRule}>
        <Plus className="h-4 w-4 mr-1" />
        Add rule
      </Button>
    </div>
  );
}
