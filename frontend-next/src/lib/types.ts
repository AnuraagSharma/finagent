export type Role = "user" | "assistant";

/** Snapshot of an agent turn captured at completion, attached to the assistant
 * message so its summary pill can be re-expanded any time after. */
export type TurnSummary = {
  steps: Array<{
    id: string;
    name: string;
    kind: "tool" | "subagent" | "info";
    /** ms from start to completion, undefined if step never completed */
    durationMs?: number;
  }>;
  todos: TodoItem[];
  /** Total wall time for the turn, ms */
  ms: number | null;
};

export type ChatMessage = {
  role: Role;
  text: string;
  ts: number;
  /** Only assistant messages carry a summary. Live during streaming, snapshot at done. */
  summary?: TurnSummary;
};

export type StepEvent = {
  id?: string;
  kind?: "tool" | "subagent" | "info";
  name: string;
  status: "started" | "completed";
  node?: string;
};

export type TodoItem = {
  content: string;
  status: string;
};

export type Recent = {
  threadId: string;
  title: string;
  ts: number;
};
