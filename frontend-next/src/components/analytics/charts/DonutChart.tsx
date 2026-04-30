"use client";

import { useMemo, useState } from "react";

export type DonutSlice = {
  label: string;
  value: number;
  /** CSS variable preferred — e.g. "var(--gain)" so light/dark theming works. */
  color: string;
};

/**
 * Donut chart with center label + side legend.
 *
 * Used on the Summary tab for status mix, latency composition, and feedback mix.
 * Slices animate the active state on hover (no axis / scale logic — it's a
 * categorical viz). Renders an inline legend below or beside the donut depending
 * on `legend` prop.
 */
export function DonutChart({
  slices,
  size = 168,
  thickness = 22,
  centerLabel,
  centerSub,
  legend = "side",
  format = (n: number) => n.toLocaleString(),
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: React.ReactNode;
  centerSub?: React.ReactNode;
  legend?: "side" | "below" | "none";
  format?: (n: number) => string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const total = useMemo(
    () => slices.reduce((acc, s) => acc + Math.max(0, s.value), 0),
    [slices]
  );

  const r = size / 2;
  const inner = r - thickness;
  const cx = r;
  const cy = r;

  // Compute arcs
  const arcs = useMemo(() => {
    if (total <= 0) return [];
    let cursor = -Math.PI / 2; // start at 12 o'clock
    return slices.map((s) => {
      const frac = Math.max(0, s.value) / total;
      const start = cursor;
      const end = cursor + frac * Math.PI * 2;
      cursor = end;
      return { ...s, frac, start, end };
    });
  }, [slices, total]);

  return (
    <div
      className={
        legend === "side"
          ? "flex items-center gap-5"
          : legend === "below"
          ? "flex flex-col items-center gap-3"
          : ""
      }
    >
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-label="donut chart">
          {/* Track */}
          <circle
            cx={cx}
            cy={cy}
            r={(r + inner) / 2}
            fill="none"
            stroke="var(--chart-grid)"
            strokeWidth={thickness}
          />
          {total > 0 &&
            arcs.map((a, i) => {
              const isHover = hovered === i;
              return (
                <path
                  key={i}
                  d={describeArc(cx, cy, (r + inner) / 2, a.start, a.end)}
                  stroke={a.color}
                  strokeWidth={thickness + (isHover ? 4 : 0)}
                  strokeLinecap="butt"
                  fill="none"
                  opacity={hovered != null && !isHover ? 0.55 : 1}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ transition: "stroke-width 140ms ease, opacity 140ms ease" }}
                />
              );
            })}
        </svg>
        {/* Center label overlay */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {centerLabel != null && (
            <div
              className="text-[22px] font-extrabold leading-none tracking-tight text-[var(--text)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {centerLabel}
            </div>
          )}
          {centerSub != null && (
            <div className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--muted-2)]">
              {centerSub}
            </div>
          )}
        </div>
      </div>

      {legend !== "none" && (
        <ul
          className={
            legend === "side"
              ? "flex min-w-0 flex-1 flex-col gap-1.5"
              : "flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
          }
        >
          {slices.map((s, i) => {
            const pct = total > 0 ? (s.value / total) * 100 : 0;
            const isHover = hovered === i;
            return (
              <li
                key={s.label}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                className={
                  legend === "side"
                    ? "flex items-center gap-2 text-[12px]"
                    : "flex items-center gap-1.5 text-[11.5px]"
                }
                style={{ opacity: hovered != null && !isHover ? 0.6 : 1 }}
              >
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ background: s.color }}
                />
                <span className="min-w-0 truncate text-[var(--muted)]">
                  {s.label}
                </span>
                {legend === "side" ? (
                  <span className="ml-auto flex items-baseline gap-1.5">
                    <span className="num font-semibold text-[var(--text)]">
                      {format(s.value)}
                    </span>
                    <span className="num text-[10.5px] text-[var(--muted-2)]">
                      {pct.toFixed(0)}%
                    </span>
                  </span>
                ) : (
                  <span className="num font-semibold text-[var(--text)]">
                    {pct.toFixed(0)}%
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  start: number,
  end: number
): string {
  const startX = cx + r * Math.cos(start);
  const startY = cy + r * Math.sin(start);
  const endX = cx + r * Math.cos(end);
  const endY = cy + r * Math.sin(end);
  const largeArc = end - start > Math.PI ? 1 : 0;
  // Single full slice — draw two semi-arcs to avoid the SVG "same start/end"
  // degenerate case that some engines render as nothing.
  if (Math.abs(end - start - Math.PI * 2) < 1e-3) {
    const midX = cx + r * Math.cos(start + Math.PI);
    const midY = cy + r * Math.sin(start + Math.PI);
    return `M ${startX} ${startY} A ${r} ${r} 0 1 1 ${midX} ${midY} A ${r} ${r} 0 1 1 ${startX} ${startY}`;
  }
  return `M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`;
}
