"use client";

import { useRecents } from "@/lib/stores";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/cn";

export function AnalyticsView({
  transcript,
  onResume,
}: {
  transcript: ChatMessage[];
  onResume: (threadId: string, title: string) => void;
}) {
  const recents = useRecents((s) => s.recents);
  const userCount = transcript.filter((t) => t.role === "user").length;
  const asstCount = transcript.filter((t) => t.role === "assistant").length;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2.5">
        <Metric label="Recent chats" value={recents.length} />
        <Metric label="User msgs" value={userCount} />
        <Metric label="Assistant msgs" value={asstCount} />
      </div>

      <div className="mt-3.5">
        <div className="mb-2 mt-3.5 text-[12px] uppercase tracking-[0.12em] text-[var(--muted-2)]">
          Recent threads
        </div>
        {recents.slice(0, 8).map((r) => (
          <button
            key={r.threadId}
            type="button"
            onClick={() => onResume(r.threadId, r.title)}
            className={cn(
              "mb-1.5 flex w-full items-center justify-between gap-2.5 rounded-[10px] border border-[var(--stroke)] bg-white/[0.02] px-2.5 py-2 text-left text-sm hover:bg-white/[0.04]"
            )}
          >
            <span className="flex-1 truncate">{r.title || "Untitled"}</span>
            <span className="font-mono text-[11.5px] text-[var(--muted-2)]">
              {r.threadId.slice(0, 8)}…
            </span>
          </button>
        ))}
        {recents.length === 0 && (
          <div className="text-[13px] text-[var(--muted-3)]">No chats yet.</div>
        )}
      </div>

      <div className="mt-4 text-[13px] text-[var(--muted-2)]">
        Full server-side analytics dashboard is coming next from{" "}
        <code className="rounded-md border border-[var(--stroke)] bg-white/5 px-1.5 py-0.5 text-[12.5px]">
          /v1/analytics
        </code>
        .
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[14px] border border-[var(--stroke)] bg-white/[0.02] p-3">
      <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted-2)]">
        {label}
      </div>
      <div className="mt-1 text-[22px] font-extrabold">{value}</div>
    </div>
  );
}
