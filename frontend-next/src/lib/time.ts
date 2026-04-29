import type { Recent } from "./types";

export type RecentGroup = { label: string; items: Recent[] };

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
