"use client";

import { cn } from "@/lib/cn";

/**
 * Shared chart tooltip card used by AreaChart / LineChart / BarChart /
 * DonutChart. Positioned in screen pixels relative to a chart container that
 * the parent makes `relative`. The chart shows/hides this purely via the
 * `visible` prop — animation is a soft fade so it doesn't fight pointer
 * movement.
 */
export type ChartTooltipDatum = {
  /** Title row — usually the bucket label. */
  title?: string;
  /** Rows of {label, value, color} shown beneath the title. */
  rows: { label: string; value: string; color?: string }[];
};

export function ChartTooltip({
  x,
  y,
  visible,
  data,
  align = "above",
  className,
}: {
  x: number;
  y: number;
  visible: boolean;
  data: ChartTooltipDatum | null;
  align?: "above" | "below";
  className?: string;
}) {
  if (!data) return null;
  return (
    <div
      role="tooltip"
      aria-hidden={!visible}
      className={cn(
        "pointer-events-none absolute z-20 min-w-[140px] -translate-x-1/2 rounded-[10px] border border-[var(--stroke-2)] bg-[var(--panel)] px-2.5 py-1.5 text-[11.5px] shadow-[var(--shadow-2)] transition-opacity duration-150",
        visible ? "opacity-100" : "opacity-0",
        className
      )}
      style={{
        left: x,
        top: align === "above" ? y - 12 : y + 12,
        transform: `translate(-50%, ${align === "above" ? "-100%" : "0"})`,
      }}
    >
      {data.title && (
        <div className="mb-1 truncate text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--muted-2)]">
          {data.title}
        </div>
      )}
      <div className="flex flex-col gap-0.5">
        {data.rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2 whitespace-nowrap">
            {r.color && (
              <span
                aria-hidden
                className="inline-block h-2 w-2 shrink-0 rounded-[3px]"
                style={{ background: r.color }}
              />
            )}
            <span className="text-[var(--muted)]">{r.label}</span>
            <span className="num ml-auto font-semibold text-[var(--text)]">
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Format a number compactly: 1.2k, 4.5M, 0.045, etc. */
export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(0)}k`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  if (Number.isInteger(n)) return String(n);
  if (abs >= 10) return n.toFixed(1);
  if (abs >= 1) return n.toFixed(2);
  return n.toFixed(3);
}

/** Empty-state placeholder used inside chart panels. */
export function ChartEmpty({ message = "No data yet" }: { message?: string }) {
  return (
    <div className="flex h-[180px] flex-col items-center justify-center gap-1 px-4 text-center">
      <div className="text-[12px] font-semibold text-[var(--muted)]">
        {message}
      </div>
      <div className="text-[11px] text-[var(--muted-3)]">
        Once data lands, this chart will populate.
      </div>
    </div>
  );
}
