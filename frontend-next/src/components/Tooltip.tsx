"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, useRef, useEffect } from "react";

type Placement = "top" | "bottom";

export function Tooltip({
  label,
  children,
  placement = "bottom",
  delay = 200,
}: {
  label: string;
  children: React.ReactNode;
  placement?: Placement;
  delay?: number;
}) {
  if (!label) return <>{children}</>;
  const [open, setOpen] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (t.current) clearTimeout(t.current);
  }, []);

  const show = () => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    if (t.current) clearTimeout(t.current);
    setOpen(false);
  };

  return (
    <span
      className="relative inline-flex min-w-0 max-w-full"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            key="tt"
            initial={{ opacity: 0, y: placement === "bottom" ? -2 : 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className={
              "pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md border border-[var(--stroke)] bg-[var(--glass-2)] px-2 py-1 text-[11.5px] text-[var(--text)] shadow-[var(--shadow-2)] backdrop-blur-md " +
              (placement === "bottom" ? "top-full mt-1.5" : "bottom-full mb-1.5")
            }
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
