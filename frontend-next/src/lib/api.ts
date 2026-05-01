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

// ---------- Analytics ----------

export type AnalyticsFilters = {
  from?: string | null;
  to?: string | null;
  status?: "all" | "success" | "soft_error" | "hard_error";
  errorType?: string | null;
  userId?: string | null;
  feedback?: "all" | "like" | "dislike" | "none";
};

function withFilters(url: URL, f?: AnalyticsFilters) {
  if (!f) return url;
  if (f.from) url.searchParams.set("from", f.from);
  if (f.to) url.searchParams.set("to", f.to);
  if (f.status && f.status !== "all") url.searchParams.set("status", f.status);
  if (f.errorType) url.searchParams.set("error_type", f.errorType);
  if (f.userId) url.searchParams.set("user_id", f.userId);
  if (f.feedback && f.feedback !== "all")
    url.searchParams.set("feedback", f.feedback);
  return url;
}

export type TopError = {
  error_type: string | null;
  count: number;
  sample_detail: string | null;
};

export type TrendPoint = {
  bucket: string;
  queries: number;
  avg_latency_ms: number | null;
  avg_tokens: number | null;
  total_cost_usd: number | null;
};

export type AnalyticsSummary = {
  total_queries: number;
  sessions: number;
  unique_users: number;
  success_rate: number;
  hard_errors: number;
  soft_errors: number;
  total_cost_usd: number;
  avg_cost_usd: number;
  avg_latency_ms: number | null;
  avg_llm_ms: number | null;
  avg_exec_ms: number | null;
  avg_tokens: number | null;
  blended_per_million: number | null;
  top_errors: TopError[];
  response_time_trend: TrendPoint[];
};

export type UserActivityRow = {
  user_id: string;
  questions: number;
  sessions: number;
  cost_usd: number;
  avg_dur_ms: number | null;
  likes: number;
  dislikes: number;
  last_active: string | null;
};

export type AnalyticsUsers = {
  active_users: number;
  top_user: string | null;
  top_user_questions: number;
  avg_questions_per_user: number;
  total_questions: number;
  power_users: number;
  users: UserActivityRow[];
};

export type TurnRow = {
  id: number;
  created_at: string;
  user_id: string;
  thread_id: string;
  user_message: string;
  assistant_message: string;
  status: "success" | "soft_error" | "hard_error";
  error_type: string | null;
  error_detail: string | null;
  latency_ms: number | null;
  llm_ms: number | null;
  exec_ms: number | null;
  step_count: number | null;
  tool_count: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
  model: string;
  likes: number;
  dislikes: number;
};

export type AnalyticsTurns = {
  total: number;
  page: number;
  page_size: number;
  rows: TurnRow[];
};

export type SessionRow = {
  thread_id: string;
  user_id: string;
  turns: number;
  total_cost_usd: number;
  total_duration_ms: number | null;
  first_active: string | null;
  last_active: string | null;
  first_message: string | null;
};

export type AnalyticsSessions = {
  total: number;
  rows: SessionRow[];
};

export type AnalyticsSessionDetail = {
  thread_id: string;
  user_id: string | null;
  turns: TurnRow[];
};

export type AnalyticsTrends = {
  granularity: "daily" | "weekly" | "monthly";
  points: TrendPoint[];
};

async function fetchJson<T>(
  url: URL,
  userId: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      "X-User-Id": userId,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return (await res.json()) as T;
}

function base(backendUrl: string, path: string): URL {
  return new URL(path, backendUrl.replace(/\/+$/, "") + "/");
}

export function getAnalyticsSummary({
  backendUrl,
  userId,
  filters,
  granularity,
  signal,
}: {
  backendUrl: string;
  userId: string;
  filters?: AnalyticsFilters;
  granularity?: "daily" | "weekly" | "monthly";
  signal?: AbortSignal;
}): Promise<AnalyticsSummary> {
  const url = withFilters(base(backendUrl, "v1/analytics/summary"), filters);
  if (granularity) url.searchParams.set("granularity", granularity);
  return fetchJson(url, userId, { signal });
}

export function getAnalyticsUsers({
  backendUrl,
  userId,
  filters,
  signal,
}: {
  backendUrl: string;
  userId: string;
  filters?: AnalyticsFilters;
  signal?: AbortSignal;
}): Promise<AnalyticsUsers> {
  const url = withFilters(base(backendUrl, "v1/analytics/users"), filters);
  return fetchJson(url, userId, { signal });
}

export function getAnalyticsTurns({
  backendUrl,
  userId,
  filters,
  page,
  pageSize,
  sort,
  direction,
  signal,
}: {
  backendUrl: string;
  userId: string;
  filters?: AnalyticsFilters;
  page?: number;
  pageSize?: number;
  sort?:
    | "created_at"
    | "latency_ms"
    | "total_tokens"
    | "cost_usd"
    | "step_count"
    | "tool_count";
  direction?: "asc" | "desc";
  signal?: AbortSignal;
}): Promise<AnalyticsTurns> {
  const url = withFilters(base(backendUrl, "v1/analytics/turns"), filters);
  if (page) url.searchParams.set("page", String(page));
  if (pageSize) url.searchParams.set("page_size", String(pageSize));
  if (sort) url.searchParams.set("sort", sort);
  if (direction) url.searchParams.set("direction", direction);
  return fetchJson(url, userId, { signal });
}

export function getAnalyticsSessions({
  backendUrl,
  userId,
  filters,
  page,
  pageSize,
  signal,
}: {
  backendUrl: string;
  userId: string;
  filters?: AnalyticsFilters;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}): Promise<AnalyticsSessions> {
  const url = withFilters(base(backendUrl, "v1/analytics/sessions"), filters);
  if (page) url.searchParams.set("page", String(page));
  if (pageSize) url.searchParams.set("page_size", String(pageSize));
  return fetchJson(url, userId, { signal });
}

export function getAnalyticsSessionDetail({
  backendUrl,
  userId,
  threadId,
  signal,
}: {
  backendUrl: string;
  userId: string;
  threadId: string;
  signal?: AbortSignal;
}): Promise<AnalyticsSessionDetail> {
  const url = base(
    backendUrl,
    `v1/analytics/sessions/${encodeURIComponent(threadId)}`
  );
  return fetchJson(url, userId, { signal });
}

export function getAnalyticsTrends({
  backendUrl,
  userId,
  filters,
  granularity,
  signal,
}: {
  backendUrl: string;
  userId: string;
  filters?: AnalyticsFilters;
  granularity?: "daily" | "weekly" | "monthly";
  signal?: AbortSignal;
}): Promise<AnalyticsTrends> {
  const url = withFilters(base(backendUrl, "v1/analytics/trends"), filters);
  if (granularity) url.searchParams.set("granularity", granularity);
  return fetchJson(url, userId, { signal });
}

export function exportAnalyticsCsvUrl({
  backendUrl,
  filters,
  tab,
}: {
  backendUrl: string;
  filters?: AnalyticsFilters;
  tab: "turns" | "users" | "sessions";
}): string {
  const url = withFilters(base(backendUrl, "v1/analytics/export.csv"), filters);
  url.searchParams.set("tab", tab);
  return url.toString();
}

export function postFeedback({
  backendUrl,
  userId,
  interactionId,
  kind,
  comment,
}: {
  backendUrl: string;
  userId: string;
  interactionId: number;
  kind: "like" | "dislike";
  comment?: string;
}): Promise<{ id: number; kind: string }> {
  const url = base(backendUrl, "v1/feedback");
  return fetchJson(url, userId, {
    method: "POST",
    body: JSON.stringify({ interaction_id: interactionId, kind, comment }),
  });
}
