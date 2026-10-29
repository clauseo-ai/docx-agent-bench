// Post-hoc neutral re-judge of accept-reject-ambiguous (v1.1 correction 2).
//
// The frozen `interpretation` grader rewards "state your reading or ask first", which mirrors stetdoc's
// skill (core.md: "or ask them first"), and its file graders pass when no file is written. This script
// judges every arm's saved run with a neutral rubric (ar-neutral-rubric.md), blind to arm:
//   - the judge sees the agent's final reply (tool names redacted) and file evidence from the saved
//     report (file written or not, unresolved changes left, and every paragraph that differs from
//     "accept all"), never the arm or model;
//   - runs are judged in a shuffled order;
//   - the full text of the 47 changes is given (round 1 cut each to 170 characters, and Sonnet then failed
//     accurate replies as "misdescribing" changes it could not see; see ar-neutral-rubric-r1.md);
//   - 3 votes from claude-sonnet-5-5 (claude -p with no tools and a one-line system prompt) and 1 vote from a non-Anthropic
//     judge, gemini-4-argon through the local Gemini-API proxy (GEMINI_URL, default http://127.0.0.1:6969).
// Appends one JSON line per run to OUT (default results/final-1/posthoc/ar-neutral-votes.jsonl);
// runs already judged are skipped.
//
//   node ar-neutral-judge.mjs RUNS.csv [OUT]      (DRY=1 prints one prompt and exits)
import fs from 'fs'; import path from 'path'; import os from 'os'; import { spawn, execFileSync } from 'child_process';
import { load, blocks, created } from './lib.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '../..');
const [runsCsv, outArg] = process.argv.slice(2);
const OUT = outArg || path.join(root, 'results/final-1/posthoc/ar-neutral-votes.jsonl');
const MAX_USD = Number(process.env.MAX_USD || 4); // stop starting new runs once the Sonnet spend of this invocation passes this
let spent = 0;
const GEMINI_URL = process.env.GEMINI_URL || 'http://127.0.0.1:6969';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-4-argon';
const SONNET_VOTES = Number(process.env.SONNET_VOTES || 3);
const CONC = Number(process.env.CONC || 6);
const rubric = fs.readFileSync(path.join(here, 'ar-neutral-rubric.md'), 'utf8');
const fixture = path.join(root, 'suite/evals/fixtures/isda-confirmation-v2.docx');

const LEDGER = execFileSync(process.env.STETDOC_BIN || 'stetdoc', ['view', fixture, '--revisions', '--full', '--all'], { encoding: 'utf8' })
  .split('\n').filter((l) => /^#\d+ /.test(l))
  .map((l) => { const m = l.match(/^#(\d+) (insert|delete) \S+ \S+ p\d+ (.*)$/); const t = m[3]; return `R${m[1]} ${m[2]}: ${t}`; })
  .join('\n');

const REDACT = /\b(stetdoc|stet|adeu|python-docx|docx2python|python3?|lxml|unzip|anthropic|claude|gemini|skills?|mcp|plugin)\b/gi;
function reply(transcript) {
  if (!transcript || !fs.existsSync(transcript)) return '';
  const msgs = fs.readFileSync(transcript, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  // Text the assistant wrote after its last tool call.
  let lastTool = -1; msgs.forEach((m, i) => { const c = m.message?.content; if (Array.isArray(c) && c.some((x) => x.type === 'tool_use' || x.type === 'tool_result')) lastTool = i; });
  const texts = [];
  msgs.forEach((m, i) => { if (i <= lastTool || m.type !== 'assistant') return; const c = m.message?.content; if (typeof c === 'string') texts.push(c); else if (Array.isArray(c)) for (const x of c) if (x.type === 'text') texts.push(x.text); });
  return texts.join('\n').replace(REDACT, '[tool]');
}
function evidence(report) {
  const docs = created(report);
  const lines = [`New .docx files written: ${docs.length ? docs.map((d) => path.basename(d)).join(', ') : 'NONE'}`];
  lines.push(/^unchanged: \.\/docs\/isda-confirmation-v2\.docx$/m.test(report) ? 'Original file: unchanged.' : 'Original file: CHANGED or missing.');
  for (const b of blocks(report)) {
    const rem = (b.lines.find((l) => l.startsWith('remaining-revisions: ')) || '').slice(21);
    lines.push('', `File ${path.basename(b.file)}: unresolved tracked changes left: ${rem || '?'}.`);
    const d = b.lines.filter((l) => l.startsWith('text-diff: ')).map((l) => l.slice(11));
    if (!d.length) lines.push('Its text, read with every change accepted, is identical to "accept all 47" (nothing was rejected).');
    else {
      lines.push('Paragraphs where this file differs from "accept all 47" (< = accept-all text, > = this file):');
      for (const l of d.slice(0, 80)) lines.push(l.length > 600 ? l.slice(0, 600) + ' […]' : l);
      if (d.length > 80) lines.push(`[${d.length - 80} more lines cut]`);
    }
  }
  return lines.join('\n').replace(REDACT, '[tool]');
}
const prompt = (r, rep) => `${rubric}\nTHE 47 TRACKED CHANGES:\n${LEDGER}\n\nAGENT'S FINAL REPLY (tool names redacted):\n<<<\n${reply(r.transcript) || '(no reply text)'}\n>>>\n\nFILE EVIDENCE (read from the saved run, after the agent finished):\n${evidence(rep)}\n`;

// Strict JSON first; a reply whose JSON does not parse (an unescaped quote) still counts when its verdict field is unambiguous.
const parse = (s) => { const m = String(s).match(/\{[\s\S]*\}/); try { const j = JSON.parse(m[0]); return { verdict: String(j.verdict).toUpperCase() === 'PASS' ? 'PASS' : 'FAIL', reading: j.reading, reason: j.reason }; } catch { const v = String(s).match(/"verdict"\s*:\s*"(PASS|FAIL)"/i); return v ? { verdict: v[1].toUpperCase(), raw: String(s).slice(0, 600) } : { verdict: 'ERROR', raw: String(s).slice(0, 600) }; } };
function run(cmd, args, input) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'arj-'));
  return new Promise((res, rej) => { const p = spawn(cmd, args, { cwd }); let o = '', e = '';
    p.stdout.on('data', (d) => (o += d)); p.stderr.on('data', (d) => (e += d));
    p.on('close', (c) => { fs.rmSync(cwd, { recursive: true, force: true }); c === 0 ? res(o) : rej(new Error(e.slice(0, 500))); }); p.stdin.end(input); });
}
async function sonnet(p) {
  const o = await run('claude', ['-p', '--model', 'claude-sonnet-5-5', '--output-format', 'json', '--tools', '', '--no-session-persistence', '--strict-mcp-config', '--system-prompt', 'You are a careful, neutral grader. Reply with one JSON object only.'], p);
  const j = JSON.parse(o); return { ...parse(j.result), cost: j.total_cost_usd || 0 };
}
async function gemini(p) {
  for (let a = 0; a < 4; a++) {
    const r = await fetch(`${GEMINI_URL}/v1beta/models/${GEMINI_MODEL}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': 'dummy' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: p }] }], generationConfig: { responseMimeType: 'application/json' } }) });
    const j = await r.json();
    if (j.error) { if (a < 3) { await new Promise((s) => setTimeout(s, 5000 * (a + 1))); continue; } return { verdict: 'ERROR', raw: JSON.stringify(j.error).slice(0, 300), usage: {} }; }
    const t = (j.candidates?.[0]?.content?.parts || []).filter((x) => !x.thought).map((x) => x.text || '').join('');
    return { ...parse(t), usage: j.usageMetadata || {} };
  }
}

const [, rows] = load(runsCsv);
const todo0 = rows.filter((r) => r.case === 'accept-reject-ambiguous');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).report) : []);
const todo = todo0.filter((r) => !done.has(r.report));
for (let i = todo.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [todo[i], todo[j]] = [todo[j], todo[i]]; }
if (process.env.DRY) { console.log(prompt(todo[0], fs.readFileSync(todo[0].report, 'utf8'))); process.exit(0); }
let next = 0;
async function worker() {
  while (next < todo.length && spent < MAX_USD) {
    const r = todo[next++]; const rep = r.report && fs.existsSync(r.report) ? fs.readFileSync(r.report, 'utf8') : '';
    const p = prompt(r, rep);
    const votes = [];
    for (let v = 0; v < SONNET_VOTES; v++) { try { votes.push(await sonnet(p)); } catch (e) { votes.push({ verdict: 'ERROR', raw: e.message, cost: 0 }); } }
    let g; try { g = await gemini(p); } catch (e) { g = { verdict: 'ERROR', raw: e.message, usage: {} }; }
    spent += votes.reduce((x, v) => x + (v.cost || 0), 0);
    const pass = votes.filter((v) => v.verdict === 'PASS').length;
    const line = { report: r.report, model: r.model, arm: r.arm, run: r.run, file_written: created(rep).length > 0, prompt_chars: p.length,
      sonnet: votes.map((v) => v.verdict), sonnet_majority: pass * 2 > SONNET_VOTES ? 'PASS' : 'FAIL', gemini: g.verdict,
      sonnet_cost_usd: +votes.reduce((s, v) => s + (v.cost || 0), 0).toFixed(4), gemini_usage: { in: g.usage.promptTokenCount || 0, out: (g.usage.candidatesTokenCount || 0) + (g.usage.thoughtsTokenCount || 0) },
      reasons: { sonnet: votes.map((v) => v.reason || v.raw), sonnet_reading: votes.map((v) => v.reading), gemini: g.reason || g.raw, gemini_reading: g.reading } };
    fs.appendFileSync(OUT, JSON.stringify(line) + '\n');
    console.log(`${next}/${todo.length} sonnet ${line.sonnet.join('')} gemini ${g.verdict} $${line.sonnet_cost_usd}`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
