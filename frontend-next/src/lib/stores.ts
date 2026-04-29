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
