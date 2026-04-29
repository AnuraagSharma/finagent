"use client";

import { create } from "zustand";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

type ToastState = {
  message: string | null;
  show: (msg: string) => void;
  hide: () => void;
};

export const useToast = create<ToastState>((set) => ({
  message: null,
  show: (msg: string) => set({ message: msg }),
  hide: () => set({ message: null }),
}));

export function Toaster() {
  const message = useToast((s) => s.message);
  const hide = useToast((s) => s.hide);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, 1500);
    return () => clearTimeout(t);
  }, [message, hide]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key="toast"
          initial={{ opacity: 0, y: 8, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: 8, x: "-50%" }}
          transition={{ duration: 0.18 }}
          className="fixed left-1/2 bottom-6 z-[60] -translate-x-1/2 rounded-full border border-[var(--stroke)] bg-[var(--glass-2)] backdrop-blur-md px-4 py-2 text-sm shadow-[var(--shadow-2)]"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
