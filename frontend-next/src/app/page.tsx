"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import { AnalyticsView } from "@/components/AnalyticsView";
import { FeedbackView } from "@/components/FeedbackView";
import { MobileDrawer } from "@/components/MobileDrawer";
import { CommandPalette } from "@/components/CommandPalette";
import { useToast } from "@/components/Toaster";
import { useRecents, useSettings } from "@/lib/stores";
import { getThreadHistory, streamAgent } from "@/lib/api";
import { useHotkey } from "@/lib/useHotkeys";
import type { ChatMessage, StepEvent, TodoItem } from "@/lib/types";

function prettyName(name: string) {
  return String(name || "step").replace(/[_-]+/g, " ");
}

export default function Home() {
  const { userId, backendUrl } = useSettings();
  const { upsert } = useRecents();
  const show = useToast((s) => s.show);

  const [threadId, setThreadId] = useState<string | null>(null);
  const [topbarTitle, setTopbarTitle] = useState("New chat");
  const [transcript, setTranscript] = useState<ChatMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  // Sheets / modals
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Status text
  const [status, setStatus] = useState("Ready.");

  const composerRef = useRef<ComposerHandle | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);

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
    // toggle sidebar
    setSidebarCollapsed((v) => !v);
  });

  function newChat() {
    abortRef.current?.abort();
    abortRef.current = null;
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

  async function resumeThread(id: string, title: string) {
    abortRef.current?.abort();
    abortRef.current = null;
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
      show(`History error: ${err.message || String(e)}`);
    } finally {
      setHistoryLoading(false);
    }
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
    abortRef.current = null;
    setStreaming(false);
    setStatus("Stopped.");
    show("Stopped.");
    setStreamFinalized(true);
  }

  function pushUser(text: string) {
    setTranscript((prev) => [...prev, { role: "user", text, ts: Date.now() }]);
  }

  function pushAssistantFinal(text: string, meta?: string) {
    setTranscript((prev) => [
      ...prev,
      { role: "assistant", text, ts: Date.now() },
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
          if (thread_id) setThreadId(thread_id);
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
                },
              ];
            }
            const byId = prev.findIndex((s) => s.id === id);
            if (byId >= 0) {
              const next = prev.slice();
              next[byId] = { ...next[byId], status: "completed" };
              return next;
            }
            for (let i = prev.length - 1; i >= 0; i--) {
              if (prev[i].name === evt.name && prev[i].status !== "completed") {
                const next = prev.slice();
                next[i] = { ...next[i], status: "completed" };
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
          setStreamingText(buffer);
        },
        onDone: ({ thread_id, ms }) => {
          if (thread_id) setThreadId(thread_id);
          const took = ms ?? Math.round(performance.now() - startedAt);
          setTaskDone(true);
          setTaskMs(took);
          setTimeout(() => setTaskVisible(false), 600);

          const finalText = buffer || "(no response)";
          pushAssistantFinal(finalText, `${thread_id} • ${took}ms`);

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
    <div className="grid h-screen grid-cols-1 lg:grid-cols-[auto_1fr]">
      {/* Stack above main so edge overflow (collapse handle) isn't painted underneath */}
      <div className="relative z-[100] hidden min-h-0 overflow-visible lg:block">
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

      <main className="relative z-0 flex h-screen min-h-0 min-w-0 flex-col">
        <Topbar
          title={topbarTitle}
          scrolled={topbarScrolled}
          inConversation={transcript.length > 0 || taskVisible || streaming}
          onMenu={() => setDrawerOpen(true)}
          onHome={newChat}
          onAnalytics={() => setAnalyticsOpen(true)}
          onFeedback={() => setFeedbackOpen(true)}
          onClear={newChat}
          onExport={exportChat}
          onSettings={() => setSettingsOpen(true)}
          onCommand={() => setPaletteOpen(true)}
        />

        <section className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={messagesRef}
            className="scroll-area flex-1 overflow-auto py-5 pl-4 pr-4"
          >
            {showHero ? (
              <Hero onPick={pickPrompt} />
            ) : (
              <>
                {historyLoading && <HistorySkeleton />}
                {transcript.map((m, i) => {
                  const isLastAssistant =
                    m.role === "assistant" && i === transcript.length - 1;
                  return (
                    <Bubble
                      key={i}
                      role={m.role}
                      text={m.text}
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
                  prettyName={prettyName}
                />

                {visibleStreamingBubble && (
                  <StreamingBubble text={streamingText} done={false} />
                )}
              </>
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
                className="absolute bottom-[112px] right-4 grid h-10 w-10 place-items-center rounded-full border border-[var(--stroke-2)] bg-[var(--glass-2)] shadow-[var(--shadow-2)] backdrop-blur-md hover:bg-white/[0.08]"
                aria-label="Scroll to bottom"
              >
                <ArrowDown size={15} />
              </motion.button>
            )}
          </AnimatePresence>

          <Composer
            ref={composerRef}
            onSend={(t) => send(t)}
            onStop={stopStream}
            isStreaming={streaming}
            disabled={historyLoading}
          />
        </section>
      </main>

      {/* Sheets */}
      <Sheet
        open={analyticsOpen}
        title="Analytics"
        onClose={() => setAnalyticsOpen(false)}
      >
        <AnalyticsView
          transcript={transcript}
          onResume={(id, t) => {
            setAnalyticsOpen(false);
            resumeThread(id, t);
          }}
        />
      </Sheet>
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
