"use client";

import { useMemo, useRef, useState } from "react";
import { ChartTooltip, formatCompact } from "./ChartTooltip";

/**
 * Vertical bar chart — used in Trend Analysis for "Queries per bucket". Theme-aware
 * (reads colors from CSS vars), ships a hover tooltip with crosshair, and gracefully
 * handles single-point and empty data.
 */
export type BarChartPoint = { label: string; value: number };

export function BarChart({
  data,
  height = 180,
  yLabel,
  yTicks = 4,
  /** Bar fill color — pass a CSS var for theme awareness, e.g. "var(--chart-1)" */
  color = "var(--chart-1)",
  format = formatCompact,
}: {
  data: BarChartPoint[];
  height?: number;
  yLabel?: string;
  yTicks?: number;
  color?: string;
  format?: (n: number) => string;
}) {
  const W = 980;
  const H = 240;
  const padL = 44;
  const padR = 12;
  const padT = 12;
  const padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const max = useMemo(
    () => Math.max(1, ...data.map((d) => d.value)),
    [data]
  );

  const niceMax = useMemo(() => niceCeil(max), [max]);

  const ticks = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i <= yTicks; i++) arr.push((niceMax * i) / yTicks);
    return arr;
  }, [niceMax, yTicks]);

  const yFor = (v: number) =>
    padT + innerH * (1 - v / (niceMax || 1));

  const slot = data.length > 0 ? innerW / data.length : innerW;
  const barW = Math.max(2, Math.min(28, slot * 0.62));

  const xLabelEvery = Math.max(1, Math.round(data.length / 12));

  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ idx: number; px: number; py: number } | null>(null);

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    if (!containerRef.current || data.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    // Convert from container px to chart x coord
    const scaleX = rect.width / W;
    const xCoord = px / scaleX;
    const inside = xCoord - padL;
    const idx = Math.max(
      0,
      Math.min(data.length - 1, Math.floor(inside / slot))
    );
    setHover({ idx, px, py: (yFor(data[idx].value) * rect.height) / H });
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label={yLabel || "bar chart"}
        style={{ color: "var(--chart-axis)" }}
      >
        {/* Y grid + labels */}
        {ticks.map((t, i) => {
          const y = yFor(t);
          return (
            <g key={`y-${i}`}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y}
                y2={y}
                stroke="var(--chart-grid)"
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text
                x={padL - 6}
                y={y}
                dy="0.32em"
                fontSize="10.5"
                textAnchor="end"
                fill="currentColor"
                fontFamily="var(--font-jetbrains)"
              >
                {format(t)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const cx = padL + slot * i + slot / 2;
          const y = yFor(d.value);
          const h = padT + innerH - y;
          const isHover = hover?.idx === i;
          return (
            <g key={`b-${i}`}>
              <rect
                x={cx - barW / 2}
                y={y}
                width={barW}
                height={Math.max(0, h)}
                rx={3}
                fill={color}
                opacity={hover && !isHover ? 0.45 : 0.92}
                style={{ transition: "opacity 120ms ease" }}
              />
            </g>
          );
        })}

        {/* X labels */}
        {data.map((d, i) => {
          if (i % xLabelEvery !== 0 && i !== data.length - 1) return null;
          const cx = padL + slot * i + slot / 2;
          return (
            <text
              key={`x-${i}`}
              x={cx}
              y={H - padB + 16}
              textAnchor="middle"
              fontSize="10"
              fill="currentColor"
              fontFamily="var(--font-jetbrains)"
            >
              {d.label}
            </text>
          );
        })}

        {/* Hit area */}
        <rect
          x={padL}
          y={padT}
          width={innerW}
          height={innerH}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
      </svg>

      {hover && data[hover.idx] && (
        <ChartTooltip
          x={hover.px}
          y={hover.py}
          visible={true}
          align="above"
          data={{
            title: data[hover.idx].label,
            rows: [
              {
                label: yLabel || "Value",
                value: format(data[hover.idx].value),
                color,
              },
            ],
          }}
        />
      )}
    </div>
  );
}

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const m = v / base;
  let nice;
  if (m <= 1) nice = 1;
  else if (m <= 2) nice = 2;
  else if (m <= 5) nice = 5;
  else nice = 10;
  return nice * base;
}
