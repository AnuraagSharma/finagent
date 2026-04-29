"use client";

import { motion } from "framer-motion";
import {
  TrendingUp,
  GitCompareArrows,
  FileText,
  LineChart,
  Sparkles,
  ArrowUpRight,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import { Area, AreaChart } from "recharts";
import { useId, useMemo } from "react";
import { cn } from "@/lib/cn";

type Card = {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  kind: string;
  title: string;
  desc: string;
  prompt: string;
  trend: number[];
  delta: number;
};

const cards: Card[] = [
  {
    icon: TrendingUp,
    kind: "Equity",
    title: "Analyze AAPL",
    desc: "1-year trend, drivers, risks",
    prompt: "Analyze AAPL: 1-year price trend, key drivers, and risks.",
    trend: [22, 24, 23, 26, 28, 27, 30, 33, 32, 35, 38, 41],
    delta: 18.6,
  },
  {
    icon: LineChart,
    kind: "Trend",
    title: "TSLA revenue trend",
    desc: "Last 8 quarters, YoY growth",
    prompt:
      "Plot TSLA quarterly revenue trend and YoY growth for the last 8 quarters.",
    trend: [18, 21, 19, 24, 22, 26, 24, 28],
    delta: 9.4,
  },
  {
    icon: GitCompareArrows,
    kind: "Compare",
    title: "NVDA vs AMD",
    desc: "Profitability, valuation, growth",
    prompt:
      "Compare NVDA vs AMD: profitability, valuation, growth, and risk in a clean table.",
    trend: [14, 15, 17, 21, 25, 32, 36, 40, 45, 51, 58, 64],
    delta: 42.1,
  },
  {
    icon: FileText,
    kind: "Filings",
    title: "MSFT 10-Q summary",
    desc: "8 bullets, risk flags",
    prompt:
      "Summarize the most recent 10-Q for MSFT in 8 bullet points and flag risks.",
    trend: [30, 31, 30, 32, 33, 32, 34, 35, 36, 35, 37, 38],
    delta: 4.2,
  },
];

const tickers = [
  { s: "S&P 500", v: "5,861.32", d: 0.42 },
  { s: "NASDAQ", v: "18,792.10", d: 0.71 },
  { s: "DOW", v: "42,114.06", d: -0.18 },
  { s: "10Y", v: "4.214%", d: 0.03 },
  { s: "DXY", v: "104.18", d: -0.22 },
  { s: "BTC", v: "67,420", d: 1.84 },
  { s: "GOLD", v: "2,712.40", d: 0.35 },
  { s: "WTI", v: "71.04", d: -0.92 },
];

function Sparkline({
  data,
  positive,
  height = 36,
  width = 132,
}: {
  data: number[];
  positive: boolean;
  height?: number;
  width?: number;
}) {
  const uid = useId().replace(/[^a-z0-9]/gi, "");
  const gid = "spark-" + uid;
  const points = useMemo(() => data.map((v, i) => ({ i, v })), [data]);
  const stroke = positive ? "var(--gain)" : "var(--loss)";
  return (
    <div style={{ height, width }}>
      {/* Fixed dimensions avoid ResponsiveContainer SSR width/height -1 warnings */}
      <AreaChart width={width} height={height} data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.55} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={stroke}
          strokeWidth={1.8}
          fill={"url(#" + gid + ")"}
          isAnimationActive={false}
        />
      </AreaChart>
    </div>
  );
}

function Ticker({ s, v, d }: { s: string; v: string; d: number }) {
  const up = d >= 0;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-[12.5px]">
      <span className="font-bold tracking-wide text-[var(--text)]">{s}</span>
      <span className="num font-mono text-[12px] text-[var(--muted)]">{v}</span>
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[11px] font-bold",
          up ? "chip-gain" : "chip-loss"
        )}
      >
        {up ? <ArrowUp size={9} strokeWidth={3} /> : <ArrowDown size={9} strokeWidth={3} />}
        <span className="num">
          {up ? "+" : ""}
          {d.toFixed(2)}%
        </span>
      </span>
    </span>
  );
}

export function Hero({ onPick }: { onPick: (text: string) => void }) {
  return (
    <section className="relative isolate mx-auto mt-4 max-w-[960px] px-4 pb-6 pt-4 text-center">
      <div className="hero-orb" aria-hidden />
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-[1]"
      >
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--stroke-accent)] bg-[var(--accent-soft)] px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
          <Sparkles size={11} /> FinAgent Deep Research
        </span>

        <h1
          className="m-0 font-extrabold leading-[1.04] tracking-[-0.025em]"
          style={{ fontFamily: "var(--font-display)", fontSize: "clamp(34px, 4.6vw, 60px)" }}
        >
          What would you like to <span className="gradient-text">explore</span>?
        </h1>

        <p className="mx-auto mt-3 mb-7 max-w-[640px] text-[15px] leading-[1.65] text-[var(--muted)]">
          A deep agent for financial research. It orchestrates retrieval, fundamentals, comparables,
          and analysis. Pick a starter or ask anything.
        </p>

        <div className="mx-auto grid max-w-[860px] grid-cols-1 gap-3 sm:grid-cols-2">
          {cards.map((c, i) => {
            const Icon = c.icon;
            const positive = c.delta >= 0;
            return (
              <motion.button
                key={c.title}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: 0.06 * i, ease: [0.22, 0.7, 0.2, 1] }}
                whileHover={{ y: -3 }}
                onClick={(e) => {
                  onPick(c.prompt);
                  e.currentTarget.style.setProperty("--mx", "50%");
                }}
                onMouseMove={(e) => {
                  const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                  const mx = ((e.clientX - rect.left) / rect.width) * 100;
                  (e.currentTarget as HTMLButtonElement).style.setProperty("--mx", mx + "%");
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.setProperty("--mx", "-200%");
                }}
                className={cn(
                  "card-glow group relative overflow-hidden rounded-[18px] border border-[var(--stroke)] bg-[var(--panel)] px-4 py-3.5 text-left",
                  "ring-inset-soft transition-[border-color,box-shadow,transform]",
                  "hover:border-[var(--stroke-accent)] hover:shadow-[var(--shadow-glow)]"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-[var(--stroke-accent)] bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-[15px] font-bold leading-tight text-[var(--text)]">
                        {c.title}
                      </div>
                      <span className="shrink-0 rounded-full border border-[var(--stroke-2)] bg-white/[0.03] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.16em] text-[var(--muted-2)]">
                        {c.kind}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[12.5px] text-[var(--muted-2)]">
                      {c.desc}
                    </div>
                  </div>
                  <ArrowUpRight
                    size={14}
                    className="shrink-0 text-[var(--muted-3)] opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </div>

                <div className="mt-3 flex items-end justify-between gap-3">
                  <Sparkline data={c.trend} positive={positive} height={34} width={210} />
                  <span
                    className={cn(
                      "num inline-flex items-center gap-0.5 rounded-md border px-2 py-1 text-[11.5px] font-bold font-mono",
                      positive ? "chip-gain" : "chip-loss"
                    )}
                  >
                    {positive ? <ArrowUp size={10} strokeWidth={3} /> : <ArrowDown size={10} strokeWidth={3} />}
                    {positive ? "+" : ""}
                    {c.delta.toFixed(1)}%
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>

        <div className="relative mx-auto mt-6 max-w-[860px] overflow-hidden rounded-full border border-[var(--stroke)] bg-[var(--panel)] py-2.5 ring-inset-soft">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-6 bg-gradient-to-r from-[var(--panel)] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-6 bg-gradient-to-l from-[var(--panel)] to-transparent" />
          <div className="marquee-track">
            <div className="marquee-copy">
              {tickers.map((t, i) => (
                <Ticker key={"a-" + i} s={t.s} v={t.v} d={t.d} />
              ))}
            </div>
            <div className="marquee-copy" aria-hidden>
              {tickers.map((t, i) => (
                <Ticker key={"b-" + i} s={t.s} v={t.v} d={t.d} />
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
