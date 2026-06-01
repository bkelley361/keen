"use client";

import type { DiffLine } from "@/lib/diff";

interface DiffViewerProps {
  diff: DiffLine[];
}

export function DiffViewer({ diff }: DiffViewerProps) {
  if (diff.length === 0) {
    return <p className="text-sm text-muted-foreground">No differences found.</p>;
  }

  return (
    <div className="rounded-md border border-input overflow-hidden font-mono text-sm">
      <div className="overflow-x-auto max-h-80">
        <table className="w-full">
          <tbody>
            {diff.map((line, i) => {
              const bg =
                line.type === "added"
                  ? "bg-green-500/10"
                  : line.type === "removed"
                  ? "bg-red-500/10"
                  : "";
              const prefix =
                line.type === "added" ? "+" : line.type === "removed" ? "−" : " ";
              const textColor =
                line.type === "added"
                  ? "text-green-700 dark:text-green-400"
                  : line.type === "removed"
                  ? "text-red-700 dark:text-red-400"
                  : "text-muted-foreground";

              return (
                <tr key={i} className={bg}>
                  <td className={`select-none w-4 px-2 py-0.5 text-center ${textColor}`}>
                    {prefix}
                  </td>
                  <td className={`px-2 py-0.5 whitespace-pre-wrap break-all ${textColor}`}>
                    {line.text || " "}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
