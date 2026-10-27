#!/usr/bin/env node
// Summarises one tag: node scripts/analyze.mjs TAG
// Reads results/TAG/<model>/<arm>/<part>/{eval/aggregate-result.json,metrics.jsonl,reports/}, writes
// results/TAG/runs.csv (one row per run, written atomically) and prints the Markdown tables.
import fs from 'fs'; import path from 'path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const TAG = process.argv[2]; if (!TAG) { console.error('usage: analyze.mjs TAG'); process.exit(2); }
const R = path.join(root, 'results', TAG);
const ARMS = ['stetdoc', 'none', 'anthropic-docx', 'anthropic-legal', 'adeu'];
const HAIKU = /haiku/;
// Process notes are not accuracy; rubric-* exact-string graders are reported beside the judged rubric.
const notAccuracy = (g) => g.startsWith('process-') || g === 'precondition' || g.startsWith('rubric-');
const tracking = new Set(['all-changes-tracked', 'author', 'payment-deleted', 'payment-inserted', 'law-deleted', 'law-inserted', 'many-revisions']);
const rubric = {};
const rf = path.join(R, 'rubric-scores.jsonl');
if (fs.existsSync(rf)) for (const l of fs.readFileSync(rf, 'utf8').split('\n').filter(Boolean)) { const j = JSON.parse(l); rubric[path.resolve(root, j.report)] = j; }
const lowTier = (m) => m.input_tokens == null ? '' : (m.input_tokens * 0.10 + m.cache_read_tokens * 0.01 + m.cache_creation_tokens * 0.125 + m.output_tokens * 0.50) / 1e6;
const rows = [];
for (const model of fs.existsSync(R) ? fs.readdirSync(R).filter((d) => fs.statSync(path.join(R, d)).isDirectory()) : []) {
  for (const arm of fs.readdirSync(path.join(R, model)).filter((d) => fs.statSync(path.join(R, model, d)).isDirectory())) {
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
          const acc = gs.filter((g) => !notAccuracy(g.name)), proc = gs.filter((g) => g.name.startsWith('process-')), rx = gs.filter((g) => g.name.startsWith('rubric-'));
          const noJudge = acc.filter((g) => g.name !== 'interpretation');
          const rb = rubric[rep];
          rows.push({
            tag: TAG, kind: part === 'long' ? 'long' : 'short', model, arm, case: c.name, run: i + 1, models_seen: (m.models || []).join(' '),
            acc_passed: acc.filter((g) => g.passed).length, acc_total: acc.length,
            fully_correct: acc.length > 0 && acc.every((g) => g.passed) && !r.error ? 1 : 0,
            nojudge_passed: noJudge.filter((g) => g.passed).length, nojudge_total: noJudge.length,
            nojudge_correct: noJudge.length > 0 && noJudge.every((g) => g.passed) && !r.error ? 1 : 0,
            text_passed: acc.filter((g) => !tracking.has(g.name) && g.passed).length, text_total: acc.filter((g) => !tracking.has(g.name)).length,
            rubric_passed: rb ? rb.passed : '', rubric_total: rb ? rb.total : '', rubric_share: rb ? rb.share : '',
            rubric_regex_passed: rx.filter((g) => g.passed).length, rubric_regex_total: rx.length,
            failed_accuracy: acc.filter((g) => !g.passed).map((g) => g.name).join(' '),
            failed_process: proc.filter((g) => !g.passed).map((g) => g.name).join(' '),
            turns: r.turns, hit_limit: /turn|timed out|timeout/i.test(r.error || '') ? 1 : 0,
            tool_calls: m.tool_calls ?? '', tool_errors: m.tool_errors ?? '',
            input_tokens: m.input_tokens != null ? m.input_tokens + m.cache_creation_tokens + m.cache_read_tokens : '',
            cache_read_tokens: m.cache_read_tokens ?? '', output_tokens: m.output_tokens ?? '',
            cost_usd: +(r.costUsd || 0).toFixed(4),
            cost_tokens_list_usd: HAIKU.test(model) ? +(m.haiku_list_cost_usd ?? lowTier(m) ?? 0).toFixed(4) : '',
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
fs.writeFileSync(csv + '.tmp', [cols.join(',')].concat(rows.map((r) => cols.map((k) => { const v = String(r[k] ?? ''); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }).join(','))).join('\n') + '\n');
fs.renameSync(csv + '.tmp', csv);
const med = (a) => { const s = a.filter((x) => x !== '' && x != null).map(Number).sort((x, y) => x - y); if (!s.length) return '-'; const h = Math.floor(s.length / 2); return s.length % 2 ? s[h] : +((s[h - 1] + s[h]) / 2).toFixed(4); };
const pct = (a, b) => (b ? Math.round((100 * a) / b) + '%' : '-');
const sum = (a, k) => a.reduce((s, r) => s + Number(r[k] || 0), 0);
const cost = (r) => (HAIKU.test(r.model) ? r.cost_tokens_list_usd : r.cost_usd);
const P = console.log;
for (const model of [...new Set(rows.map((r) => r.model))]) {
  const M = rows.filter((r) => r.model === model && r.kind === 'short');
  if (M.length) {
    P(`\n### Short tasks, ${model}${HAIKU.test(model) ? ' (cost: tokens at list price)' : ''}\n`);
    const seen = M.filter((r) => r.models_seen); P(`Model check: ${seen.filter((r) => r.models_seen === model).length} of ${M.length} runs show only ${model} in their transcript.\n`);
    P('| arm | runs | criteria passed | fully correct | shared tasks: criteria / fully correct | shared, without tracking criteria | median turns | median tool calls | median cost $ | median wall s | total cost $ |');
    P('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const arm of ARMS) { const a = M.filter((r) => r.arm === arm); if (!a.length) continue; const s = a.filter((r) => r.case !== 'not-installed');
      P(`| ${arm} | ${a.length} | ${pct(sum(a, 'acc_passed'), sum(a, 'acc_total'))} | ${pct(sum(a, 'fully_correct'), a.length)} | ${pct(sum(s, 'acc_passed'), sum(s, 'acc_total'))} / ${pct(sum(s, 'fully_correct'), s.length)} | ${pct(sum(s, 'text_passed'), sum(s, 'text_total'))} | ${med(a.map((r) => r.turns))} | ${med(a.map((r) => r.tool_calls))} | ${(+med(a.map(cost))).toFixed(3)} | ${med(a.map((r) => r.wall_s))} | ${a.reduce((x, r) => x + Number(cost(r) || 0), 0).toFixed(2)} |`); }
    P('\n| task | ' + ARMS.join(' | ') + ' |'); P('|---|' + ARMS.map(() => '---').join('|') + '|');
    for (const c of [...new Set(M.map((r) => r.case))]) P(`| ${c} | ` + ARMS.map((arm) => { const a = M.filter((r) => r.arm === arm && r.case === c); return a.length ? `${sum(a, 'fully_correct')}/${a.length}, ${pct(sum(a, 'acc_passed'), sum(a, 'acc_total'))}, ${med(a.map((r) => r.turns))} t` : 'n/a'; }).join(' | ') + ' |');
    P('\naccept-reject-ambiguous with / without the judged interpretation grader:\n'); P('| arm | with | without |'); P('|---|---|---|');
    for (const arm of ARMS) { const a = M.filter((r) => r.arm === arm && r.case === 'accept-reject-ambiguous'); if (a.length) P(`| ${arm} | ${pct(sum(a, 'acc_passed'), sum(a, 'acc_total'))}, ${sum(a, 'fully_correct')}/${a.length} | ${pct(sum(a, 'nojudge_passed'), sum(a, 'nojudge_total'))}, ${sum(a, 'nojudge_correct')}/${a.length} |`); }
  }
  const L = rows.filter((r) => r.model === model && r.kind === 'long');
  if (L.length) {
    P(`\n### Long tasks, ${model}\n`);
    P('| arm | runs | mean rubric share (judge) | exact-string rubric items | objective criteria | hit limit | total cost $ |'); P('|---|---|---|---|---|---|---|');
    for (const arm of ARMS) { const a = L.filter((r) => r.arm === arm); if (!a.length) continue; const j = a.filter((r) => r.rubric_total !== '');
      P(`| ${arm} | ${a.length} | ${j.length ? Math.round((100 * j.reduce((s, r) => s + Number(r.rubric_share), 0)) / j.length) + '%' : 'not judged'} | ${pct(sum(a, 'rubric_regex_passed'), sum(a, 'rubric_regex_total'))} | ${pct(sum(a, 'acc_passed'), sum(a, 'acc_total'))} | ${sum(a, 'hit_limit')} | ${a.reduce((x, r) => x + Number(cost(r) || 0), 0).toFixed(2)} |`); }
  }
}
P(`\nRuns: ${rows.length}. Agent cost (Claude Code estimate) $${sum(rows, 'cost_usd').toFixed(2)}, judges $${sum(rows, 'judge_cost_usd').toFixed(2)}. CSV: ${csv}`);
