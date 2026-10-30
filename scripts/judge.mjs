#!/usr/bin/env node
// Scores Harvey's rubric for the long tasks from the saved harness reports of one tag.
//   node scripts/judge.mjs TAG     (VOTES=3 for a majority of three; default 1)
// For each report it builds an excerpt (file status, and per written .docx its check, revision
// ledger, comments and changed paragraphs; the full final text only for a cover note), asks
// claude-sonnet-5-5 for a PASS/FAIL per rubric item three times, and keeps the majority.
// Appends one JSON line per report to results/TAG/rubric-scores.jsonl; reports already scored are skipped.
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process'; import os from 'os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const TAG = process.argv[2]; if (!TAG) { console.error('usage: judge.mjs TAG'); process.exit(2); }
const out = path.join(root, 'results', TAG, 'rubric-scores.jsonl');
const done = new Set(fs.existsSync(out) ? fs.readFileSync(out, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).report) : []);
const VOTES = Number(process.env.VOTES || 1);

function excerpt(report) {
  const lines = report.split('\n'); const keep = []; let mode = 'head', isCover = false;
  for (const l of lines) {
    if (l.startsWith('metrics: ')) continue;
    if (l.startsWith('== ')) { mode = 'file'; isCover = /cover/i.test(l); keep.push('', l); continue; }
    if (l === '-- final text') { mode = isCover ? 'file' : 'skip'; if (isCover) keep.push(l); continue; }
    if (l.startsWith('-- ')) { mode = 'file'; keep.push(l); continue; }
    if (l.startsWith('untracked-diff: ')) continue;
    if (mode !== 'skip') keep.push(l.length > 2500 ? l.slice(0, 2500) + ' [...]' : l);
  }
  let s = keep.join('\n');
  if (s.length > 250000) s = s.slice(0, 250000) + '\n[excerpt cut at 250,000 characters]';
  return s;
}

function ask(rubric, ex) {
  const prompt = `You grade a legal markup task against a rubric. Below is a report of what the agent produced, made by a reader tool that read the output .docx files: for each file written, its tracked changes ("-- revisions": #id kind author date paragraph "text"), its comments ("-- comments"), and "text-diff" lines that show each changed paragraph before (<) and after (>) as read with all changes accepted. A cover note's full text is included when there is one. The agent's chat reply is not included; judge only the files.

For each rubric item, answer PASS only if the report shows the item is met; otherwise FAIL. Reply with one JSON object and nothing else, mapping every item id to "PASS" or "FAIL".

RUBRIC:
${JSON.stringify(rubric.map((r) => ({ id: r.id, criterion: r.match_criteria })), null, 1)}

REPORT:
${ex}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'judge-'));
  try {
    const res = execFileSync('claude', ['-p', '--model', 'claude-sonnet-5-5', '--output-format', 'json', '--allowedTools', '', '--no-session-persistence', '--strict-mcp-config'],
      { input: prompt, cwd: tmp, maxBuffer: 64 << 20, encoding: 'utf8', timeout: 600000 });
    const j = JSON.parse(res);
    const m = String(j.result).match(/\{[\s\S]*\}/);
    return { verdicts: m ? JSON.parse(m[0]) : {}, cost: j.total_cost_usd || 0 };
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

const reportDirs = [];
for (const model of fs.readdirSync(path.join(root, 'results', TAG)).filter((d) => fs.statSync(path.join(root, 'results', TAG, d)).isDirectory()))
  for (const arm of fs.readdirSync(path.join(root, 'results', TAG, model)).filter((d) => fs.statSync(path.join(root, 'results', TAG, model, d)).isDirectory()))
    reportDirs.push([model, arm, path.join(root, 'results', TAG, model, arm, 'long', 'reports')]);
{
  for (const [model, arm, rd] of reportDirs) { if (!fs.existsSync(rd)) continue;
    for (const f of fs.readdirSync(rd).filter((x) => x.startsWith('long-') && x.endsWith('.txt'))) {
      const rep = path.join(rd, f); if (done.has(rep)) continue;
      const task = f.replace(/-[ea]-[A-Za-z0-9]+\.txt$/, '');
      const rubric = JSON.parse(fs.readFileSync(path.join(root, 'rubrics', task + '.json'), 'utf8'));
      const ex = excerpt(fs.readFileSync(rep, 'utf8'));
      const votes = []; let cost = 0;
      for (let i = 0; i < VOTES; i++) { const r = ask(rubric, ex); votes.push(r.verdicts); cost += r.cost; }
      const items = {};
      for (const r of rubric) { const p = votes.filter((v) => String(v[r.id]).toUpperCase() === 'PASS').length; items[r.id] = p * 2 > VOTES ? 'PASS' : 'FAIL'; }
      const passed = Object.values(items).filter((v) => v === 'PASS').length;
      const line = { report: rep, model, arm, task, run_id: f.match(/([ea]-[A-Za-z0-9]+)\.txt$/)[1], passed, total: rubric.length, share: +(passed / rubric.length).toFixed(3), judge_cost_usd: +cost.toFixed(4), excerpt_chars: ex.length, items };
      fs.appendFileSync(out, JSON.stringify(line) + '\n');
      console.log(`${arm} ${task} ${line.run_id}: ${passed}/${rubric.length} ($${line.judge_cost_usd})`);
    }
  }
}
