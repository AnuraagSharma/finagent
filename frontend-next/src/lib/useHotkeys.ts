"use client";

import { useEffect } from "react";

export type HotkeyHandler = (e: KeyboardEvent) => void;

/**
 * Register a global hotkey. Combos like "mod+k", "mod+shift+l", "/", "esc".
 * "mod" = Cmd on macOS, Ctrl elsewhere.
 */
export function useHotkey(combo: string, handler: HotkeyHandler) {
  useEffect(() => {
    const parts = combo
      .toLowerCase()
      .split("+")
      .map((s) => s.trim());
    const needsMod = parts.includes("mod") || parts.includes("ctrl") || parts.includes("cmd");
    const needsShift = parts.includes("shift");
    const needsAlt = parts.includes("alt");
    const key = parts[parts.length - 1];

    function onKey(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      const isMod = e.ctrlKey || e.metaKey;
      if (needsMod && !isMod) return;
      if (!needsMod && isMod && parts.length > 1) return;
      if (needsShift !== e.shiftKey) return;
      if (needsAlt !== e.altKey) return;
      if (k !== key) return;
      handler(e);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [combo, handler]);
}
