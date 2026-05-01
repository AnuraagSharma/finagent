"use client";

import {
  Menu,
  Moon,
  Sun,
  Settings as SettingsIcon,
  ArrowLeft,
  Eraser,
  Download,
  LogOut,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useSettings } from "@/lib/stores";
import { Tooltip } from "./Tooltip";

type Props = {
  title: string;
  scrolled?: boolean;
  inConversation?: boolean;
  onMenu: () => void;
  onHome: () => void;
  /** Optional: when omitted, the Analytics button navigates to /analytics via Link. */
  onAnalytics?: () => void;
  onFeedback: () => void;
  onClear: () => void;
  onExport: () => void;
  onSettings: () => void;
};

/**
 * Top bar for the chat surface.
 *
 * Layout (left → right):
 *   [Mobile menu] [Back] · · · Search · Analytics · Feedback · Avatar▾
 *
 * The bar is intentionally low-chrome: nav items are plain text links with a
 * soft hover background; the only "visual weight" goes to the avatar pill on
 * the right which doubles as the account menu (Theme, Settings, Export, Clear,
 * Sign out).
 */
export function Topbar({
  title: _title,
  scrolled,
  inConversation,
  onMenu,
  onHome,
  onAnalytics,
  onFeedback,
  onClear,
  onExport,
  onSettings,
}: Props) {
  const { theme, setTheme } = useTheme();
  const { userId } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!accountOpen) return;
      const el = accountRef.current;
      if (el && !el.contains(e.target as Node)) setAccountOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAccountOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  const initials = initialsFromUserId(userId);
  const isLight = mounted && theme === "light";

  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--stroke)] bg-[var(--glass)] px-4 py-2.5 backdrop-blur-md transition-shadow",
        scrolled && "topbar-scrolled"
      )}
    >
      {/* Left cluster — mobile menu + back */}
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <Tooltip label="Open menu">
          <button
            type="button"
            onClick={onMenu}
            aria-label="Open menu"
            className={cn(ghostIcon, "lg:hidden")}
          >
            <Menu size={16} />
          </button>
        </Tooltip>

        {inConversation && (
          <Tooltip label="Back to home">
            <button
              type="button"
              onClick={onHome}
              aria-label="Back to home"
              className={navLink}
            >
              <ArrowLeft size={14} />
              <span className="hidden sm:inline">Back</span>
            </button>
          </Tooltip>
        )}
      </div>

      {/* Right cluster — text nav links + avatar */}
      <div className="flex items-center gap-1">
        {onAnalytics ? (
          <button
            type="button"
            onClick={onAnalytics}
            className={cn(navLink, "hidden md:inline-flex")}
          >
            Analytics
          </button>
        ) : (
          <Link
            href="/analytics"
            className={cn(navLink, "hidden md:inline-flex")}
          >
            Analytics
          </Link>
        )}

        <button
          type="button"
          onClick={onFeedback}
          className={cn(navLink, "hidden md:inline-flex")}
        >
          Feedback
        </button>

        {/* Account pill — initials + chevron, opens menu */}
        <div className="relative ml-1.5" ref={accountRef}>
          <button
            type="button"
            onClick={() => setAccountOpen((v) => !v)}
            aria-label="Account menu"
            aria-haspopup="menu"
            aria-expanded={accountOpen}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--stroke)] bg-[var(--hover-soft)] py-0.5 pl-0.5 pr-2 transition-colors",
              "hover:border-[var(--stroke-2)] hover:bg-[var(--hover-stronger)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40",
              accountOpen && "border-[var(--stroke-2)] bg-[var(--hover-stronger)]"
            )}
          >
            <span
              className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[var(--panel-2)] to-[var(--bg-1)] text-[11px] font-extrabold tracking-tight text-[var(--text)] ring-1 ring-inset ring-[var(--stroke-2)]"
              aria-hidden
            >
              {initials}
            </span>
            <ChevronDown
              size={13}
              className={cn(
                "text-[var(--muted-2)] transition-transform",
                accountOpen && "rotate-180 text-[var(--text)]"
              )}
            />
          </button>

          {accountOpen && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+8px)] z-20 w-[240px] overflow-hidden rounded-[14px] border border-[var(--stroke-2)] bg-[var(--panel-2)] py-1.5 shadow-[var(--shadow-2)] ring-inset-soft"
            >
              {/* Identity header */}
              <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-1">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--panel-2)] to-[var(--bg-1)] text-[12px] font-extrabold tracking-tight text-[var(--text)] ring-1 ring-inset ring-[var(--stroke-2)]">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted-2)]">
                    Account
                  </div>
                  <div className="truncate font-mono text-[12px] text-[var(--text)]">
                    {userId || "—"}
                  </div>
                </div>
              </div>

              <Divider />

              <MenuItem
                Icon={isLight ? Moon : Sun}
                label={isLight ? "Switch to dark mode" : "Switch to light mode"}
                onClick={() => {
                  setAccountOpen(false);
                  setTheme(isLight ? "dark" : "light");
                }}
              />
              <MenuItem
                Icon={SettingsIcon}
                label="Settings"
                onClick={() => {
                  setAccountOpen(false);
                  onSettings();
                }}
              />

              <Divider />

              <MenuItem
                Icon={Download}
                label="Export as Markdown"
                onClick={() => {
                  setAccountOpen(false);
                  onExport();
                }}
              />
              <MenuItem
                Icon={Eraser}
                label="Clear chat"
                tone="danger"
                onClick={() => {
                  setAccountOpen(false);
                  onClear();
                }}
              />

              <Divider />

              <MenuItem
                Icon={LogOut}
                label="Sign out"
                onClick={() => setAccountOpen(false)}
                disabled
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared button styles                                              */
/* ------------------------------------------------------------------ */

const ghostIcon =
  "grid h-9 w-9 place-items-center rounded-[10px] text-[var(--muted)] transition-colors " +
  "hover:bg-[var(--hover-soft)] hover:text-[var(--text)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40";

const navLink =
  "text-btn inline-flex h-9 items-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-semibold " +
  "text-[var(--muted)] transition-colors " +
  "hover:bg-[var(--hover-soft)] hover:text-[var(--text)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40";

function MenuItem({
  Icon,
  label,
  onClick,
  disabled,
  tone,
}: {
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "danger";
}) {
  const colorClass = disabled
    ? "cursor-not-allowed text-[var(--muted-3)]"
    : tone === "danger"
    ? "text-[var(--loss)] hover:bg-[var(--loss-soft)]"
    : "text-[var(--muted)] hover:bg-[var(--hover-soft)] hover:text-[var(--text)]";
  const iconClass = disabled
    ? "text-[var(--muted-3)]"
    : tone === "danger"
    ? "text-[var(--loss)]"
    : "text-[var(--muted-2)]";
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors",
        colorClass
      )}
    >
      <Icon size={13} className={iconClass} />
      {label}
    </button>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-[var(--stroke)]" />;
}

/**
 * Derive ~2-character initials from a user identifier.
 *
 * Cases handled:
 *  - email → first letter of local part + first letter of domain ("john@acme" → "JA")
 *  - "First Last" / "first_last" / "first-last" → "FL"
 *  - falls back to first 2 letters of the string
 */
function initialsFromUserId(uid: string): string {
  if (!uid) return "?";
  if (uid.includes("@")) {
    const [local = "", domain = ""] = uid.split("@");
    return ((local[0] || "") + (domain[0] || "")).toUpperCase();
  }
  const parts = uid.split(/[\s_-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return uid.slice(0, 2).toUpperCase();
}
