"use client";

import {
  Compass,
  LayoutGrid,
  LibraryBig,
  Settings as SettingsIcon,
  Plus,
  Search,
  ChevronLeft,
  Trash2,
} from "lucide-react";
import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRecents } from "@/lib/stores";
import { cn } from "@/lib/cn";
import { groupRecentsByTime } from "@/lib/time";
import { Tooltip } from "./Tooltip";

type Props = {
  activeThreadId: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNewChat: () => void;
  /** When sidebar is rendered as a sliding overlay (e.g. mobile drawer), reuse brand row as "close" instead of width toggle. */
  brandToggleDismissesOverlay?: boolean;
  onResume: (threadId: string, title: string) => void;
  onPickPrompt: (prompt: string) => void;
  onOpenSettings: () => void;
  onOpenCommandPalette: () => void;
};

/**
 * Custom FinAgent mark — stylised "F" formed by an upward candle + chevron.
 * Looks bespoke and on-brand for finance.
 */
function BrandMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M5 19V5h11"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 12h7"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M14 14l3-3 3 3"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Sidebar({
  activeThreadId,
  collapsed,
  onToggleCollapsed,
  brandToggleDismissesOverlay,
  onNewChat,
  onResume,
  onPickPrompt,
  onOpenSettings,
  onOpenCommandPalette,
}: Props) {
  const { recents, remove } = useRecents();
  const groups = useMemo(() => groupRecentsByTime(recents), [recents]);

  const collapseLabel =
    brandToggleDismissesOverlay === true ? "Close menu" : "Collapse sidebar";

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "relative isolate sticky top-0 flex h-full min-h-screen w-full flex-col overflow-hidden border-r border-[var(--stroke)] bg-[linear-gradient(180deg,rgba(255,255,255,0.025),transparent_40%)]",
        "motion-reduce:!transition-none motion-reduce:!duration-0 transition-[border-color,box-shadow] duration-300 ease-out"
      )}
    >
      {/* Brand row — min height on large screens so stacked vs row brand does not shift New Chat / nav */}
      <div className="flex w-full min-w-0 items-stretch px-3.5 pb-5 pt-4 lg:min-h-[7.125rem]">
        {/* Plain button + no Tooltip — avoids hover tooltips / motion press on sidebar chrome */}
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : collapseLabel}
          className={cn(
            // No border / ring-offset — avoids a visible “square box” during collapse animations
            "relative flex h-full min-h-[3.125rem] w-full shrink-0 bg-transparent text-left shadow-none outline-none ring-0 ring-offset-0",
            "focus-visible:outline-none focus-visible:ring-0",
            collapsed
              ? "flex-col items-center justify-center gap-1 rounded-full px-0 py-2"
              : "min-w-0 flex-row items-center gap-2 rounded-[14px] px-1 py-1 pr-2"
          )}
        >
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[#06141b]"
            style={{
              background:
                "linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)",
              boxShadow: "0 8px 22px var(--accent-glow)",
            }}
          >
            <BrandMark size={17} />
          </span>
          <AnimatePresence mode="wait" initial={false}>
            {collapsed ? (
              <motion.div
                key="collapse-chev"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className="flex justify-center"
              >
                <ChevronLeft
                  size={13}
                  strokeWidth={2.75}
                  className="text-[var(--accent)] opacity-95"
                  style={{ transform: "rotate(180deg)" }}
                  aria-hidden
                />
              </motion.div>
            ) : (
              <motion.div
                key="expanded-brand"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className="flex min-w-0 flex-1 flex-row items-center gap-2 pr-0.5"
              >
                <span className="flex min-w-0 flex-1 flex-col overflow-hidden leading-tight">
                  <span
                    className="text-[16.5px] font-extrabold tracking-[-0.01em] text-[var(--text)]"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    FinAgent
                  </span>
                  <span className="mt-0.5 truncate text-[9.5px] font-bold tracking-[0.22em] text-[var(--muted-2)]">
                    DEEP RESEARCH
                  </span>
                </span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--muted-3)]">
                  <ChevronLeft
                    size={16}
                    strokeWidth={2.75}
                    aria-hidden
                  />
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Middle: offset on large screens so New Chat + Explore line up with the hero headline (main column sits under the top bar). */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className={cn(
            "shrink-0",
            // Same offset expanded vs collapsed so + / Explore / … do not jump when toggling the rail
            "lg:pt-14 xl:pt-[4.75rem]"
          )}
        >
          {/* New Chat */}
          {/* New Chat — locked row height so + control doesn’t jog vs expanded */}
          <div className="flex min-h-9 items-center px-3.5 pb-4">
            {collapsed ? (
              <button
                type="button"
                onClick={onNewChat}
                className="grid h-9 w-10 place-items-center rounded-md text-[var(--muted-2)] [contain:paint] transition-none hover:bg-white/[0.04] hover:text-[var(--text)]"
                aria-label="New chat"
              >
                <Plus size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={onNewChat}
                className="flex min-h-9 w-full items-center gap-2.5 rounded-[10px] border border-transparent px-2.5 py-2 text-left text-[13.5px] font-semibold text-[var(--muted)] transition-colors hover:border-[var(--stroke)] hover:bg-white/[0.04] hover:text-[var(--text)]"
              >
                <span className="grid w-5 shrink-0 place-items-center text-[var(--muted-2)]">
                  <span
                    className="grid h-5 w-5 place-items-center rounded-full text-[#06141b]"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)",
                      boxShadow: "0 2px 10px var(--accent-glow)",
                    }}
                  >
                    <Plus size={13} strokeWidth={3} />
                  </span>
                </span>
                <span className="min-w-0 flex-1">New Chat</span>
              </button>
            )}
          </div>

          {/* Nav */}
          <nav className="flex flex-col gap-0.5 px-3.5">
            <NavItem
              collapsed={collapsed}
              icon={<Compass size={15} />}
              label="Explore"
              onClick={() => onPickPrompt("Explain stock market trends briefly")}
            />
            <NavItem
              collapsed={collapsed}
              icon={<LayoutGrid size={15} />}
              label="Categories"
              onClick={() =>
                onPickPrompt(
                  "List the categories of equity research questions you can answer"
                )
              }
            />
            <NavItem
              collapsed={collapsed}
              icon={<LibraryBig size={15} />}
              label="Library"
              right={
                <span className="num inline-flex h-[18px] min-w-[22px] items-center justify-center rounded-full border border-[var(--stroke)] bg-[var(--accent-soft)] px-1.5 text-[10.5px] font-bold text-[var(--accent)]">
                  {recents.length}
                </span>
              }
              onClick={() => {
                const el = document.getElementById("recents");
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            />
            <NavItem
              collapsed={collapsed}
              icon={<SettingsIcon size={15} />}
              label="Settings"
              onClick={onOpenSettings}
            />
          </nav>
        </div>

        {/* Recents + fill (inside middle column so offset still applies above) */}
        {!collapsed && (
          <>
            <div className="mt-5 flex items-center justify-between px-3.5 pb-1.5">
              <div className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-[var(--muted-2)]">
                Recent
              </div>
              <Tooltip label="Search · Ctrl+K">
                <button
                  type="button"
                  onClick={onOpenCommandPalette}
                  aria-label="Search chats"
                  className="grid h-6 w-6 place-items-center rounded-md text-[var(--muted-3)] hover:bg-white/5 hover:text-[var(--text)]"
                >
                  <Search size={12} />
                </button>
              </Tooltip>
            </div>

            <div
              id="recents"
              className="scroll-area mt-1 flex-1 overflow-auto px-2 pb-2"
            >
              {recents.length === 0 ? (
                <div className="px-2 text-[12.5px] text-[var(--muted-3)]">
                  No chats yet — start one above.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {groups.map((g) => (
                    <div key={g.label}>
                      <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted-3)]">
                        {g.label}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {g.items.map((r) => {
                          const active = activeThreadId === r.threadId;
                          return (
                            <div
                              key={r.threadId}
                              className={cn(
                                "group relative flex items-center gap-1 rounded-[10px] border border-transparent px-2 transition-colors",
                                active
                                  ? "border-[var(--stroke-accent)] bg-[var(--accent-soft)]"
                                  : "hover:border-[var(--stroke)] hover:bg-white/[0.035]"
                              )}
                            >
                              {active && (
                                <span
                                  aria-hidden
                                  className="absolute -left-px top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-[var(--accent)]"
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => onResume(r.threadId, r.title)}
                                title={r.threadId}
                                className={cn(
                                  "flex-1 truncate py-2 text-left text-[13px]",
                                  active
                                    ? "text-[var(--text)]"
                                    : "text-[var(--muted)] group-hover:text-[var(--text)]"
                                )}
                              >
                                {r.title || "Untitled"}
                              </button>
                              <Tooltip label="Remove">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    remove(r.threadId);
                                  }}
                                  className="grid h-7 w-7 place-items-center rounded-md text-[var(--muted-3)] opacity-0 transition-opacity hover:bg-white/5 hover:text-[var(--loss)] group-hover:opacity-100"
                                  aria-label="Remove from recents"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </Tooltip>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {collapsed && <div className="min-h-0 flex-1" />}

      </div>
      {/* end middle column */}

      {/* Foot status */}
      <div className="mt-auto flex items-center gap-2 border-t border-[var(--stroke)] px-3 pb-2.5 pt-3 text-[12px] text-[var(--muted-2)]">
        <span className="status-dot" />
        {!collapsed && (
          <span className="flex flex-1 items-center justify-between">
            <span>Online</span>
            <span className="num font-mono text-[10.5px] text-[var(--muted-3)]">
              v0.1
            </span>
          </span>
        )}
      </div>
    </aside>
  );
}

function NavItem({
  icon,
  label,
  right,
  onClick,
  collapsed,
}: {
  icon: React.ReactNode;
  label: string;
  right?: React.ReactNode;
  onClick: () => void;
  collapsed: boolean;
}) {
  if (collapsed) {
    return (
      <Tooltip label={label}>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className="grid h-9 w-10 place-items-center rounded-md text-[var(--muted-2)] hover:bg-white/[0.04] hover:text-[var(--text)]"
        >
          {icon}
        </button>
      </Tooltip>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-9 w-full items-center gap-2.5 rounded-[10px] border border-transparent px-2.5 py-2 text-[13.5px] text-[var(--muted)] transition-colors hover:border-[var(--stroke)] hover:bg-white/[0.04] hover:text-[var(--text)]"
    >
      <span className="grid w-5 place-items-center text-[var(--muted-2)]">
        {icon}
      </span>
      <span className="flex-1 text-left">{label}</span>
      {right}
    </button>
  );
}
