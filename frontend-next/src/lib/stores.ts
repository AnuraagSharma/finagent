"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Recent } from "./types";

const RECENTS_MAX = 12;

type SettingsState = {
  userId: string;
  backendUrl: string;
  setUserId: (v: string) => void;
  setBackendUrl: (v: string) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      userId: "demo-user",
      backendUrl:
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000",
      setUserId: (v) => set({ userId: v || "demo-user" }),
      setBackendUrl: (v) =>
        set({ backendUrl: v || "http://localhost:8000" }),
    }),
    {
      name: "finagent:settings",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

/**
 * Live counters for the user's 👍 / 👎 reactions in the *current* chat
 * session. Bubble.tsx bumps this every time a user toggles feedback on an
 * assistant turn; the FeedbackView reads it to give the user contextual
 * acknowledgement ("you've liked 3 answers in this chat").
 *
 * Intentionally NOT persisted — counts reset when the page reloads or when
 * `reset()` is called (e.g. when a new chat is started).
 */
type SessionFeedbackState = {
  likes: number;
  dislikes: number;
  /** Apply a delta to one bucket (+1 / -1). Floors at 0. */
  bump: (kind: "like" | "dislike", delta: number) => void;
  reset: () => void;
};

export const useSessionFeedback = create<SessionFeedbackState>((set) => ({
  likes: 0,
  dislikes: 0,
  bump: (kind, delta) =>
    set((s) => ({
      likes:
        kind === "like" ? Math.max(0, s.likes + delta) : s.likes,
      dislikes:
        kind === "dislike" ? Math.max(0, s.dislikes + delta) : s.dislikes,
    })),
  reset: () => set({ likes: 0, dislikes: 0 }),
}));

type RecentsState = {
  recents: Recent[];
  upsert: (r: { threadId: string; title: string }) => void;
  remove: (threadId: string) => void;
  clear: () => void;
};

export const useRecents = create<RecentsState>()(
  persist(
    (set, get) => ({
      recents: [],
      upsert: ({ threadId, title }) => {
        if (!threadId) return;
        const next: Recent[] = [
          {
            threadId,
            title: (title || "Untitled").slice(0, 80),
            ts: Date.now(),
          },
        ];
        for (const r of get().recents) {
          if (r.threadId !== threadId && next.length < RECENTS_MAX) next.push(r);
        }
        set({ recents: next });
      },
      remove: (threadId) =>
        set({ recents: get().recents.filter((r) => r.threadId !== threadId) }),
      clear: () => set({ recents: [] }),
    }),
    {
      name: "finagent:recents",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
