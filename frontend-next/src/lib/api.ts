import type { Role, StepEvent, TodoItem } from "./types";

export type StreamHooks = {
  onStart?: (e: { thread_id: string }) => void;
  onStep?: (e: StepEvent) => void;
  onTodos?: (items: TodoItem[]) => void;
  onToken?: (text: string) => void;
  onDone?: (e: { thread_id: string; ms: number }) => void;
  onError?: (msg: string) => void;
  /** Fetch was aborted (user clicked Stop or navigated away). */
  onAbort?: () => void;
};

export function streamAgent({
  backendUrl,
  userId,
  threadId,
  message,
  hooks,
}: {
  backendUrl: string;
  userId: string;
  threadId: string | null;
  message: string;
  hooks: StreamHooks;
}): AbortController {
  const controller = new AbortController();
  const url = `${backendUrl.replace(/\/+$/, "")}/v1/agent/stream`;
  const body = JSON.stringify(
    threadId ? { message, thread_id: threadId } : { message }
  );

  (async () => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          "X-User-Id": userId,
        },
        body,
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(`${res.status} ${res.statusText}: ${text}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const line = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          let evt: { type?: string; [k: string]: unknown };
          try {
            evt = JSON.parse(payload);
          } catch {
            continue;
          }
          switch (evt.type) {
            case "start":
              hooks.onStart?.(evt as { thread_id: string });
              break;
            case "step":
              hooks.onStep?.(evt as unknown as StepEvent);
              break;
            case "todos":
              hooks.onTodos?.((evt as { items?: TodoItem[] }).items || []);
              break;
            case "token":
              hooks.onToken?.((evt as { text?: string }).text || "");
              break;
            case "done":
              hooks.onDone?.(evt as { thread_id: string; ms: number });
              break;
            case "error":
              hooks.onError?.(
                (evt as { message?: string }).message || "stream error"
              );
              break;
          }
        }
      }
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      if (e?.name === "AbortError") {
        hooks.onAbort?.();
        return;
      }
      hooks.onError?.(e?.message || String(err));
    }
  })();

  return controller;
}

export async function getThreadHistory({
  backendUrl,
  userId,
  threadId,
}: {
  backendUrl: string;
  userId: string;
  threadId: string;
}): Promise<{ threadId: string; messages: { role: Role; text: string }[] }> {
  const url = `${backendUrl.replace(/\/+$/, "")}/v1/agent/thread/${encodeURIComponent(
    threadId
  )}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "X-User-Id": userId },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  const data = (await res.json()) as {
    thread_id: string;
    messages: { role: Role; text: string }[];
  };
  return {
    threadId: data.thread_id,
    messages: Array.isArray(data.messages) ? data.messages : [],
  };
}
