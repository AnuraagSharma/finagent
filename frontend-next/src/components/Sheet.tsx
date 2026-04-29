"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";

export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="sheet-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-20 bg-black/45 backdrop-blur-md"
          />
          <motion.aside
            key="sheet"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.26, ease: [0.2, 0.7, 0.2, 1] }}
            className="fixed right-3 top-3 bottom-3 z-30 flex w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden rounded-[18px] border border-[var(--stroke)] bg-[var(--glass-2)] shadow-[var(--shadow-1)] backdrop-blur-md"
          >
            <header className="flex items-center justify-between border-b border-[var(--stroke)] px-3.5 py-3">
              <div className="font-extrabold">{title}</div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-[10px] border border-[var(--stroke)] hover:bg-white/5"
              >
                <X size={14} />
              </button>
            </header>
            <div className="scroll-area overflow-auto p-3.5">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
