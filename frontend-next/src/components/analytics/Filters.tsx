"use client";

import { Download, Eraser } from "lucide-react";
import { useEffect, useState } from "react";
import type { AnalyticsFilters } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Select } from "./Select";

const TIME_PRESETS: { id: string; label: string; ms: number | null }[] = [
  { id: "all", label: "All time", ms: null },
  { id: "24h", label: "Last 24 hours", ms: 24 * 3600 * 1000 },
  { id: "7d", label: "Last 7 days", ms: 7 * 24 * 3600 * 1000 },
  { id: "30d", label: "Last 30 days", ms: 30 * 24 * 3600 * 1000 },
  { id: "90d", label: "Last 90 days", ms: 90 * 24 * 3600 * 1000 },
  { id: "custom", label: "Custom", ms: 0 },
];

/**
 * Top filter bar — fully controlled. The filter row uses `flex-wrap` (not a
 * fragile grid template) so fields gracefully reflow on narrow widths, and the
 * action cluster (Clear all / Export CSV) drops onto its own row below md.
 *
 * The Clear-all button shows the count of currently active filters so the user
 * knows at a glance whether the dataset they're looking at is filtered.
 */
export function Filters({
  filters,
  onChange,
  onClearAll,
  onExport,
  exportDisabled,
  rightSlot,
}: {
  filters: AnalyticsFilters;
  onChange: (next: AnalyticsFilters) => void;
  onClearAll: () => void;
  onExport: () => void;
  exportDisabled?: boolean;
  rightSlot?: React.ReactNode;
}) {
  const presetId = derivePresetId(filters.from, filters.to);
  const [localPreset, setLocalPreset] = useState(presetId);

  useEffect(() => {
    setLocalPreset(derivePresetId(filters.from, filters.to));
  }, [filters.from, filters.to]);

  function applyPreset(id: string) {
    setLocalPreset(id);
    if (id === "all") {
      onChange({ ...filters, from: null, to: null });
      return;
    }
    if (id === "custom") return;
    const preset = TIME_PRESETS.find((p) => p.id === id);
    if (!preset || !preset.ms) return;
    const to = new Date();
    const from = new Date(to.getTime() - preset.ms);
    onChange({
      ...filters,
      from: from.toISOString(),
      to: to.toISOString(),
    });
  }

  const dateValueFrom = isoToDateInput(filters.from);
  const dateValueTo = isoToDateInput(filters.to);

  // Active-filter count (treat presets other than "all"/"custom" as 1, and
  // each non-default field as 1).
  const activeCount = countActive(filters, localPreset);

  return (
    <div className="border-b border-[var(--stroke)] bg-[var(--bg-1)] px-5 py-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        {/* Filter fields — wrap freely on narrow widths */}
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          <Field label="Time">
            <Select
              value={localPreset}
              onChange={(v) => applyPreset(v)}
              options={TIME_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
              minWidth={150}
              ariaLabel="Time range"
            />
          </Field>
          <Field label="From">
            <DateInput
              value={dateValueFrom}
              max={dateValueTo || undefined}
              onChange={(d) =>
                onChange({ ...filters, from: d ? new Date(d).toISOString() : null })
              }
            />
          </Field>
          <Field label="To">
            <DateInput
              value={dateValueTo}
              min={dateValueFrom || undefined}
              onChange={(d) =>
                onChange({
                  ...filters,
                  to: d
                    ? new Date(new Date(d).getTime() + 24 * 3600 * 1000 - 1).toISOString()
                    : null,
                })
              }
            />
          </Field>
          <Field label="Status">
            <Select
              value={filters.status || "all"}
              onChange={(v) =>
                onChange({
                  ...filters,
                  status: v as AnalyticsFilters["status"],
                })
              }
              options={[
                { value: "all", label: "All" },
                { value: "success", label: "Success" },
                { value: "soft_error", label: "Soft error" },
                { value: "hard_error", label: "Hard error" },
              ]}
              minWidth={130}
              ariaLabel="Status filter"
            />
          </Field>
          <Field label="Error type">
            <input
              value={filters.errorType || ""}
              onChange={(e) =>
                onChange({ ...filters, errorType: e.target.value || null })
              }
              placeholder="All"
              className={cn(inputClass, "min-w-[140px]")}
            />
          </Field>
          <Field label="Feedback">
            <Select
              value={filters.feedback || "all"}
              onChange={(v) =>
                onChange({
                  ...filters,
                  feedback: v as AnalyticsFilters["feedback"],
                })
              }
              options={[
                { value: "all", label: "All" },
                { value: "like", label: "Liked" },
                { value: "dislike", label: "Disliked" },
                { value: "none", label: "No feedback" },
              ]}
              minWidth={140}
              ariaLabel="Feedback filter"
            />
          </Field>
          <Field label="User">
            <input
              value={filters.userId || ""}
              onChange={(e) =>
                onChange({ ...filters, userId: e.target.value || null })
              }
              placeholder="All"
              className={cn(inputClass, "min-w-[140px]")}
            />
          </Field>
        </div>

        {/* Actions — wrap to their own row below md, right-aligned at md+ */}
        <div className="flex flex-wrap items-end justify-end gap-2">
          {rightSlot}
          <button
            type="button"
            onClick={onClearAll}
            disabled={activeCount === 0}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[var(--stroke)] bg-[var(--hover-soft)] px-2.5 text-[12.5px] font-semibold transition-colors",
              activeCount === 0
                ? "cursor-not-allowed text-[var(--muted-3)]"
                : "text-[var(--muted)] hover:bg-[var(--hover-stronger)] hover:text-[var(--text)]"
            )}
          >
            <Eraser size={13} />
            Clear all
            {activeCount > 0 && (
              <span className="ml-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--accent-soft)] px-1.5 text-[10.5px] font-bold text-[var(--accent)]">
                {activeCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={exportDisabled}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-[10px] border px-2.5 text-[12.5px] font-semibold",
              exportDisabled
                ? "cursor-not-allowed border-[var(--stroke)] bg-[var(--hover-soft)] text-[var(--muted-3)]"
                : "border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent)]/15"
            )}
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "h-9 w-full rounded-[10px] border border-[var(--stroke)] bg-[var(--hover-soft)] px-2.5 text-[12.5px] text-[var(--text)] placeholder:text-[var(--muted-3)] focus:border-[var(--accent)]/60 focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted-2)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function DateInput({
  value,
  onChange,
  min,
  max,
}: {
  value: string;
  onChange: (s: string) => void;
  min?: string;
  max?: string;
}) {
  return (
    <input
      type="date"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      className={cn(inputClass, "min-w-[140px]")}
    />
  );
}

function isoToDateInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function derivePresetId(from?: string | null, to?: string | null): string {
  if (!from && !to) return "all";
  const now = Date.now();
  if (to) {
    const toMs = new Date(to).getTime();
    if (Math.abs(now - toMs) <= 3600 * 1000 && from) {
      const span = toMs - new Date(from).getTime();
      const tol = 60 * 60 * 1000;
      for (const p of TIME_PRESETS) {
        if (p.ms && Math.abs(span - p.ms) < tol) return p.id;
      }
    }
  }
  return "custom";
}

function countActive(f: AnalyticsFilters, presetId: string): number {
  let n = 0;
  if (presetId !== "all") n += 1;
  if (f.status && f.status !== "all") n += 1;
  if (f.errorType) n += 1;
  if (f.userId) n += 1;
  if (f.feedback && f.feedback !== "all") n += 1;
  return n;
}
