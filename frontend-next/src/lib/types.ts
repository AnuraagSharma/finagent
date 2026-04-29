export type Role = "user" | "assistant";

export type ChatMessage = {
  role: Role;
  text: string;
  ts: number;
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
