"use client";

import { useMemo, useRef, useState } from "react";
import { ChartTooltip, formatCompact } from "./ChartTooltip";

/**
 * Theme-aware line chart with hover crosshair + tooltip. No fill — clean
 * geometry meant to highlight a single trend.
 */
export type LineChartPoint = { label: string; value: number };

export function LineChart({
  data,
  height = 180,
  yLabel,
  stroke = "var(--chart-1)",
  yTicks = 4,
  format = formatCompact,
}: {
  data: LineChartPoint[];
  height?: number;
  yLabel?: string;
  stroke?: string;
  yTicks?: number;
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

  const max = useMemo(() => Math.max(1, ...data.map((d) => d.value)), [data]);
  const niceMax = useMemo(() => niceCeil(max), [max]);

  const xFor = (i: number) =>
    data.length <= 1 ? padL + innerW / 2 : padL + (i * innerW) / (data.length - 1);
  const yFor = (v: number) => padT + innerH * (1 - v / (niceMax || 1));

  const ticks = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i <= yTicks; i++) arr.push((niceMax * i) / yTicks);
    return arr;
  }, [niceMax, yTicks]);

  const pathD = useMemo(() => {
    if (data.length === 0) return "";
    return data
      .map(
        (d, i) =>
          `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(2)} ${yFor(d.value).toFixed(2)}`
      )
      .join(" ");
  }, [data]);

  const xLabelEvery = Math.max(1, Math.round(data.length / 12));

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

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label={yLabel || "line chart"}
        style={{ color: "var(--chart-axis)" }}
      >
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

        {data.length > 0 && (
          <>
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
