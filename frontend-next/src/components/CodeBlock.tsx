"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  code: string;
  lang?: string;
};

const LANG_LABEL: Record<string, string> = {
  js: "JavaScript",
  jsx: "JSX",
  ts: "TypeScript",
  tsx: "TSX",
  py: "Python",
  python: "Python",
  sh: "Shell",
  bash: "Bash",
  zsh: "Shell",
  json: "JSON",
  yaml: "YAML",
  yml: "YAML",
  toml: "TOML",
  md: "Markdown",
  markdown: "Markdown",
  sql: "SQL",
  css: "CSS",
  html: "HTML",
  go: "Go",
  rs: "Rust",
  rust: "Rust",
  c: "C",
  cpp: "C++",
  java: "Java",
  rb: "Ruby",
  php: "PHP",
  csv: "CSV",
  text: "Text",
  txt: "Text",
};

function prettyLang(lang?: string): string {
  if (!lang) return "Plain text";
  const lower = lang.toLowerCase();
  return LANG_LABEL[lower] ?? lang;
}

export function CodeBlock({ code, lang }: Props) {
  const [copied, setCopied] = React.useState(false);
  const onCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // noop
    }
  }, [code]);

  return (
    <div
      className={cn(
        "code-block group/cb my-3 overflow-hidden rounded-[12px]",
        "border border-[var(--stroke)]",
        "bg-[color-mix(in_oklab,var(--bg)_55%,#000_45%)]"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2",
          "border-b border-[var(--stroke)]/70",
          "bg-[color-mix(in_oklab,var(--bg)_70%,#000_30%)]",
          "px-3 py-1.5"
        )}
      >
        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">
          {prettyLang(lang)}
        </span>
        <button
          type="button"
          onClick={onCopy}
          aria-label={copied ? "Copied" : "Copy code"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2 py-1",
            "text-[11px] font-medium",
            "text-[var(--muted-2)] hover:text-[var(--text)]",
            "hover:bg-white/[0.05] transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
          )}
        >
          {copied ? (
            <>
              <Check size={12} strokeWidth={2.5} />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} strokeWidth={2} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre
        className={cn(
          "m-0 overflow-x-auto px-4 py-3",
          "font-mono text-[12.5px] leading-[1.65]",
          "text-[color-mix(in_oklab,var(--text)_88%,var(--muted)_12%)]"
        )}
      >
        <code className="!border-0 !bg-transparent !p-0">{code}</code>
      </pre>
    </div>
  );
}
