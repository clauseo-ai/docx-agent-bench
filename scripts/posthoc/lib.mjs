// Shared helpers for the post-hoc v1.1 corrections of final-1 (see scripts/posthoc/README.md).
import fs from 'fs';

export const split = (l) => { const r = []; let f = '', q = false; for (let i = 0; i < l.length; i++) { const c = l[i]; if (q) { if (c === '"') { if (l[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; } else if (c === '"') q = true; else if (c === ',') { r.push(f); f = ''; } else f += c; } r.push(f); return r; };
export const esc = (v) => { v = String(v ?? ''); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
export const load = (p) => { const L = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean); const h = split(L[0]); return [h, L.slice(1).map((l) => { const r = split(l); return Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])); })]; };
export const key = (r) => [r.model, r.arm, r.kind, r.case, r.run].join('|');
export const fails = (r) => (r.failed_accuracy || '').split(/[ ;]+/).filter(Boolean);

// Per written .docx, the report block from "== path" up to the next "== " or end.
export function blocks(report) {
  const out = []; let cur = null;
  for (const l of report.split('\n')) {
    if (l.startsWith('== ')) { cur = { file: l.slice(3), lines: [] }; out.push(cur); continue; }
    if (cur) cur.lines.push(l);
  }
  return out;
}
export const created = (report) => report.split('\n').filter((l) => /^created: .*\.docx$/.test(l)).map((l) => l.slice(9));
