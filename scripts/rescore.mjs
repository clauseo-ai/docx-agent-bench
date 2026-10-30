#!/usr/bin/env node
// Re-scores the regex graders of every saved run of a tag from its saved harness report, offline (no agent, no judge).
//   node scripts/rescore.mjs TAG [--dry]
// The graders read the report through suite/evals/harness/normalise.sh (comment markers and the reader's note on other
// authors' changes removed), as report.sh does for new runs. For each saved report <case>-<id>.txt the raw text is kept
// as <case>-<id>.raw and the .txt becomes the normalised text. Each regex grader in suite/evals/{cases,long,
// without-stetdoc}/<case>/graders is evaluated on the raw text first: that must reproduce the verdict stored in
// eval/aggregate-result.json, or the script stops. Then the stored verdicts are replaced by the verdicts on the normalised
// text (the previous aggregate is kept as eval/aggregate-result.raw.json). llm graders keep their stored verdicts.
// Writes results/TAG/rescore-audit.tsv (one row per run and grader whose matches or verdict differ) and
// results/TAG/rescore-changes.tsv (runs whose all-graders verdict changed), and prints a summary by arm.
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const TAG = process.argv[2]; const DRY = process.argv.includes('--dry');
if (!TAG) { console.error('usage: rescore.mjs TAG [--dry]'); process.exit(2); }
const R = path.join(root, 'results', TAG), E = path.join(root, 'suite/evals');
const NORM = path.join(E, 'harness/normalise.sh');
const normalise = (s) => execFileSync(NORM, { input: s, encoding: 'utf8', maxBuffer: 1 << 28 });
const stripMarkers = (s) => s.replace(/\{\/?c[0-9]+\}/g, '');
const dirs = (d) => (fs.existsSync(d) ? fs.readdirSync(d).filter((x) => fs.statSync(path.join(d, x)).isDirectory()) : []);

// Grader files, read the way scripts/agy-bench.mjs reads them.
function scalar(v) {
  if (v.startsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  if (v.startsWith('"')) return JSON.parse(v);
  if (v.startsWith('[')) return v.slice(1, -1).split(',').map((s) => scalar(s.trim())).filter((s) => s !== '');
  if (v.startsWith('{')) return Object.fromEntries(v.slice(1, -1).split(',').map((s) => s.split(':').map((x) => x.trim())).map(([a, b]) => [a, scalar(b)]));
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}
function frontMatter(file) {
  const t = fs.readFileSync(file, 'utf8'); const m = t.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/); const meta = {};
  if (m) for (const line of m[1].split('\n')) { const k = line.match(/^([A-Za-z_]+):\s*(.*)$/); if (k) meta[k[1]] = scalar(k[2].trim()); }
  return meta;
}
const graderCache = {};
function graders(kase) {
  if (graderCache[kase]) return graderCache[kase];
  const d = ['cases', 'long', 'without-stetdoc'].map((p) => path.join(E, p, kase, 'graders')).find((x) => fs.existsSync(x));
  if (!d) throw new Error(`no graders for ${kase}`);
  return (graderCache[kase] = fs.readdirSync(d).filter((f) => f.endsWith('.md')).sort().map((f) => ({ name: f.slice(0, -3), ...frontMatter(path.join(d, f)) })));
}
function matches(g, text) {
  const flags = String(g.flags || '').replace(/[^imsu]/g, '');
  return [...text.matchAll(new RegExp(g.pattern, flags + 'g'))].map((m) => [m.index, m.index + m[0].length]);
}
function verdict(g, n) { const mt = String(g.match || 'contains'); return mt === 'not_contains' ? n === 0 : mt.startsWith('count:') ? n === Number(mt.slice(6)) : n > 0; }
// Character spans of the reader's note lines in a raw report (the lines normalise.sh drops).
function noteSpans(raw) {
  const spans = []; let pos = 0;
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^[0-9]+ tracked changes? by .* already in the document: /.test(l) || (l === 'If you did not make them, tell the user about them.' && i > 0 && /already in the document: /.test(lines[i - 1]))) spans.push([pos, pos + l.length]);
    pos += l.length + 1;
  }
  return spans;
}
const inside = (m, spans) => spans.some(([a, b]) => m[0] < b && m[1] > a);

const audit = [['model', 'arm', 'part', 'case', 'id', 'grader', 'matches_raw', 'matches_in_note', 'matches_markers_removed_only', 'matches_normalised', 'passed_raw', 'passed_normalised'].join('\t')];
const changes = [['model', 'arm', 'part', 'case', 'id', 'graders_pass_before', 'graders_pass_after', 'flipped'].join('\t')];
const byArm = {}; let runs = 0, checked = 0, mismatch = [];
for (const model of dirs(R)) for (const arm of dirs(path.join(R, model))) for (const part of dirs(path.join(R, model, arm))) {
  const d = path.join(R, model, arm, part), aggF = path.join(d, 'eval/aggregate-result.json');
  if (!fs.existsSync(aggF)) continue;
  const rawAggF = path.join(d, 'eval/aggregate-result.raw.json');
  const agg = JSON.parse(fs.readFileSync(fs.existsSync(rawAggF) ? rawAggF : aggF, 'utf8'));
  for (const c of agg.cases) for (const r of c.arms.with || []) {
    const id = r.runId || path.basename((r.tracePath || '').split('/out/')[0]);
    const txt = path.join(d, 'reports', `${c.name}-${id}.txt`), rawF = path.join(d, 'reports', `${c.name}-${id}.raw`);
    if (!fs.existsSync(txt) && !fs.existsSync(rawF)) { console.error(`STOP: no saved report for ${model} ${arm} ${part} ${c.name} ${id}`); process.exit(1); }
    const raw = fs.readFileSync(fs.existsSync(rawF) ? rawF : txt, 'utf8'), norm = normalise(raw), spans = noteSpans(raw), noMark = stripMarkers(raw);
    runs++;
    const a = (byArm[arm] ||= { runs: 0, notePassages: 0, graderMatchesInNote: 0, markerDependent: 0, graderVerdictsChanged: 0, runsFlipped: 0 });
    a.runs++; a.notePassages += (raw.match(/^[0-9]+ tracked changes? by .* already in the document: /gm) || []).length;
    const stored = new Map((r.graders || []).map((g) => [g.name, g]));
    const before = (r.graders || []).map((g) => g.passed);
    for (const g of graders(c.name)) {
      if (g.type !== 'regex') continue;
      const s = stored.get(g.name); if (!s) continue; // a grader the run did not record (e.g. precondition in another part)
      const mr = matches(g, raw), mn = matches(g, norm), mm = matches(g, noMark);
      const pr = verdict(g, mr.length), pn = verdict(g, mn.length); checked++;
      if (pr !== s.passed) mismatch.push(`${model} ${arm} ${part} ${c.name} ${id} ${g.name}: stored ${s.passed}, raw ${pr}`);
      const inNote = mr.filter((m) => inside(m, spans)).length;
      a.graderMatchesInNote += inNote; if (mm.length !== mr.length) a.markerDependent++;
      if (pn !== pr) a.graderVerdictsChanged++;
      if (inNote || mm.length !== mr.length || mn.length !== mr.length || pn !== pr) audit.push([model, arm, part, c.name, id, g.name, mr.length, inNote, mm.length, mn.length, pr, pn].join('\t'));
      s.passed = pn;
    }
    const after = (r.graders || []).map((g) => g.passed);
    const okB = before.length > 0 && before.every(Boolean), okA = after.length > 0 && after.every(Boolean);
    if (okB !== okA) { a.runsFlipped++; changes.push([model, arm, part, c.name, id, okB, okA, (r.graders || []).filter((g, i) => before[i] !== after[i]).map((g) => g.name).join(' ')].join('\t')); }
    if (!DRY) {
      if (!fs.existsSync(rawF)) fs.writeFileSync(rawF, raw);
      fs.writeFileSync(txt, norm);
    }
  }
  if (!DRY) {
    if (!fs.existsSync(rawAggF)) fs.copyFileSync(aggF, rawAggF);
    fs.writeFileSync(aggF + '.tmp', JSON.stringify(agg, null, 1)); fs.renameSync(aggF + '.tmp', aggF);
  }
}
if (mismatch.length) { console.error(`STOP: the raw reports do not reproduce ${mismatch.length} stored verdicts:\n` + mismatch.slice(0, 20).join('\n')); process.exit(1); }
if (!DRY) { fs.writeFileSync(path.join(R, 'rescore-audit.tsv'), audit.join('\n') + '\n'); fs.writeFileSync(path.join(R, 'rescore-changes.tsv'), changes.join('\n') + '\n'); }
console.log(`${runs} runs, ${checked} regex verdicts; the raw reports reproduce every stored verdict.`);
console.log(['arm', 'runs', 'notes in reports', 'grader matches inside a note', 'grader x run with marker-dependent matches', 'grader verdicts changed', 'runs whose verdict changed'].join('\t'));
for (const [arm, a] of Object.entries(byArm)) console.log([arm, a.runs, a.notePassages, a.graderMatchesInNote, a.markerDependent, a.graderVerdictsChanged, a.runsFlipped].join('\t'));
console.log(changes.slice(1).join('\n'));
