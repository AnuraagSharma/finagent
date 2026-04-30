"use client";

import { cn } from "@/lib/cn";

/** Status pill used in Turn Logs (success / soft error / hard error). */
export function StatusChip({
  status,
  title,
}: {
  status: string;
  title?: string;
}) {
  const cfg =
    status === "success"
      ? {
          label: "success",
          cls: "border-[var(--gain)]/30 bg-[var(--gain-soft)] text-[var(--gain)]",
        }
      : status === "soft_error"
      ? {
          label: "soft error",
          cls: "border-[var(--warn)]/30 bg-[var(--warn-soft)] text-[var(--warn)]",
        }
      : status === "hard_error"
      ? {
          label: "hard error",
          cls: "border-[var(--loss)]/30 bg-[var(--loss-soft)] text-[var(--loss)]",
        }
      : {
          label: status || "unknown",
          cls: "border-[var(--stroke)] bg-[var(--hover-soft)] text-[var(--muted)]",
        };

  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em]",
        cfg.cls
      )}
    >
      {cfg.label}
    </span>
  );
}

/** Compact chip used for error type column. */
export function ErrorTypeChip({ type }: { type: string | null }) {
  if (!type) return <span className="text-[var(--muted-3)]">none</span>;
  return (
    <span className="inline-flex items-center rounded-md border border-[var(--stroke)] bg-[var(--hover-soft)] px-1.5 py-0.5 text-[11px] font-mono text-[var(--muted)]">
      {type}
    </span>
  );
}
