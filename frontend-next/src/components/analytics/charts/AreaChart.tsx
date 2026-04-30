"use client";

import { useMemo, useRef, useState } from "react";
import { ChartTooltip, formatCompact } from "./ChartTooltip";

/**
 * Lightweight dependency-free area chart with smooth cubic curves, theme-token
 * colors, and an interactive crosshair tooltip. Everything reads from CSS vars
 * so the chart renders correctly in both light and dark themes.
 */
export type AreaChartPoint = { label: string; value: number };

export function AreaChart({
  data,
  height = 200,
  yLabel,
  yTicks = 4,
  /** Stroke color — pass a CSS var for theme awareness. */
  stroke = "var(--chart-1)",
  /** Optional fill — defaults to a translucent stroke gradient. */
  fillFrom,
  fillTo,
  format = formatCompact,
}: {
  data: AreaChartPoint[];
  height?: number;
  yLabel?: string;
  yTicks?: number;
  stroke?: string;
  fillFrom?: string;
  fillTo?: string;
  format?: (n: number) => string;
}) {
  const W = 980;
  const H = 260;
  const padL = 44;
  const padR = 12;
  const padT = 12;
  const padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const max = useMemo(() => Math.max(1, ...data.map((d) => d.value)), [data]);
  const niceMax = useMemo(() => niceCeil(max), [max]);

  const xFor = (i: number) =>
    data.length <= 1 ? padL + innerW / 2 : padL + (i * innerW) / (data.length - 1);
  const yFor = (v: number) => padT + innerH * (1 - v / (niceMax || 1));

  const pathD = useMemo(() => {
    if (data.length === 0) return "";
    if (data.length === 1) {
      const x = xFor(0);
      const y = yFor(data[0].value);
      return `M ${x} ${y}`;
    }
    const parts: string[] = [];
    for (let i = 0; i < data.length; i++) {
      const x = xFor(i);
      const y = yFor(data[i].value);
      if (i === 0) {
        parts.push(`M ${x.toFixed(2)} ${y.toFixed(2)}`);
        continue;
      }
      const px = xFor(i - 1);
      const py = yFor(data[i - 1].value);
      const cx1 = px + (x - px) / 2;
      const cx2 = px + (x - px) / 2;
      parts.push(
        `C ${cx1.toFixed(2)} ${py.toFixed(2)} ${cx2.toFixed(2)} ${y.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`
      );
    }
    return parts.join(" ");
  }, [data]);

  const areaD = useMemo(() => {
    if (!pathD || data.length === 0) return "";
    const x0 = xFor(0);
    const xN = xFor(data.length - 1);
    const yBase = yFor(0);
    return `${pathD} L ${xN.toFixed(2)} ${yBase.toFixed(2)} L ${x0.toFixed(2)} ${yBase.toFixed(2)} Z`;
  }, [pathD, data]);

  const ticks = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i <= yTicks; i++) arr.push((niceMax * i) / yTicks);
    return arr;
  }, [niceMax, yTicks]);

  const xLabelEvery = Math.max(1, Math.round(data.length / 12));

  // Hover handling
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ idx: number; px: number; py: number } | null>(null);

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    if (!containerRef.current || data.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const xCoord = (px / rect.width) * W;
    const inside = xCoord - padL;
    const step = data.length <= 1 ? innerW : innerW / (data.length - 1);
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(inside / step)));
    const cx = xFor(idx);
    const cy = yFor(data[idx].value);
    setHover({
      idx,
      px: (cx / W) * rect.width,
      py: (cy / H) * rect.height,
    });
  }

  // Generate a unique gradient id so multiple AreaCharts on a page don't clash.
  const gradId = useMemo(
    () => `ac-${Math.random().toString(36).slice(2, 9)}`,
    []
  );
  const fromColor = fillFrom ?? stroke;
  const toColor = fillTo ?? "transparent";

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label={yLabel || "area chart"}
        style={{ color: "var(--chart-axis)" }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fromColor} stopOpacity="0.32" />
            <stop offset="100%" stopColor={toColor} stopOpacity="0" />
          </linearGradient>
        </defs>

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

        {/* Area + line */}
        {data.length > 0 && (
          <>
            <path d={areaD} fill={`url(#${gradId})`} stroke="none" />
            <path d={pathD} fill="none" stroke={stroke} strokeWidth={2} />
            {data.map((d, i) => (
              <circle
                key={i}
                cx={xFor(i)}
                cy={yFor(d.value)}
                r={hover?.idx === i ? 3.5 : 2.25}
                fill={stroke}
                style={{ transition: "r 120ms ease" }}
              />
            ))}
          </>
        )}

        {/* Crosshair */}
        {hover && data[hover.idx] && (
          <line
            x1={xFor(hover.idx)}
            x2={xFor(hover.idx)}
            y1={padT}
            y2={padT + innerH}
            stroke="var(--chart-axis)"
            strokeOpacity="0.35"
            strokeDasharray="2 3"
          />
        )}

        {/* X labels */}
        {data.map((d, i) => {
          if (i % xLabelEvery !== 0 && i !== data.length - 1) return null;
          const x = xFor(i);
          return (
            <text
              key={`x-${i}`}
              x={x}
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
                color: stroke,
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
