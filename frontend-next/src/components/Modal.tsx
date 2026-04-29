"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";

export function Modal({
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
            key="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-30 bg-black/45 backdrop-blur-md"
          />
          <div className="fixed inset-0 z-40 grid place-items-center p-4">
            <motion.div
              key="modal"
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
              className="w-full max-w-[640px] rounded-[18px] border border-[var(--stroke)] bg-[var(--bg-1)] shadow-[var(--shadow-1)]"
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
              <div className="p-3.5">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
