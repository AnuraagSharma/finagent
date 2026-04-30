import type { Recent } from "./types";

export type RecentGroup = { label: string; items: Recent[] };

/**
 * Compact relative time: "now", "12s", "4m", "3h", "2d", "5w".
 * Falls back to a short date for anything older than ~1y.
 *
 * Designed to be paired with `title={fullTimestamp}` on the host element so
 * the user can see the absolute time on hover.
 */
export function relativeTime(value: string | number | Date | null | undefined, now: number = Date.now()): string {
  if (!value) return "—";
  const t = typeof value === "number" ? value : new Date(value).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Math.max(0, now - t);
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return "now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(day / 365);
  return `${yr}y ago`;
}

/** Absolute timestamp formatter — used for the `title` attribute on hover. */
export function absoluteTime(value: string | number | Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export function groupRecentsByTime(items: Recent[], now = Date.now()): RecentGroup[] {
  const oneDay = 24 * 60 * 60 * 1000;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const startOfToday = today.getTime();
  const startOfYesterday = startOfToday - oneDay;
  const last7 = startOfToday - 6 * oneDay;
  const last30 = startOfToday - 29 * oneDay;

  const groups: RecentGroup[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Last 7 days", items: [] },
    { label: "Last 30 days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const r of items) {
    const t = r.ts ?? 0;
    if (t >= startOfToday) groups[0].items.push(r);
    else if (t >= startOfYesterday) groups[1].items.push(r);
    else if (t >= last7) groups[2].items.push(r);
    else if (t >= last30) groups[3].items.push(r);
    else groups[4].items.push(r);
  }
  return groups.filter((g) => g.items.length > 0);
}
