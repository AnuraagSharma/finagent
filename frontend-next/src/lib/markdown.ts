function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function inline(s: string) {
  let out = escapeHtml(s);
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/`([^`]+?)`/g, "<code>$1</code>");
  return out;
}

export function renderMarkdownLite(text: string): string {
  const lines = String(text ?? "").split(/\r?\n/);
  const out: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (!list.length) return;
    out.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`);
    list = [];
  };
  for (const line of lines) {
    const m = line.match(/^\s*-\s+(.*)$/);
    if (m) {
      list.push(m[1]);
      continue;
    }
    flush();
    if (!line.trim()) {
      out.push("<p></p>");
      continue;
    }
    out.push(`<p>${inline(line)}</p>`);
  }
  flush();
  return out.join("");
}
