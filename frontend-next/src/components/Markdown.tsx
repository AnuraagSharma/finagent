"use client";

import * as React from "react";
import { TableChart, type ParsedTable } from "./TableChart";
import { CodeBlock } from "./CodeBlock";

/* ----------------------- Inline parsing ----------------------- */

/**
 * Render inline markdown to a JSX node:
 *  - **bold**, *italic*
 *  - `code`
 *  - [text](url)  -> external link
 */
function renderInline(text: string, keyBase: string): React.ReactNode {
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = re.exec(text))) {
    const idx = m.index;
    if (idx > last) {
      parts.push(
        <React.Fragment key={`${keyBase}-t${i++}`}>
          {text.slice(last, idx)}
        </React.Fragment>
      );
    }
    const token = m[0];
    if (token.startsWith("**")) {
      parts.push(
        <strong key={`${keyBase}-b${i++}`}>{token.slice(2, -2)}</strong>
      );
    } else if (token.startsWith("`")) {
      parts.push(
        <code
          key={`${keyBase}-c${i++}`}
          className="rounded-[5px] bg-white/[0.07] px-[5px] py-[1.5px] font-mono text-[0.92em] text-[var(--text)]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("[")) {
      const end = token.indexOf("](");
      const label = token.slice(1, end);
      const url = token.slice(end + 2, -1);
      parts.push(
        <a
          key={`${keyBase}-l${i++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--accent)] underline-offset-2 hover:underline"
        >
          {label}
        </a>
      );
    }
    last = idx + token.length;
  }
  if (last < text.length) {
    parts.push(
      <React.Fragment key={`${keyBase}-t${i++}`}>
        {text.slice(last)}
      </React.Fragment>
    );
  }
  return parts;
}

/* ----------------------- Block parsing ----------------------- */

type Block =
  | { kind: "h"; level: 1 | 2 | 3; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "code"; lang?: string; code: string }
  | { kind: "table"; table: ParsedTable }
  | { kind: "br" };

function splitRow(s: string): string[] {
  let l = s.trim();
  if (l.startsWith("|")) l = l.slice(1);
  if (l.endsWith("|")) l = l.slice(0, -1);
  return l.split("|").map((c) => c.trim());
}

function parseTable(
  lines: string[],
  start: number
): { table: ParsedTable; consumed: number } | null {
  const header = lines[start];
  const sep = lines[start + 1];
  if (!header || !sep) return null;
  if (!/^\s*\|.*\|\s*$/.test(header)) return null;
  if (!/^\s*\|?\s*:?-{2,}:?(\s*\|\s*:?-{2,}:?)+\s*\|?\s*$/.test(sep)) return null;

  const headers = splitRow(header);
  const aligns = splitRow(sep).map((c) => {
    const left = c.startsWith(":");
    const right = c.endsWith(":");
    if (left && right) return "center" as const;
    if (right) return "right" as const;
    if (left) return "left" as const;
    return "left" as const;
  });

  const rows: string[][] = [];
  let i = start + 2;
  while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
    rows.push(splitRow(lines[i]));
    i += 1;
  }
  if (rows.length === 0) return null;

  return {
    table: { headers, aligns, rows },
    consumed: i - start,
  };
}

/* ---------- Forgiving "tabular content inside a code fence" detector ---------- */

const BAR_CHARS = /[█▓▒░\-═━─*]/;
const NUMERIC = /-?\d+(?:[.,]\d+)?%?/;

function tryParseAsciiOrSpacedTable(code: string): ParsedTable | null {
  const lines = code.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return null;

  // Pattern 1: "Label  Number  [bars?]"  e.g. "2024-Q1 21.30 ███████"
  const rows: { label: string; value: string }[] = [];
  for (const ln of lines) {
    // Skip lines that are pure numbers (probably noise)
    const m = ln.match(/^\s*([^\s][^\s\d]*?[^\s])\s+(-?\d[\d.,%+\-]*)\s*(.*)$/);
    if (!m) {
      // Try header line like "Revenue (USD bn)" — skip it
      continue;
    }
    const label = m[1];
    const value = m[2];
    // Strip trailing bar characters from the rest of the line; they're decorative.
    const tail = (m[3] || "").replace(new RegExp(BAR_CHARS, "g"), "").trim();
    rows.push({ label, value });
    if (tail.length > 0) {
      // line had something else after the value; if it's also numeric, store it as a 3rd col?
      // We keep two columns for simplicity and chartability.
    }
  }

  if (rows.length < 2) return null;
  // Need at least 2 numeric values
  const numericHits = rows.filter((r) =>
    NUMERIC.test(r.value)
  ).length;
  if (numericHits < 2) return null;

  return {
    headers: ["Label", "Value"],
    aligns: ["left", "right"],
    rows: rows.map((r) => [r.label, r.value]),
  };
}

function tryParseJsonArray(code: string): ParsedTable | null {
  const trimmed = code.trim();
  if (!trimmed.startsWith("[")) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    // Only handle array of objects (like [{"a": 1, "b": 2}, ...])
    const first = parsed[0];
    if (typeof first !== "object" || first === null || Array.isArray(first)) return null;
    const headers = Object.keys(first as Record<string, unknown>);
    if (headers.length < 2) return null;
    const rows: string[][] = parsed.map((row) =>
      headers.map((h) => {
        const v = (row as Record<string, unknown>)[h];
        if (v == null) return "";
        if (typeof v === "object") return JSON.stringify(v);
        return String(v);
      })
    );
    const aligns = headers.map((h) => {
      const looksNumeric = parsed.every((row) => {
        const v = (row as Record<string, unknown>)[h];
        return typeof v === "number" || (typeof v === "string" && NUMERIC.test(v));
      });
      return looksNumeric ? ("right" as const) : ("left" as const);
    });
    return { headers, aligns, rows };
  } catch {
    return null;
  }
}

function tryParseCsv(code: string): ParsedTable | null {
  const lines = code.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return null;
  // Need at least 2 commas per line
  const looksCsv = lines.every((l) => (l.match(/,/g)?.length ?? 0) >= 1);
  if (!looksCsv) return null;
  const split = (l: string) => l.split(",").map((c) => c.trim());
  const headers = split(lines[0]);
  if (headers.length < 2) return null;
  const rows = lines.slice(1).map(split);
  const aligns = headers.map((_, i) => {
    const numHits = rows.filter((r) => NUMERIC.test(r[i] || "")).length;
    return numHits >= Math.max(2, Math.floor(rows.length * 0.6))
      ? ("right" as const)
      : ("left" as const);
  });
  return { headers, aligns, rows };
}

function detectTabularInCode(lang: string | undefined, code: string): ParsedTable | null {
  // For language=json or content starting with "[", try JSON
  if ((lang === "json" || code.trim().startsWith("[")) && code.trim().endsWith("]")) {
    const t = tryParseJsonArray(code);
    if (t) return t;
  }
  // For language=csv or comma-rich text, try CSV
  if (lang === "csv" || /^[^,\n]+(,[^,\n]+){2,}/.test(code.trim().split("\n")[0] || "")) {
    const t = tryParseCsv(code);
    if (t) return t;
  }
  // For language=text or any unknown, try ASCII-spaced tables (e.g. "2024-Q1 21.30 ▓▓▓").
  if (!lang || lang === "text" || lang === "txt") {
    const t = tryParseAsciiOrSpacedTable(code);
    if (t) return t;
  }
  return null;
}

function parseBlocks(text: string): Block[] {
  const lines = String(text ?? "").split(/\r?\n/);
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code fence
    const fence = line.match(/^\s*```(\w*)\s*$/);
    if (fence) {
      const lang = fence[1] || undefined;
      const start = i + 1;
      let end = start;
      while (end < lines.length && !/^\s*```\s*$/.test(lines[end])) end += 1;
      const code = lines.slice(start, end).join("\n");
      // Try to detect tabular content; if found, render as a table+chart.
      const t = detectTabularInCode(lang, code);
      if (t) {
        blocks.push({ kind: "table", table: t });
      } else {
        blocks.push({ kind: "code", lang, code });
      }
      i = end + 1;
      continue;
    }

    // Heading
    const h3 = line.match(/^\s*###\s+(.*)$/);
    const h2 = line.match(/^\s*##\s+(.*)$/);
    const h1 = line.match(/^\s*#\s+(.*)$/);
    if (h1 || h2 || h3) {
      const m = h3 || h2 || h1;
      const lvl = h3 ? 3 : h2 ? 2 : 1;
      blocks.push({ kind: "h", level: lvl as 1 | 2 | 3, text: m![1] });
      i += 1;
      continue;
    }

    // Markdown table
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const t = parseTable(lines, i);
      if (t) {
        blocks.push({ kind: "table", table: t.table });
        i += t.consumed;
        continue;
      }
    }

    // Bullet list (consecutive)
    if (/^\s*-\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*-\s+(.*)$/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*-\s+/, ""));
        i += 1;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    // Ordered list (1. , 2. ...)
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+(.*)$/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    // Blank line
    if (!line.trim()) {
      blocks.push({ kind: "br" });
      i += 1;
      continue;
    }

    // Paragraph (collect consecutive non-empty, non-special lines)
    const paraLines: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*```/.test(lines[i]) &&
      !/^\s*#{1,3}\s+/.test(lines[i]) &&
      !/^\s*-\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*\|.*\|\s*$/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i += 1;
    }
    blocks.push({ kind: "p", text: paraLines.join("\n") });
  }

  return blocks;
}

/* ----------------------- Component ----------------------- */

export function Markdown({ text }: { text: string }) {
  const blocks = React.useMemo(() => parseBlocks(text || ""), [text]);

  return (
    <div className="finagent-md">
      {blocks.map((b, idx) => {
        if (b.kind === "br") return <div key={idx} className="h-2" />;
        if (b.kind === "h") {
          const baseClass =
            b.level === 1
              ? "mt-4 mb-2 text-[20px] font-extrabold tracking-tight"
              : b.level === 2
                ? "mt-3 mb-1.5 text-[16px] font-bold"
                : "mt-2.5 mb-1 text-[14px] font-bold uppercase tracking-[0.06em] text-[var(--muted)]";
          if (b.level === 1)
            return (
              <h1 key={idx} className={baseClass}>
                {renderInline(b.text, `h${idx}`)}
              </h1>
            );
          if (b.level === 2)
            return (
              <h2 key={idx} className={baseClass}>
                {renderInline(b.text, `h${idx}`)}
              </h2>
            );
          return (
            <h3 key={idx} className={baseClass}>
              {renderInline(b.text, `h${idx}`)}
            </h3>
          );
        }
        if (b.kind === "p") {
          const lines = b.text.split(/\r?\n/);
          return (
            <p key={idx} className="my-2 leading-[1.7]">
              {lines.map((ln, j) => (
                <React.Fragment key={j}>
                  {j > 0 && <br />}
                  {renderInline(ln, `p${idx}-${j}`)}
                </React.Fragment>
              ))}
            </p>
          );
        }
        if (b.kind === "ul") {
          return (
            <ul
              key={idx}
              className="my-2 ml-5 list-disc marker:text-[var(--muted-2)]"
            >
              {b.items.map((it, j) => (
                <li key={j} className="my-1.5 leading-[1.6]">
                  {renderInline(it, `ul${idx}-${j}`)}
                </li>
              ))}
            </ul>
          );
        }
        if (b.kind === "ol") {
          return (
            <ol
              key={idx}
              className="my-2 ml-5 list-decimal marker:font-semibold marker:text-[var(--muted)]"
            >
              {b.items.map((it, j) => (
                <li key={j} className="my-1.5 leading-[1.6]">
                  {renderInline(it, `ol${idx}-${j}`)}
                </li>
              ))}
            </ol>
          );
        }
        if (b.kind === "code") {
          return <CodeBlock key={idx} code={b.code} lang={b.lang} />;
        }
        if (b.kind === "table") {
          return <TableChart key={idx} table={b.table} />;
        }
        return null;
      })}
    </div>
  );
}
