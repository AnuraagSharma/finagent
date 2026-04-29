"use client";

import {
  Compass,
  LayoutGrid,
  LibraryBig,
  Settings as SettingsIcon,
  Plus,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
} from "lucide-react";
import { useMemo } from "react";
import { useRecents } from "@/lib/stores";
import { cn } from "@/lib/cn";
import { groupRecentsByTime } from "@/lib/time";
import { Tooltip } from "./Tooltip";

type Props = {
  activeThreadId: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNewChat: () => void;
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
  onNewChat,
  onResume,
  onPickPrompt,
  onOpenSettings,
  onOpenCommandPalette,
}: Props) {
  const { recents, remove } = useRecents();
  const groups = useMemo(() => groupRecentsByTime(recents), [recents]);

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "sticky top-0 flex h-screen flex-col overflow-hidden border-r border-[var(--stroke)] bg-[linear-gradient(180deg,rgba(255,255,255,0.025),transparent_40%)]",
        "transition-[width] duration-200 ease-out",
        collapsed ? "w-[72px]" : "w-[284px]"
      )}
    >
      {/* Top: brand */}
      <div className="flex items-center justify-between gap-2 px-3.5 pt-4 pb-5">
        <Tooltip label={collapsed ? "FinAgent · home" : "Home"}>
          <button
            type="button"
            onClick={onNewChat}
            aria-label="Home / New chat"
            className="flex items-center gap-2.5 rounded-md px-1 py-1 text-left transition-colors hover:bg-white/[0.04]"
          >
            <span
              className="grid h-9 w-9 place-items-center rounded-[11px] text-[#06141b]"
              style={{
                background:
                  "linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)",
                boxShadow: "0 8px 22px var(--accent-glow)",
              }}
            >
              <BrandMark size={17} />
            </span>
            {!collapsed && (
              <span className="flex flex-col leading-tight">
                <span
                  className="text-[16.5px] font-extrabold tracking-[-0.01em]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  FinAgent
                </span>
                <span className="mt-0.5 text-[9.5px] font-bold tracking-[0.24em] text-[var(--muted-2)]">
                  DEEP RESEARCH
                </span>
              </span>
            )}
          </button>
        </Tooltip>
        {!collapsed && (
          <Tooltip label="Collapse · Ctrl+Shift+L">
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="grid h-8 w-8 place-items-center rounded-md text-[var(--muted-2)] hover:bg-white/5 hover:text-[var(--text)]"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose size={15} />
            </button>
          </Tooltip>
        )}
      </div>

      {collapsed && (
        <div className="px-3.5 pb-3">
          <Tooltip label="Expand · Ctrl+Shift+L">
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label="Expand sidebar"
              className="grid h-9 w-10 place-items-center rounded-md border border-[var(--stroke)] text-[var(--muted-2)] hover:bg-white/5 hover:text-[var(--text)]"
            >
              <PanelLeftOpen size={15} />
            </button>
          </Tooltip>
        </div>
      )}

      {/* New Chat */}
      <div className="px-3.5 pb-4">
        {collapsed ? (
          <Tooltip label="New chat">
            <button
              type="button"
              onClick={onNewChat}
              className="grid h-10 w-10 place-items-center rounded-[12px] border border-[var(--stroke-2)] bg-[var(--glass-2)] backdrop-blur-md hover:border-[var(--stroke-accent)] hover:bg-white/5"
              aria-label="New chat"
            >
              <Plus size={16} />
            </button>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={onNewChat}
            className={cn(
              "relative flex w-full items-center justify-center gap-2.5 rounded-[14px] border border-[var(--stroke-2)] bg-[var(--glass-2)] px-3.5 py-2.5 font-bold text-[var(--text)] backdrop-blur-md",
              "shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_6px_20px_rgba(0,0,0,0.18)]",
              "transition-[border-color,background] hover:border-[var(--stroke-accent)] hover:bg-white/5"
            )}
          >
            <span
              className="grid h-[22px] w-[22px] place-items-center rounded-[8px] text-[#06141b]"
              style={{
                background:
                  "linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)",
                boxShadow: "0 4px 14px var(--accent-glow)",
              }}
            >
              <Plus size={14} strokeWidth={3} />
            </span>
            New Chat
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

      {/* Recents */}
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

      {collapsed && <div className="flex-1" />}

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
      className="flex items-center gap-2.5 rounded-[10px] border border-transparent px-2.5 py-2 text-[13.5px] text-[var(--muted)] transition-colors hover:border-[var(--stroke)] hover:bg-white/[0.04] hover:text-[var(--text)]"
    >
      <span className="grid w-5 place-items-center text-[var(--muted-2)]">
        {icon}
      </span>
      <span className="flex-1 text-left">{label}</span>
      {right}
    </button>
  );
}
