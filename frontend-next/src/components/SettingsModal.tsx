"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { useSettings } from "@/lib/stores";
import { useToast } from "./Toaster";

export function SettingsModal({
  open,
  onClose,
  activeThreadId,
}: {
  open: boolean;
  onClose: () => void;
  activeThreadId: string | null;
}) {
  const { userId, backendUrl, setUserId, setBackendUrl } = useSettings();
  const [u, setU] = useState(userId);
  const [b, setB] = useState(backendUrl);
  const show = useToast((s) => s.show);

  useEffect(() => {
    if (open) {
      setU(userId);
      setB(backendUrl);
    }
  }, [open, userId, backendUrl]);

  return (
    <Modal open={open} title="Settings" onClose={onClose}>
      <div className="text-[12px] text-[var(--muted-2)] mb-2.5">
        Stored locally in your browser.
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="User ID" value={u} onChange={setU} />
        <Field label="Backend URL" value={b} onChange={setB} />
      </div>
      <div className="mt-3.5 flex flex-wrap justify-end gap-2.5">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(activeThreadId || "");
              show(activeThreadId ? "Thread id copied." : "No thread yet.");
            } catch {
              show("Copy failed.");
            }
          }}
          className="text-btn rounded-[10px] px-2.5 py-2 text-[13.5px] font-semibold text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]"
        >
          Copy thread id
        </button>
        <button
          type="button"
          onClick={() => {
            setUserId(u);
            setBackendUrl(b);
            show("Saved.");
            onClose();
          }}
          className="rounded-[11px] border border-black/[0.18] bg-[var(--accent)] px-3 py-2 text-[13px] font-bold text-[#06141b] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_6px_16px_var(--accent-glow)] hover:brightness-110"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--muted-2)]">
        {label}
      </span>
      <input
        type="text"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[10px] border border-[var(--stroke)] bg-[var(--bg-2)] px-3 py-2.5 outline-none focus:border-[var(--stroke-accent)] focus:shadow-[0_0_0_4px_var(--accent-soft)]"
      />
    </label>
  );
}
