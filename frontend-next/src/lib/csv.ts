/**
 * Minimal RFC-4180 CSV parser. Handles:
 *   - quoted fields with embedded commas, quotes (escaped as ""), and newlines
 *   - CR, LF, CRLF line endings
 *   - mixed quoted / unquoted fields
 *
 * Not a full RFC implementation — no trailing-newline pickiness, no BOM
 * handling beyond a leading strip. Good enough for spreadsheet exports.
 */
export function parseCsv(input: string): string[][] {
  // Strip BOM if present
  if (input.charCodeAt(0) === 0xfeff) input = input.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      // CR or CRLF
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += input[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  // Last field — only push if non-empty or any progress
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Render a parsed grid as a GitHub-flavoured markdown table. Caps total rows
 * (head + body) and field length so we don't blow up the prompt for big files.
 */
export function gridToMarkdownTable(
  rows: string[][],
  opts: { maxRows?: number; maxFieldLen?: number } = {}
): { table: string; truncatedRows: number } {
  const maxRows = opts.maxRows ?? 50;
  const maxFieldLen = opts.maxFieldLen ?? 80;
  if (rows.length === 0) return { table: "", truncatedRows: 0 };

  const truncate = (v: string) =>
    v.length > maxFieldLen ? v.slice(0, maxFieldLen - 1) + "…" : v;
  const escape = (v: string) =>
    truncate(v).replace(/\|/g, "\\|").replace(/\n/g, " ").replace(/\r/g, " ");

  const head = rows[0].map(escape);
  const body = rows.slice(1, maxRows).map((r) => {
    const padded = r.slice(0, head.length);
    while (padded.length < head.length) padded.push("");
    return padded.map(escape);
  });

  const sep = head.map(() => "---");
  const lines: string[] = [];
  lines.push("| " + head.join(" | ") + " |");
  lines.push("| " + sep.join(" | ") + " |");
  for (const r of body) lines.push("| " + r.join(" | ") + " |");

  const truncatedRows = Math.max(0, rows.length - maxRows);
  return { table: lines.join("\n"), truncatedRows };
}

/** Pretty-print bytes for the chip label. */
export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
