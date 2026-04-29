/**
 * Persists active chat thread across full page reloads (same browser tab session).
 */

export const ACTIVE_SESSION_STORAGE_KEY = "finagent:activeSession";

export type ActiveSessionPayload = {
  threadId: string;
  title: string;
};

export function readStoredActiveSession(): ActiveSessionPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<ActiveSessionPayload>;
    if (!p.threadId || typeof p.threadId !== "string") return null;
    return {
      threadId: p.threadId,
      title: typeof p.title === "string" && p.title.trim() ? p.title : "Chat",
    };
  } catch {
    return null;
  }
}

export function writeStoredActiveSession(payload: ActiveSessionPayload): void {
  try {
    sessionStorage.setItem(
      ACTIVE_SESSION_STORAGE_KEY,
      JSON.stringify(payload)
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearStoredActiveSession(): void {
  try {
    sessionStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
