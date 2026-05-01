"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { Hero } from "@/components/Hero";
import { Composer, type ComposerHandle } from "@/components/Composer";
import { Bubble } from "@/components/Bubble";
import { StreamingBubble } from "@/components/StreamingBubble";
import { TaskCard, type TaskStep } from "@/components/TaskCard";
import { Sheet } from "@/components/Sheet";
import { SettingsModal } from "@/components/SettingsModal";
import { FeedbackView } from "@/components/FeedbackView";
import { MobileDrawer } from "@/components/MobileDrawer";
import { CommandPalette } from "@/components/CommandPalette";
import { useToast } from "@/components/Toaster";
import { cn } from "@/lib/cn";
import { useRecents, useSessionFeedback, useSettings } from "@/lib/stores";
import {
  clearStoredActiveSession,
  readStoredActiveSession,
  writeStoredActiveSession,
} from "@/lib/activeSession";
import { getThreadHistory, streamAgent } from "@/lib/api";
import { useHotkey } from "@/lib/useHotkeys";
import type { ChatMessage, StepEvent, TodoItem, TurnSummary } from "@/lib/types";

function prettyName(name: string) {
  return String(name || "step").replace(/[_-]+/g, " ");
}


export default function Home() {
  const { userId, backendUrl } = useSettings();
  const prefersReducedMotion = useReducedMotion();
  const { upsert } = useRecents();
  const show = useToast((s) => s.show);

  const [threadId, setThreadId] = useState<string | null>(null);
  const [topbarTitle, setTopbarTitle] = useState("New chat");
  const [transcript, setTranscript] = useState<ChatMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  // Streaming state
  const [streaming, setStreaming] = useState(false);
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [taskDone, setTaskDone] = useState(false);
  const [taskMs, setTaskMs] = useState<number | null>(null);
  const [taskVisible, setTaskVisible] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingMeta, setStreamingMeta] = useState<string | null>(null);
  const [streamFinalized, setStreamFinalized] = useState(false);
  const [scrollPinned, setScrollPinned] = useState(true);
  const [topbarScrolled, setTopbarScrolled] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  /** Mirrors streaming assistant text so Stop can persist a partial bubble. */
  const streamAccumRef = useRef("");
  /** Bumped when starting a new navigation context so stale stream callbacks are ignored. */
  const streamEpochRef = useRef(0);
  /** Thread id for the in-flight streamed turn (continuation or backend start). */
  const streamThreadIdRef = useRef<string | null>(null);
  /** Mirrors steps/todos so onDone (closure-captured) can snapshot the latest state for the bubble's persistent summary. */
  const stepsRef = useRef<TaskStep[]>([]);
  const todosRef = useRef<TodoItem[]>([]);
  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);
  useEffect(() => {
    todosRef.current = todos;
  }, [todos]);

  // Sheets / modals
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Status text
  const [status, setStatus] = useState("Ready.");

  const composerRef = useRef<ComposerHandle | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const restoredSessionRef = useRef(false);

  // Scroll listener
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    function onScroll() {
      const distance = el!.scrollHeight - el!.scrollTop - el!.clientHeight;
      setScrollPinned(distance < 80);
      setTopbarScrolled(el!.scrollTop > 6);
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Auto-scroll only if pinned to bottom
  useEffect(() => {
    if (scrollPinned) scrollToBottom();
  }, [transcript, streamingText, taskVisible, scrollPinned, scrollToBottom]);

  // Hotkeys
  useHotkey("mod+k", (e) => {
    e.preventDefault();
    setPaletteOpen(true);
  });
  useHotkey("mod+/", (e) => {
    e.preventDefault();
    composerRef.current?.focus();
    composerRef.current?.pulse();
  });
  useHotkey("mod+shift+l", (e) => {
    e.preventDefault();
    setSidebarCollapsed((v) => !v);
  });

  const resumeThread = useCallback(
    async (id: string, title: string) => {
      streamEpochRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      streamAccumRef.current = "";
      streamThreadIdRef.current = null;
      setStreaming(false);
      setThreadId(id);
      setTranscript([]);
      setSteps([]);
      setTodos([]);
      setTaskVisible(false);
      setStreamingText("");
      setStreamingMeta(null);
      setStreamFinalized(false);
      setTopbarTitle(title || "Resumed chat");
      setStatus("Loading history…");
      setHistoryLoading(true);
      try {
        const data = await getThreadHistory({
          backendUrl,
          userId,
          threadId: id,
        });
        if (data.messages.length === 0) {
          setTranscript([]);
          show("No prior history; continue the conversation.");
        } else {
          setTranscript(
            data.messages.map((m) => ({
              role: m.role,
              text: m.text,
              ts: Date.now(),
            }))
          );
        }
        setStatus("Ready.");
      } catch (e: unknown) {
        const err = e as { message?: string };
        setStatus("History unavailable.");
        clearStoredActiveSession();
        setThreadId(null);
        setTopbarTitle("New chat");
        show(`History error: ${err.message || String(e)}`);
      } finally {
        setHistoryLoading(false);
      }
    },
    [backendUrl, userId, show]
  );

  /** After reload: resume last active thread from sessionStorage. */
  useLayoutEffect(() => {
    if (restoredSessionRef.current) return;
    const saved = readStoredActiveSession();
    if (!saved) return;
    restoredSessionRef.current = true;
    void resumeThread(saved.threadId, saved.title);
  }, [resumeThread]);

  /** Keep active thread across refresh (never clear here when threadId is null — that used to wipe storage before restore on mount). */
  useEffect(() => {
    if (!threadId) return;
    writeStoredActiveSession({ threadId, title: topbarTitle });
  }, [threadId, topbarTitle]);

  function newChat() {
    streamEpochRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    clearStoredActiveSession();
    streamAccumRef.current = "";
    streamThreadIdRef.current = null;
    // Wipe the session 👍 / 👎 counter so the Feedback sheet doesn't show
    // reactions from the previous conversation.
    useSessionFeedback.getState().reset();
    setStreaming(false);
    setThreadId(null);
    setTranscript([]);
    setSteps([]);
    setTodos([]);
    setTaskDone(false);
    setTaskMs(null);
    setTaskVisible(false);
    setStreamingText("");
    setStreamingMeta(null);
    setStreamFinalized(false);
    setTopbarTitle("New chat");
    setStatus("Ready.");
    composerRef.current?.focus();
  }

  function pickPrompt(text: string) {
    composerRef.current?.setValue(text);
    composerRef.current?.pulse();
  }

  function exportChat() {
    if (transcript.length === 0) {
      show("Nothing to export.");
      return;
    }
    const lines: string[] = [];
    lines.push(`# FinAgent transcript`);
    lines.push(`Thread: ${threadId || "(none)"}\n`);
    for (const t of transcript) {
      lines.push(`## ${t.role === "user" ? "You" : "Assistant"}`);
      lines.push(t.text || "");
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finagent-${(threadId || "chat").slice(0, 8)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    show("Exported.");
  }

  function stopStream() {
    abortRef.current?.abort();
  }

  function pushUser(text: string) {
    setTranscript((prev) => [...prev, { role: "user", text, ts: Date.now() }]);
  }

  function pushAssistantFinal(
    text: string,
    meta?: string,
    summary?: TurnSummary
  ) {
    setTranscript((prev) => [
      ...prev,
      { role: "assistant", text, ts: Date.now(), summary },
    ]);
    setStreamingText("");
    setStreamingMeta(meta || null);
    setStreamFinalized(true);
    setTimeout(() => {
      setStreamingMeta(null);
      setStreamFinalized(false);
    }, 50);
  }

  function regenerateLast() {
    // Find last user message
    for (let i = transcript.length - 1; i >= 0; i--) {
      if (transcript[i].role === "user") {
        const userMsg = transcript[i];
        // Drop everything after that user message (including the failed assistant reply)
        setTranscript((prev) => prev.slice(0, i + 1));
        // Resend (without re-pushing user)
        send(userMsg.text, { skipPushUser: true });
        return;
      }
    }
    show("Nothing to regenerate.");
  }

  function followupHint() {
    composerRef.current?.focus();
    composerRef.current?.pulse();
    show("Type a follow-up below.");
  }

  async function send(text: string, opts: { skipPushUser?: boolean } = {}) {
    if (!text.trim() || streaming) return;

    const epoch = streamEpochRef.current;
    if (!opts.skipPushUser) pushUser(text);

    setSteps([
      {
        id: "client-sending",
        name: "Sending to deep agent",
        kind: "info",
        status: "completed",
      },
      {
        id: "client-starting",
        name: "Starting deep agent",
        kind: "info",
        status: "started",
      },
    ]);
    setTodos([]);
    setTaskDone(false);
    setTaskMs(null);
    setTaskVisible(true);
    setStreamingText("");
    setStreamingMeta(null);
    setStreamFinalized(false);

    streamAccumRef.current = "";
    streamThreadIdRef.current = threadId;

    setStreaming(true);
    setStatus("Thinking…");

    let firstToken = false;
    let buffer = "";
    const startedAt = performance.now();

    abortRef.current = streamAgent({
      backendUrl,
      userId,
      threadId,
      message: text,
      hooks: {
        onStart: ({ thread_id }) => {
          if (thread_id) {
            streamThreadIdRef.current = thread_id;
            setThreadId(thread_id);
          }
          setStatus("Streaming…");
          if (transcript.filter((t) => t.role === "user").length === 0) {
            setTopbarTitle(text.slice(0, 80));
          }
        },
        onStep: (evt: StepEvent) => {
          setSteps((prev) => {
            const id =
              evt.id ||
              `${evt.name}-${prev.length}-${Date.now().toString(36)}`;
            if (evt.status === "started") {
              if (prev.find((s) => s.id === id)) return prev;
              return [
                ...prev,
                {
                  id,
                  name: evt.name,
                  kind: (evt.kind || "tool") as TaskStep["kind"],
                  status: "started",
                  startedAt: performance.now(),
                },
              ];
            }
            const completeAt = (s: TaskStep): TaskStep => ({
              ...s,
              status: "completed",
              durationMs:
                typeof s.startedAt === "number"
                  ? Math.max(0, performance.now() - s.startedAt)
                  : s.durationMs,
            });
            const byId = prev.findIndex((s) => s.id === id);
            if (byId >= 0) {
              const next = prev.slice();
              next[byId] = completeAt(next[byId]);
              return next;
            }
            for (let i = prev.length - 1; i >= 0; i--) {
              if (prev[i].name === evt.name && prev[i].status !== "completed") {
                const next = prev.slice();
                next[i] = completeAt(next[i]);
                return next;
              }
            }
            return prev;
          });
        },
        onTodos: (items) => setTodos(items),
        onToken: (t) => {
          if (!firstToken) {
            firstToken = true;
            setSteps((prev) =>
              prev.map((s) =>
                s.id === "client-starting"
                  ? { ...s, status: "completed" as const }
                  : s
              )
            );
          }
          buffer += t;
          streamAccumRef.current = buffer;
          setStreamingText(buffer);
        },
        onAbort: () => {
          if (epoch !== streamEpochRef.current) return;
          abortRef.current = null;
          const partial = streamAccumRef.current.trim();
          streamAccumRef.current = "";
          setStreaming(false);
          setStreamingText("");
          setStatus("Stopped.");
          setTaskDone(true);
          setTaskMs(null);
          setTimeout(() => setTaskVisible(false), 450);
          setStreamFinalized(true);
          if (partial.length > 0) {
            pushAssistantFinal(`${partial}\n\n— *Stopped*`);
            const sid = streamThreadIdRef.current;
            if (sid) {
              upsert({ threadId: sid, title: text.slice(0, 80) });
            }
          }
          show("Stopped.");
        },
        onDone: ({ thread_id, ms }) => {
          if (epoch !== streamEpochRef.current) return;
          if (thread_id) setThreadId(thread_id);
          const took = ms ?? Math.round(performance.now() - startedAt);
          setTaskDone(true);
          setTaskMs(took);
          setTimeout(() => setTaskVisible(false), 600);

          const finalText = buffer || "(no response)";
          streamAccumRef.current = "";

          // Snapshot the live steps/todos onto the assistant message so the
          // collapsed summary pill above the bubble can be re-expanded later.
          // We strip the "client-*" bookkeeping rows so the summary only shows
          // real agent work.
          const realSteps = stepsRef.current.filter(
            (s) => !s.id.startsWith("client-")
          );
          const summary: TurnSummary | undefined =
            realSteps.length > 0 || todosRef.current.length > 0
              ? {
                  steps: realSteps.map((s) => ({
                    id: s.id,
                    name: s.name,
                    kind: s.kind,
                    durationMs: s.durationMs,
                  })),
                  todos: [...todosRef.current],
                  ms: took,
                }
              : undefined;
          pushAssistantFinal(finalText, `${thread_id} • ${took}ms`, summary);

          if (thread_id) {
            const titleMsg =
              transcript.find((t) => t.role === "user")?.text || text;
            upsert({ threadId: thread_id, title: titleMsg });
          }
          setStatus("Ready.");
          setStreaming(false);
          abortRef.current = null;
        },
        onError: (msg) => {
          if (epoch !== streamEpochRef.current) return;
          streamAccumRef.current = "";
          setStatus("Error.");
          setStreaming(false);
          setTaskDone(true);
          setTimeout(() => setTaskVisible(false), 600);
          pushAssistantFinal(`Error: ${msg}`);
          abortRef.current = null;
        },
      },
    });
  }

  const showHero =
    transcript.length === 0 &&
    !taskVisible &&
    streamingText.length === 0 &&
    !historyLoading;

  const visibleStreamingBubble = useMemo(() => {
    if (streamFinalized) return false;
    return streaming && streamingText.length > 0;
  }, [streaming, streamingText, streamFinalized]);

  return (
    <div className="flex h-screen min-h-0 flex-col lg:flex-row">
      {/*
        Outer wrapper animates width (72 ↔ 284). The inner shell is locked at the
        full expanded width so the sidebar's internal layout never reflows during
        the transition — the wrapper's overflow:hidden simply clips it. All
        content visibility is driven by opacity (via .sb-text-fade + data-collapsed),
        which is what gives the Claude-like buttery feel with no button blink.
      */}
      <motion.div
        className="relative z-[100] hidden h-screen min-h-0 shrink-0 overflow-hidden lg:block"
        initial={false}
        animate={{ width: sidebarCollapsed ? 72 : 284 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.08, ease: "easeOut" }
            : {
                type: "tween",
                duration: 0.2,
                ease: [0.25, 0.1, 0.25, 1],
              }
        }
      >
        <div className="h-full" style={{ width: 284 }}>
          <Sidebar
            activeThreadId={threadId}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
            onNewChat={newChat}
            onResume={(id, t) => resumeThread(id, t)}
            onPickPrompt={pickPrompt}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenCommandPalette={() => setPaletteOpen(true)}
          />
        </div>
      </motion.div>

      <motion.main
        layout={false}
        className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <Topbar
          title={topbarTitle}
          scrolled={topbarScrolled}
          inConversation={transcript.length > 0 || taskVisible || streaming}
          onMenu={() => setDrawerOpen(true)}
          onHome={newChat}
          onFeedback={() => setFeedbackOpen(true)}
          onClear={newChat}
          onExport={exportChat}
          onSettings={() => setSettingsOpen(true)}
        />

        <section className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={messagesRef}
            className="scroll-area flex-1 overflow-auto py-6 pl-4 pr-4"
          >
            {showHero ? (
              <Hero onPick={pickPrompt} />
            ) : (
              <div className="flex flex-col gap-7 pb-2">
                {historyLoading && <HistorySkeleton />}
                {transcript.map((m, i) => {
                  const isLastAssistant =
                    m.role === "assistant" && i === transcript.length - 1;
                  return (
                    <Bubble
                      key={i}
                      role={m.role}
                      text={m.text}
                      summary={m.summary}
                      onRegenerate={isLastAssistant ? regenerateLast : undefined}
                      onFollowup={isLastAssistant ? followupHint : undefined}
                    />
                  );
                })}

                <TaskCard
                  steps={steps}
                  todos={todos}
                  done={taskDone}
                  ms={taskMs}
                  visible={taskVisible}
                  replyDrafting={streaming && streamingText.length > 0}
                  prettyName={prettyName}
                />

                {visibleStreamingBubble && (
                  <StreamingBubble text={streamingText} done={false} />
                )}
              </div>
            )}
          </div>

          {/* Floating scroll-to-bottom */}
          <AnimatePresence>
            {!scrollPinned && !showHero && (
              <motion.button
                key="scroll-bottom"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18 }}
                onClick={() => scrollToBottom(true)}
                className={cn(
                  "absolute bottom-[124px] right-4 z-[30] grid h-10 w-10 place-items-center rounded-full",
                  "border border-[var(--stroke-2)] bg-[var(--glass-2)]/90 backdrop-blur-md",
                  "shadow-[0_10px_26px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.12)]",
                  "text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/[0.08]",
                  "transition-[transform,box-shadow,background-color,color] duration-150 ease-out",
                  "hover:-translate-y-0.5 active:translate-y-0",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
                  "max-sm:right-5 max-sm:bottom-[128px]"
                )}
                aria-label="Scroll to bottom"
              >
                <ArrowDown size={16} strokeWidth={2.4} />
              </motion.button>
            )}
          </AnimatePresence>

          <Composer
            ref={composerRef}
            onSend={(t) => send(t)}
            onStop={stopStream}
            isStreaming={streaming}
            disabled={historyLoading || streaming}
          />
        </section>
      </motion.main>

      <Sheet
        open={feedbackOpen}
        title="Feedback"
        onClose={() => setFeedbackOpen(false)}
      >
        <FeedbackView onClose={() => setFeedbackOpen(false)} />
      </Sheet>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        activeThreadId={threadId}
      />

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeThreadId={threadId}
        onNewChat={newChat}
        onResume={resumeThread}
        onPickPrompt={pickPrompt}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNewChat={newChat}
        onResume={resumeThread}
        onPickPrompt={pickPrompt}
        onOpenSettings={() => setSettingsOpen(true)}
      />
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="mx-auto my-3 flex max-w-[920px] flex-col gap-3 px-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-start gap-3"
          style={{ flexDirection: i % 2 ? "row-reverse" : "row" }}
        >
          <div className="skeleton h-7 w-7 rounded-full" />
          <div className="skeleton h-16 w-2/3 rounded-2xl" />
        </div>
      ))}
    </div>
  );
}
