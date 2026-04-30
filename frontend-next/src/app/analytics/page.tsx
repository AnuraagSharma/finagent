"use client";

import { ArrowLeft, RefreshCw } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Filters } from "@/components/analytics/Filters";
import { SessionDetailDrawer } from "@/components/analytics/SessionDetailDrawer";
import { SessionsTab } from "@/components/analytics/SessionsTab";
import { SummaryTab } from "@/components/analytics/SummaryTab";
import { TrendsTab } from "@/components/analytics/TrendsTab";
import { TurnLogsTab } from "@/components/analytics/TurnLogsTab";
import { UsersTab } from "@/components/analytics/UsersTab";
import { Sidebar } from "@/components/Sidebar";
import { Tooltip } from "@/components/Tooltip";
import { cn } from "@/lib/cn";
import { writeStoredActiveSession, clearStoredActiveSession } from "@/lib/activeSession";
import {
  exportAnalyticsCsvUrl,
  getAnalyticsSessionDetail,
  getAnalyticsSessions,
  getAnalyticsSummary,
  getAnalyticsTrends,
  getAnalyticsTurns,
  getAnalyticsUsers,
  type AnalyticsFilters,
  type AnalyticsSessionDetail,
  type AnalyticsSessions,
  type AnalyticsSummary,
  type AnalyticsTrends,
  type AnalyticsTurns,
  type AnalyticsUsers,
  type SessionRow,
  type TurnRow,
} from "@/lib/api";
import { useSettings } from "@/lib/stores";

type Tab = "summary" | "users" | "turns" | "sessions" | "trends";

const TABS: { id: Tab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "users", label: "Users" },
  { id: "turns", label: "Turn Logs" },
  { id: "sessions", label: "Sessions" },
  { id: "trends", label: "Trend Analysis" },
];

/**
 * The /analytics dashboard.
 *
 * Single-route page that hosts the 5-tab analytics view (Summary, Users, Turn Logs,
 * Sessions, Trend Analysis). Filter state is mirrored into the URL search params so
 * a refresh keeps the user where they were and links can be shared.
 *
 * Live refresh: polls the active tab's endpoint every 15s while the tab has focus and
 * the user isn't actively interacting (interaction resets the cooldown so we don't
 * stomp on a paginating / sort change in flight).
 */
export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-[var(--bg)]" />}>
      <AnalyticsPageInner />
    </Suspense>
  );
}

function AnalyticsPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const { backendUrl, userId } = useSettings();
  const prefersReducedMotion = useReducedMotion();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [tab, setTab] = useState<Tab>(() => normalizeTab(search.get("tab")));
  const [filters, setFilters] = useState<AnalyticsFilters>(() =>
    paramsToFilters(search)
  );
  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly">(
    () => (search.get("g") as "daily" | "weekly" | "monthly") || "daily"
  );
  const [page, setPage] = useState<number>(() => Math.max(1, Number(search.get("p")) || 1));
  const [sort, setSort] = useState<"created_at" | "latency_ms" | "total_tokens" | "cost_usd" | "step_count" | "tool_count">(
    () => (search.get("sort") as "created_at" | "latency_ms" | "total_tokens" | "cost_usd" | "step_count" | "tool_count") || "created_at"
  );
  const [direction, setDirection] = useState<"asc" | "desc">(
    () => (search.get("dir") as "asc" | "desc") || "desc"
  );

  // Per-tab data. Keep cached so flipping tabs feels instant.
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [users, setUsers] = useState<AnalyticsUsers | null>(null);
  const [turns, setTurns] = useState<AnalyticsTurns | null>(null);
  const [sessions, setSessions] = useState<AnalyticsSessions | null>(null);
  const [trends, setTrends] = useState<AnalyticsTrends | null>(null);

  const [loading, setLoading] = useState<Record<Tab, boolean>>({
    summary: false,
    users: false,
    turns: false,
    sessions: false,
    trends: false,
  });
  const [error, setError] = useState<string | null>(null);

  // Session detail drawer
  const [drawer, setDrawer] = useState<{
    open: boolean;
    threadId: string | null;
    title: string;
    data: AnalyticsSessionDetail | null;
    loading: boolean;
  }>({ open: false, threadId: null, title: "", data: null, loading: false });

  // Sync state into URL whenever it changes — but cheaply (replace).
  const writeUrl = useCallback(() => {
    const sp = new URLSearchParams();
    sp.set("tab", tab);
    if (filters.from) sp.set("from", filters.from);
    if (filters.to) sp.set("to", filters.to);
    if (filters.status && filters.status !== "all") sp.set("status", filters.status);
    if (filters.errorType) sp.set("error_type", filters.errorType);
    if (filters.userId) sp.set("user_id", filters.userId);
    if (filters.feedback && filters.feedback !== "all") sp.set("feedback", filters.feedback);
    if (granularity !== "daily") sp.set("g", granularity);
    if (page !== 1) sp.set("p", String(page));
    if (sort !== "created_at") sp.set("sort", sort);
    if (direction !== "desc") sp.set("dir", direction);
    router.replace(`/analytics?${sp.toString()}`, { scroll: false });
  }, [tab, filters, granularity, page, sort, direction, router]);

  useEffect(() => {
    writeUrl();
  }, [writeUrl]);

  // Fetch the active tab's data. Other tabs lazy-load when first opened and on refresh.
  const fetchTab = useCallback(
    async (which: Tab, opts: { background?: boolean } = {}) => {
      setLoading((s) => ({ ...s, [which]: !opts.background }));
      setError(null);
      try {
        if (which === "summary") {
          // Summary view depends on both the summary endpoint and the users
          // endpoint (for Feedback Mix + Top 5 Users panels). Fire them in
          // parallel so the tab feels snappy.
          const [d, u] = await Promise.all([
            getAnalyticsSummary({
              backendUrl,
              userId,
              filters,
              granularity,
            }),
            getAnalyticsUsers({ backendUrl, userId, filters }).catch(() => null),
          ]);
          setSummary(d);
          if (u) setUsers(u);
        } else if (which === "users") {
          const d = await getAnalyticsUsers({ backendUrl, userId, filters });
          setUsers(d);
        } else if (which === "turns") {
          const d = await getAnalyticsTurns({
            backendUrl,
            userId,
            filters,
            page,
            pageSize: 25,
            sort,
            direction,
          });
          setTurns(d);
        } else if (which === "sessions") {
          const d = await getAnalyticsSessions({ backendUrl, userId, filters, page: 1, pageSize: 100 });
          setSessions(d);
        } else if (which === "trends") {
          const d = await getAnalyticsTrends({
            backendUrl,
            userId,
            filters,
            granularity,
          });
          setTrends(d);
        }
      } catch (e: unknown) {
        const msg = (e as { message?: string })?.message || String(e);
        setError(msg);
      } finally {
        setLoading((s) => ({ ...s, [which]: false }));
      }
    },
    [backendUrl, userId, filters, granularity, page, sort, direction]
  );

  // Load the active tab whenever its inputs change.
  useEffect(() => {
    void fetchTab(tab);
  }, [fetchTab, tab]);

  // Live refresh — polls the active tab in the background every 15s while the page is visible
  // and the user hasn't interacted in the last 4s. Background fetches don't show the skeleton.
  const lastInteractionRef = useRef<number>(Date.now());
  useEffect(() => {
    function bump() {
      lastInteractionRef.current = Date.now();
    }
    window.addEventListener("mousedown", bump);
    window.addEventListener("keydown", bump);
    window.addEventListener("scroll", bump, { passive: true });
    return () => {
      window.removeEventListener("mousedown", bump);
      window.removeEventListener("keydown", bump);
      window.removeEventListener("scroll", bump);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      const idleMs = Date.now() - lastInteractionRef.current;
      if (idleMs < 4000) return;
      void fetchTab(tab, { background: true });
    }, 15000);
    return () => window.clearInterval(id);
  }, [fetchTab, tab]);

  // Drawer open/load helper
  const openSession = useCallback(
    async (row: SessionRow) => {
      setDrawer({ open: true, threadId: row.thread_id, title: row.first_message || row.thread_id, data: null, loading: true });
      try {
        const d = await getAnalyticsSessionDetail({
          backendUrl,
          userId,
          threadId: row.thread_id,
        });
        setDrawer((s) => ({ ...s, data: d, loading: false }));
      } catch (e: unknown) {
        const msg = (e as { message?: string })?.message || String(e);
        setError(`Couldn't load session: ${msg}`);
        setDrawer((s) => ({ ...s, loading: false }));
      }
    },
    [backendUrl, userId]
  );

  const exportUrl = useMemo(() => {
    const tabKey: "turns" | "users" | "sessions" =
      tab === "users" ? "users" : tab === "sessions" ? "sessions" : "turns";
    return exportAnalyticsCsvUrl({ backendUrl, filters, tab: tabKey });
  }, [backendUrl, filters, tab]);

  const exportDisabled = !(tab === "users" || tab === "sessions" || tab === "turns");

  function handleExport() {
    if (exportDisabled) return;
    // Forward-link to the backend route. Use a hidden anchor so we don't navigate away.
    const a = document.createElement("a");
    a.href = exportUrl;
    a.download = "";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function handleClearAll() {
    setFilters({ from: null, to: null, status: "all", errorType: null, userId: null, feedback: "all" });
    setPage(1);
  }

  // Sidebar back-callbacks for the chat. Most navigate back to / and let the chat page
  // pick up wherever it left off. Resume via sessionStorage hook the chat page already uses.
  const goNew = () => {
    clearStoredActiveSession();
    router.push("/");
  };
  const goResume = (threadId: string, title: string) => {
    writeStoredActiveSession({ threadId, title });
    router.push("/");
  };

  return (
    <div className="flex h-screen min-h-0 flex-col lg:flex-row">
      <motion.div
        className="relative z-[100] hidden h-screen min-h-0 shrink-0 overflow-hidden lg:block"
        initial={false}
        animate={{ width: sidebarCollapsed ? 72 : 284 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.08, ease: "easeOut" }
            : { type: "tween", duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }
        }
      >
        <div className="h-full" style={{ width: 284 }}>
          <Sidebar
            activeThreadId={null}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
            onNewChat={goNew}
            onResume={goResume}
            onPickPrompt={() => router.push("/")}
            onOpenSettings={() => router.push("/")}
            onOpenCommandPalette={() => router.push("/")}
          />
        </div>
      </motion.div>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex flex-col gap-3 border-b border-[var(--stroke)] bg-[var(--glass)] px-5 py-3.5 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-baseline gap-3">
              <span
                className="text-[18px] font-extrabold tracking-tight text-[var(--text)]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                FinAgent
              </span>
              <span className="text-[15px] font-bold text-[var(--muted)]">
                Analytics Dashboard
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip label="Refresh">
                <button
                  type="button"
                  onClick={() => fetchTab(tab)}
                  className="grid h-9 w-9 place-items-center rounded-[10px] border border-[var(--stroke)] text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)]"
                  aria-label="Refresh"
                >
                  <RefreshCw size={14} />
                </button>
              </Tooltip>
              <Link
                href="/"
                className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[var(--stroke)] px-2.5 text-[12.5px] font-semibold text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)]"
              >
                <ArrowLeft size={13} />
                Back to Chat
              </Link>
            </div>
          </div>

          <nav
            className="flex items-center gap-1 overflow-x-auto"
            aria-label="Analytics sections"
          >
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    setTab(t.id);
                    setPage(1);
                  }}
                  className={cn(
                    "relative inline-flex h-9 items-center rounded-[10px] px-3 text-[13px] font-semibold transition-colors",
                    active
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "text-[var(--muted)] hover:bg-[var(--hover-soft)] hover:text-[var(--text)]"
                  )}
                >
                  {t.label}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute -bottom-[14px] left-3 right-3 h-[2px] rounded-full bg-[var(--accent)]"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </header>

        <Filters
          filters={filters}
          onChange={(next) => {
            setFilters(next);
            setPage(1);
          }}
          onClearAll={handleClearAll}
          onExport={handleExport}
          exportDisabled={exportDisabled}
        />

        <div className="scroll-area flex-1 overflow-auto px-5 py-5">
          <div className="mx-auto w-full max-w-[1480px]">
            {error && (
              <div className="mb-4 rounded-[12px] border border-[var(--loss)]/40 bg-[var(--loss)]/10 px-3 py-2 text-[12.5px] text-[var(--loss)]">
                {error}
              </div>
            )}

            {tab === "summary" && (
              <SummaryTab
                data={summary}
                users={users}
                loading={loading.summary}
                onPickUser={(u) => {
                  setFilters((f) => ({ ...f, userId: u }));
                  setTab("users");
                }}
              />
            )}
            {tab === "users" && (
              <UsersTab
                data={users}
                loading={loading.users}
                onPickUser={(u) => setFilters((f) => ({ ...f, userId: u }))}
              />
            )}
            {tab === "turns" && (
              <TurnLogsTab
                data={turns}
                loading={loading.turns}
                page={page}
                pageSize={25}
                sort={sort}
                direction={direction}
                onChangePage={setPage}
                onChangeSort={(k, d) => {
                  setSort(k);
                  setDirection(d);
                }}
                onPickUser={(u) => setFilters((f) => ({ ...f, userId: u }))}
                onPickThread={(row: TurnRow) =>
                  openSession({
                    thread_id: row.thread_id,
                    user_id: row.user_id,
                    turns: 1,
                    total_cost_usd: row.cost_usd ?? 0,
                    total_duration_ms: row.latency_ms ?? null,
                    first_active: row.created_at,
                    last_active: row.created_at,
                    first_message: row.user_message,
                  })
                }
              />
            )}
            {tab === "sessions" && (
              <SessionsTab
                data={sessions}
                loading={loading.sessions}
                onPick={openSession}
              />
            )}
            {tab === "trends" && (
              <TrendsTab
                data={trends}
                loading={loading.trends}
                granularity={granularity}
                onChangeGranularity={setGranularity}
              />
            )}
          </div>
        </div>
      </main>

      <SessionDetailDrawer
        open={drawer.open}
        loading={drawer.loading}
        data={drawer.data}
        onClose={() => setDrawer((s) => ({ ...s, open: false }))}
        onResume={() => {
          if (drawer.threadId) {
            writeStoredActiveSession({
              threadId: drawer.threadId,
              title: drawer.title || drawer.threadId,
            });
            router.push("/");
          }
        }}
      />
    </div>
  );
}

function normalizeTab(v: string | null): Tab {
  return v === "users" || v === "turns" || v === "sessions" || v === "trends"
    ? v
    : "summary";
}

function paramsToFilters(sp: URLSearchParams): AnalyticsFilters {
  return {
    from: sp.get("from"),
    to: sp.get("to"),
    status: (sp.get("status") as AnalyticsFilters["status"]) || "all",
    errorType: sp.get("error_type"),
    userId: sp.get("user_id"),
    feedback: (sp.get("feedback") as AnalyticsFilters["feedback"]) || "all",
  };
}
