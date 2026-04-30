"use client";

import { cn } from "@/lib/cn";

/**
 * The KPI cards across the top of every analytics tab. Mirrors the screenshots'
 * "Total Queries · 10  ·  4 sessions" stacked layout. The optional `accent` prop
 * adds a colored bar on the left edge to call out the headline metric.
 */
export function KpiCard({
  label,
  value,
  sub,
  accent,
  tone,
  align = "left",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: boolean;
  tone?: "neutral" | "positive" | "negative" | "warn";
  align?: "left" | "center";
}) {
  const toneClass =
    tone === "positive"
      ? "text-[var(--gain)]"
      : tone === "negative"
      ? "text-[var(--loss)]"
      : tone === "warn"
      ? "text-[var(--warn)]"
      : "text-[var(--text)]";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[14px] border border-[var(--stroke)] bg-[var(--glass)] p-4",
        align === "center" ? "text-center" : "text-left",
        accent && "ring-1 ring-[var(--accent)]/20"
      )}
    >
      {accent && (
        <span
          aria-hidden
          className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-[var(--accent)]"
        />
      )}
      <div className="truncate text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--muted-2)]">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 truncate font-extrabold leading-tight tracking-tight",
          toneClass
        )}
        style={{
          fontFamily: "var(--font-display)",
          // Fluid sizing — smaller on dense grids, larger when the card has room.
          fontSize: "clamp(20px, 1.6vw, 26px)",
        }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 line-clamp-2 text-[12px] text-[var(--muted-2)]">
          {sub}
        </div>
      )}
    </div>
  );
}
