#!/usr/bin/env node
// Summarises one tag: node scripts/analyze.mjs TAG
// Reads results/TAG/<model>/<arm>/<part>/{eval/aggregate-result.json,metrics.jsonl,reports/}, results/TAG/validity.tsv
// (scripts/word-validity.mjs) and results/TAG/rubric-scores.jsonl (scripts/judge.mjs). Writes results/TAG/runs.csv (one
// row per run, atomically) and results/TAG/tables.md (the tables below), and prints the tables.
// A run is fully correct when every accuracy grader passes, the run ended without an error, and every .docx it wrote
// opens in Microsoft Word with no error and no repair prompt (validity.tsv). Process is reported only as metrics
// (turns, tool calls, tool errors, time, cost); rubric-* exact-string graders are reported beside the judged rubric.
import fs from 'fs'; import path from 'path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const TAG = process.argv[2]; if (!TAG) { console.error('usage: analyze.mjs TAG'); process.exit(2); }
const R = path.join(root, 'results', TAG);
const ARMS = ['stetdoc', 'none', 'anthropic-docx', 'anthropic-legal', 'adeu'];
const MODELS = ['claude-haiku-5-5', 'claude-opus-5-5', 'gemini-3.8-flash-medium'];
const HAIKU = /haiku/;
const notAccuracy = (g) => g.startsWith('process-') || g.startsWith('secondary-') || g === 'precondition' || g.startsWith('rubric-');
const rubric = {};
const rf = path.join(R, 'rubric-scores.jsonl');
if (fs.existsSync(rf)) for (const l of fs.readFileSync(rf, 'utf8').split('\n').filter(Boolean)) { const j = JSON.parse(l); rubric[path.resolve(root, j.report)] = j; }
const validity = new Map();
const vf = path.join(R, 'validity.tsv');
if (fs.existsSync(vf)) for (const l of fs.readFileSync(vf, 'utf8').split('\n').slice(1).filter(Boolean)) { const x = l.split('\t'); validity.set([x[0], x[1], x[2], x[3], x[4]].join('|'), { valid: x[8], fails: x[7] }); }
else console.error(`warning: no ${vf}; run scripts/word-validity.mjs first. Validity is shown as missing and no run counts as fully correct.`);
const lowTier = (m) => m.input_tokens == null ? '' : (m.input_tokens * 0.10 + m.cache_read_tokens * 0.01 + m.cache_creation_tokens * 0.125 + m.output_tokens * 0.50) / 1e6;
const dirs = (d) => fs.readdirSync(d).filter((x) => fs.statSync(path.join(d, x)).isDirectory());
const rows = [];
for (const model of fs.existsSync(R) ? dirs(R) : []) {
  for (const arm of dirs(path.join(R, model))) {
    for (const part of ['short', 'stale', 'without-stetdoc', 'long']) {
      const d = path.join(R, model, arm, part);
      const f = path.join(d, 'eval', 'aggregate-result.json'); if (!fs.existsSync(f)) continue;
      const metrics = fs.existsSync(path.join(d, 'metrics.jsonl')) ? fs.readFileSync(path.join(d, 'metrics.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return {}; } }) : [];
      for (const c of JSON.parse(fs.readFileSync(f, 'utf8')).cases) {
        if (part === 'short' && c.name === 'stale-colleague-edit') continue; // taken from the stale part
        (c.arms.with || []).forEach((r, i) => {
          const runDir = (r.tracePath || '').split('/out/')[0]; const id = path.basename(runDir);
          const m = metrics.find((x) => x.root && path.basename(x.root) === id) || {};
          const rep = path.join(d, 'reports', `${c.name}-${id}.txt`);
          const text = fs.existsSync(rep) ? fs.readFileSync(rep, 'utf8') : '';
          const authors = [...new Set([...text.matchAll(/^\{authors: (.*)\}$/gm)].flatMap((x) => [...x[1].matchAll(/"([^"]*)"/g)].map((y) => y[1])))].join('; ');
          const gs = r.graders || [];
          const acc = gs.filter((g) => !notAccuracy(g.name)), rx = gs.filter((g) => g.name.startsWith('rubric-'));
          const v = validity.get([model, arm, part, c.name, id].join('|'));
          const valid = v ? v.valid : 'missing';
          const rb = rubric[rep];
          // Blocked by the harness: Claude Code's built-in safety check refused a tool call (it needs a person to approve, and
          // plugin eval runs without one) and the run then wrote no .docx. Such runs leave every arm's denominator alike.
          const tr = fs.existsSync(rep.replace(/\.txt$/, '.transcript.jsonl')) ? fs.readFileSync(rep.replace(/\.txt$/, '.transcript.jsonl'), 'utf8') : '';
          const refused = /Permission to use \w+ has been denied because Claude Code is running in don't ask mode|denied by a built-in Claude Code safety check/.test(tr);
          const wrote = /^(created|changed): .*\.docx$/m.test(text);
          rows.push({
            tag: TAG, kind: part === 'long' ? 'long' : 'short', model, arm, part, case: c.name, run: i + 1, id, models_seen: (m.models || []).join(' '),
            acc_passed: acc.filter((g) => g.passed).length, acc_total: acc.length,
            graders_correct: acc.length > 0 && acc.every((g) => g.passed) && !r.error ? 1 : 0,
            word_valid: valid, word_failures: v ? v.fails : '',
            blocked: refused && !wrote ? 1 : 0,
            fully_correct: acc.length > 0 && acc.every((g) => g.passed) && !r.error && (valid === 'yes' || valid === '') ? 1 : 0,
            rubric_passed: rb ? rb.passed : '', rubric_total: rb ? rb.total : '', rubric_share: rb ? rb.share : '',
            rubric_regex_passed: rx.filter((g) => g.passed).length, rubric_regex_total: rx.length,
            failed_accuracy: acc.filter((g) => !g.passed).map((g) => g.name).join(' '),
            turns: r.turns, hit_limit: /turn|timed out|timeout/i.test(r.error || '') ? 1 : 0,
            tool_calls: m.tool_calls ?? '', tool_errors: m.tool_errors ?? '',
            input_tokens: m.input_tokens != null ? m.input_tokens + m.cache_creation_tokens + m.cache_read_tokens : '',
            cache_read_tokens: m.cache_read_tokens ?? '', output_tokens: m.output_tokens ?? '',
            cost_usd: +(r.costUsd || 0).toFixed(4),
            cost_tokens_list_usd: HAIKU.test(model) ? +(Number(m.haiku_list_cost_usd ?? lowTier(m)) || 0).toFixed(4) : '',
            judge_cost_usd: +((r.judgeCostUsd || 0) + (rb ? rb.judge_cost_usd : 0)).toFixed(4),
            wall_s: r.durationSeconds, authors, error: (r.error || '').replace(/[\n,]/g, ' ').slice(0, 200),
            report: fs.existsSync(rep) ? rep : '', transcript: fs.existsSync(rep.replace(/\.txt$/, '.transcript.jsonl')) ? rep.replace(/\.txt$/, '.transcript.jsonl') : '',
          });
        });
      }
    }
  }
}
if (!rows.length) { console.error('no results under ' + R); process.exit(1); }
const cols = Object.keys(rows[0]); const csv = path.join(R, 'runs.csv');
const esc = (v) => { v = String(v ?? ''); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
fs.writeFileSync(csv + '.tmp', [cols.join(',')].concat(rows.map((r) => cols.map((k) => esc(r[k])).join(','))).join('\n') + '\n');
fs.renameSync(csv + '.tmp', csv);

// ---------- tables ----------
const out = []; const P = (s = '') => out.push(s);
const med = (a) => { const s = a.filter((x) => x !== '' && x != null).map(Number).sort((x, y) => x - y); if (!s.length) return '-'; const h = Math.floor(s.length / 2); return s.length % 2 ? s[h] : +((s[h - 1] + s[h]) / 2).toFixed(4); };
const sum = (a, k) => a.reduce((s, r) => s + Number(r[k] || 0), 0);
// Gemini runs carry no price: tokens at an assumed $0.50 / $0.05 / $3 per M (input / cache read / output), not checked
// against Vertex. input_tokens = input + cache creation + cache read.
const geminiCost = (r) => (r.input_tokens === '' ? 0 : ((Number(r.input_tokens) - Number(r.cache_read_tokens || 0)) * 0.5 + Number(r.cache_read_tokens || 0) * 0.05 + Number(r.output_tokens || 0) * 3) / 1e6);
const cost = (r) => (HAIKU.test(r.model) ? r.cost_tokens_list_usd : /gemini/.test(r.model) ? geminiCost(r) : r.cost_usd);
const wilson = (k, n) => { if (!n) return [0, 0]; const z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, w = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d; return [Math.round(100 * Math.max(0, c - w)), Math.round(100 * Math.min(1, c + w))]; };
const cell = (rs) => { const k = sum(rs, 'fully_correct'), n = rs.length; if (!n) return 'not run'; const [lo, hi] = wilson(k, n); return `${k}/${n} (${lo}–${hi})`; };
const short = (r) => r.kind === 'short' && r.case !== 'not-installed' && !r.blocked;
const present = MODELS.filter((m) => rows.some((r) => r.model === m)).concat([...new Set(rows.map((r) => r.model))].filter((m) => !MODELS.includes(m)));
const tasks = [...new Set(rows.filter(short).map((r) => r.case))].sort();
const longTasks = [...new Set(rows.filter((r) => r.kind === 'long').map((r) => r.case))].sort();

P(`# ${TAG}: tables`); P();
P(`Generated by scripts/analyze.mjs from results/${TAG}/runs.csv. Fully correct: every accuracy grader passes, no run error, and every written .docx opens in Microsoft Word without an error or a repair prompt. Wilson 95% intervals are descriptive (runs cluster by task).`); P();
const missing = rows.filter((r) => r.word_valid === 'missing' || r.word_valid === 'pending').length;
if (missing) { P(`**${missing} runs have no Word verdict yet (validity missing or pending); they count as not fully correct.**`); P(); }
P('## Short tasks, fully correct runs'); P();
P('| arm | ' + present.join(' | ') + ' |'); P('|---|' + present.map(() => '---|').join(''));
for (const a of ARMS) P(`| ${a} | ` + present.map((m) => cell(rows.filter((r) => r.model === m && r.arm === a && short(r)))).join(' | ') + ' |');
P();
const bl = rows.filter((r) => r.blocked);
if (bl.length) { const g = {}; for (const r of bl) { const k = `${r.model} ${r.arm} ${r.case}`; g[k] = (g[k] || 0) + 1; } P('Not counted (stopped by Claude Code\'s safety prompt, which needs a person to approve): ' + Object.entries(g).map(([k, n]) => `${k} ${n}`).join('; ') + '.'); P(); }
for (const m of present) {
  P(`### Per task, ${m} (fully correct / runs)`); P();
  P('| task | ' + ARMS.join(' | ') + ' |'); P('|---|' + ARMS.map(() => '---').join('|') + '|');
  for (const t of tasks.concat(rows.some((r) => r.model === m && r.case === 'not-installed') ? ['not-installed'] : [])) P(`| ${t} | ` + ARMS.map((a) => { const x = rows.filter((r) => r.model === m && r.arm === a && r.case === t && !r.blocked); return x.length ? `${sum(x, 'fully_correct')}/${x.length}` : 'n/a'; }).join(' | ') + ' |');
  P();
}
// Task-clustered bootstrap: stetdoc minus another arm, pooled fully-correct rate over resampled tasks.
let seed = 20261030; const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function boot(model, other, B = 10000) {
  const rs = rows.filter((r) => r.model === model && short(r));
  const ts = [...new Set(rs.filter((r) => r.arm === 'stetdoc').map((r) => r.case))].filter((t) => rs.some((r) => r.arm === other && r.case === t)).sort();
  const agg = (arm) => Object.fromEntries(ts.map((t) => { const x = rs.filter((r) => r.arm === arm && r.case === t); return [t, [sum(x, 'fully_correct'), x.length]]; }));
  const S = agg('stetdoc'), O = agg(other);
  const diff = (pick) => { let sk = 0, sn = 0, ok = 0, on = 0; for (const t of pick) { sk += S[t][0]; sn += S[t][1]; ok += O[t][0]; on += O[t][1]; } return 100 * (sk / sn - ok / on); };
  const d = []; for (let b = 0; b < B; b++) d.push(diff(ts.map(() => ts[Math.floor(rnd() * ts.length)])));
  d.sort((a, b) => a - b);
  return { point: Math.round(diff(ts)), lo: Math.round(d[Math.floor(0.025 * B)]), hi: Math.round(d[Math.ceil(0.975 * B) - 1]), tasks: ts.length };
}
P('## stetdoc minus each other arm (short tasks, percentage points)'); P();
P('Task-clustered bootstrap: whole tasks resampled with replacement, 10,000 draws, seed 20261030, 95% percentile interval; the first number is the observed difference in pooled fully-correct rate.'); P();
P('| model | vs | difference [95% interval] |'); P('|---|---|---|');
const bs = {};
for (const m of present) for (const a of ARMS.slice(1)) { if (!rows.some((r) => r.model === m && r.arm === a && short(r))) continue; const b = boot(m, a); (bs[m] ??= {})[a] = b; P(`| ${m} | ${a} | ${b.point >= 0 ? '+' : ''}${b.point} [${b.lo}, ${b.hi}] |`); }
P();
P('## Long tasks'); P();
P('| model | arm | runs | fully correct (objective criteria + Word) | mean rubric share (judge) | exact-string rubric items | hit limit or error |'); P('|---|---|---|---|---|---|---|');
for (const m of present) for (const a of ARMS) { const x = rows.filter((r) => r.model === m && r.arm === a && r.kind === 'long' && !r.blocked); if (!x.length) continue; const j = x.filter((r) => r.rubric_total !== '');
  P(`| ${m} | ${a} | ${x.length} | ${sum(x, 'fully_correct')}/${x.length} | ${j.length ? Math.round((100 * j.reduce((s, r) => s + Number(r.rubric_share), 0)) / j.length) + '%' : 'not judged'} | ${sum(x, 'rubric_regex_passed')}/${sum(x, 'rubric_regex_total')} | ${x.filter((r) => r.error).length} |`); }
P();
P('## Process metrics (short tasks, medians per run; cost: Opus = Claude Code estimate, Haiku = tokens at list price, Gemini = tokens at assumed rates)'); P();
P('| model | arm | turns | tool calls | tool errors | wall s | cost $ | total cost $ |'); P('|---|---|---|---|---|---|---|---|');
for (const m of present) for (const a of ARMS) { const x = rows.filter((r) => r.model === m && r.arm === a && short(r)); if (!x.length) continue;
  P(`| ${m} | ${a} | ${med(x.map((r) => r.turns))} | ${med(x.map((r) => r.tool_calls))} | ${med(x.map((r) => r.tool_errors))} | ${med(x.map((r) => r.wall_s))} | ${(+med(x.map(cost)) || 0).toFixed(3)} | ${x.reduce((s, r) => s + Number(cost(r) || 0), 0).toFixed(2)} |`); }
P();
P(`Runs: ${rows.length}. Agent cost (Opus: Claude Code estimate; Haiku: list; Gemini: assumed rates) $${rows.reduce((s, r) => s + Number(cost(r) || 0), 0).toFixed(2)}, judges $${sum(rows, 'judge_cost_usd').toFixed(2)}. CSV: ${path.relative(root, csv)}`);
fs.writeFileSync(path.join(R, 'tables.md'), out.join('\n') + '\n');
fs.writeFileSync(path.join(R, 'bootstrap.json'), JSON.stringify(bs, null, 1) + '\n');
console.log(out.join('\n'));
