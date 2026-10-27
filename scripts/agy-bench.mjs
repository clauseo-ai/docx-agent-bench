#!/usr/bin/env node
// Runs one arm, one part of the suite headless with Antigravity CLI (agy), the Gemini counterpart of bench.sh.
//   node scripts/agy-bench.mjs ARM PART OUT [--runs N] [-j N] [--case NAME]...
// ARM: stetdoc | none (others: see installArm). PART: short | long | without-stetdoc (stale needs a resumed
// conversation, which agy print mode cannot seed, so it is not run).
// Each run gets its own root R with HOME=R/home and the workspace R/home/cwd, the same layout as `claude plugin eval`:
// the arm is installed into the workspace, the case's scaffold.sh copies the fixtures and snapshots them, agy runs,
// and then the harness's report.sh (the Claude Code Stop hook, here called directly) writes .eval-report.txt.
// agy's stream-json is converted to a Claude-style transcript (tool names Bash/Read/Write/Edit/Grep/Glob), so
// report.sh's metrics, the case graders (regex, tool_used, llm) and verify.mjs / analyze.mjs work unchanged.
// Output, like bench.sh: OUT/eval/aggregate-result.json, OUT/metrics.jsonl, OUT/reports/<case>-<id>.{txt,transcript.jsonl,agy.jsonl}.
// Env: AGY (default ~/.local/bin/agy), AGY_MODEL (gemini-3.8-flash-medium), GOOGLE_GEMINI_BASE_URL (http://127.0.0.1:6969),
// GEMINI_API_KEY (dummy), STETDOC_BIN, OOXML_VALIDATE, ARMS (/tmp/bench-arms), TOOLS (/tmp/bench-tools),
// JUDGE (claude-sonnet-5-5; JUDGE=0 skips llm graders), KEEP=1 keeps the run roots.
import fs from 'fs'; import path from 'path'; import os from 'os'; import { spawn, execFileSync } from 'child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const argv = process.argv.slice(2);
const [arm, part, outArg] = argv;
if (!arm || !part || !outArg) { console.error('usage: agy-bench.mjs ARM PART OUT [--runs N] [-j N] [--case NAME]'); process.exit(2); }
let RUNS = 1, J = 3; const only = [];
for (let i = 3; i < argv.length; i++) {
  if (argv[i] === '--runs') RUNS = Number(argv[++i]); else if (argv[i] === '-j') J = Number(argv[++i]);
  else if (argv[i] === '--case') only.push(argv[++i]); else { console.error(`unknown option ${argv[i]}`); process.exit(2); }
}
const out = path.resolve(outArg);
const HOME0 = os.homedir();
const AGY = process.env.AGY || path.join(HOME0, '.local/bin/agy');
const MODEL = process.env.AGY_MODEL || 'gemini-3.8-flash-medium';
const ARMS = process.env.ARMS || '/tmp/bench-arms', TOOLS = process.env.TOOLS || '/tmp/bench-tools';
const JUDGE = process.env.JUDGE ?? 'claude-sonnet-5-5';
const which = (c) => { try { return execFileSync('bash', ['-c', `command -v ${c}`], { encoding: 'utf8' }).trim(); } catch { return ''; } };
const STETDOC = process.env.STETDOC_BIN || which('stetdoc');
const OOXML = process.env.OOXML_VALIDATE || which('ooxml-validate');
if (!STETDOC) { console.error('stetdoc not found (STETDOC_BIN): the report needs it for every arm'); process.exit(2); }
if (!OOXML) console.error('warning: no ooxml-validate (set OOXML_VALIDATE); the primary validity check will be unavailable');
const settings = path.join(HOME0, '.gemini/antigravity-cli/settings.json');
if (!fs.existsSync(settings)) { console.error(`no ${settings}: write {"modelProvider":"gemini"} there (see README)`); process.exit(2); }
const partDir = { short: 'cases', long: 'long', 'without-stetdoc': 'without-stetdoc' }[part];
if (!partDir) { console.error(`part ${part}: short, long or without-stetdoc (stale is not supported)`); process.exit(2); }

// A private copy of the suite, as bench.sh makes, with the files the scaffold and report.sh read.
const suite = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-suite-'));
fs.cpSync(path.join(root, 'suite/evals'), path.join(suite, 'evals'), { recursive: true });
const E = path.join(suite, 'evals');
fs.writeFileSync(path.join(E, 'arm-name'), arm + '\n');
fs.writeFileSync(path.join(E, 'stetdoc-bin'), STETDOC + '\n');
fs.writeFileSync(path.join(E, 'ooxml-validate-bin'), OOXML + '\n');
process.on('exit', () => fs.rmSync(suite, { recursive: true, force: true }));

// The agent's PATH: the shared tools, stetdoc only in the stetdoc arm (never in without-stetdoc), and every
// other directory that does not hold a stetdoc command. As in bench.sh.
const clean = (process.env.PATH || '').split(':').filter((d) => d && !fs.existsSync(path.join(d, 'stetdoc')));
const withStetdoc = arm === 'stetdoc' && part !== 'without-stetdoc';
const agentPath = [`${TOOLS}/venv/bin`, `${TOOLS}/bin`, ...(withStetdoc ? [path.dirname(STETDOC)] : []), ...clean].join(':');

// Arms for Antigravity. Each installs into the run's workspace (cwd) with HOME set to the run's home.
function installArm(cwd, env) {
  if (arm === 'none') return;
  if (arm === 'stetdoc') { execFileSync(STETDOC, ['init', '--project', '--agent', 'antigravity'], { cwd, env, stdio: 'pipe' }); return; }
  if (arm === 'anthropic-docx') { // hook, untested: the docx skill as a workspace skill
    fs.cpSync(path.join(ARMS, 'anthropic-docx/skills/docx'), path.join(cwd, '.agents/skills/docx'), { recursive: true }); return; }
  // anthropic-legal (skills plus commands) and adeu (an MCP server: `agy mcp add` into the run's home) are not wired yet.
  throw new Error(`arm ${arm} has no Antigravity install yet (see installArm in scripts/agy-bench.mjs)`);
}

// --- minimal front-matter reader for the case and grader files (flat keys, single-quoted strings, [lists], {maps}).
function frontMatter(file) {
  const t = fs.readFileSync(file, 'utf8'); const m = t.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: t };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const k = line.match(/^([A-Za-z_]+):\s*(.*)$/); if (!k) continue;
    meta[k[1]] = scalar(k[2].trim());
  }
  return { meta, body: m[2].trim() };
}
function scalar(v) {
  if (v.startsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  if (v.startsWith('"')) return JSON.parse(v);
  if (v.startsWith('[')) return v.slice(1, -1).split(',').map((s) => scalar(s.trim())).filter((s) => s !== '');
  if (v.startsWith('{')) return Object.fromEntries(v.slice(1, -1).split(',').map((s) => s.split(':').map((x) => x.trim())).map(([a, b]) => [a, scalar(b)]));
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

// --- stream-json → Claude-style transcript and metrics.
const TOOL = { run_command: 'Bash', view_file: 'Read', read_file: 'Read', write_to_file: 'Write', replace_file_content: 'Edit',
  multi_replace_file_content: 'Edit', grep_search: 'Grep', find_by_name: 'Glob', list_dir: 'Glob' };
function fileParam(p) { for (const [k, v] of Object.entries(p || {})) if (typeof v === 'string' && /path|file/i.test(k)) return v; return undefined; }
function convert(lines) {
  const ev = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const tr = [], calls = [], errors = []; let turns = 0, model = MODEL, result = null, step = 0;
  const usage = { input_tokens: 0, output_tokens: 0, thinking_tokens: 0, cache_read_tokens: 0 };
  for (const e of ev) {
    if (e.event === 'init') model = e.init?.model || model;
    if (e.event === 'result') result = e.result;
    const s = e.step_update; if (!s || s.state === 'ACTIVE') continue;
    if (s.step_type === 'agent_response') {
      turns++; const u = s.usage || {};
      for (const k of Object.keys(usage)) usage[k] += u[k] || 0;
      tr.push({ type: 'assistant', message: { id: `agy_${s.step_index}`, model, role: 'assistant', content: [],
        usage: { input_tokens: u.input_tokens || 0, cache_read_input_tokens: u.cache_read_tokens || 0, cache_creation_input_tokens: 0, output_tokens: u.output_tokens || 0 } } });
    } else if (s.step_type === 'tool') {
      const ti = s.tool_info || {}; const name = TOOL[ti.name] || ti.name || s.tool_name; const p = ti.parameters || {};
      const input = name === 'Bash' ? { command: p.CommandLine ?? p.command ?? '', ...p } : (fileParam(p) ? { file_path: fileParam(p), ...p } : { ...p });
      const output = typeof ti.output === 'string' ? ti.output : JSON.stringify(ti.output ?? ti.error ?? '');
      const code = output.match(/^Command exited with code (-?\d+)/);
      const isError = s.state !== 'DONE' || !!ti.error || (code ? code[1] !== '0' : false);
      const id = `agy_tool_${++step}`;
      const use = { type: 'tool_use', id, name, input, agy_tool: ti.name };
      calls.push(use);
      tr.push({ type: 'assistant', message: { id: `agy_toolcall_${s.step_index}`, model, role: 'assistant', content: [use] } });
      tr.push({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, is_error: isError, content: output.slice(0, 20000) }] } });
      if (isError) errors.push({ tool: ti.name, input: input.command || input.file_path || JSON.stringify(p), output: output.slice(0, 400) });
    }
  }
  const reply = result?.response || '';
  tr.push({ type: 'assistant', message: { id: 'agy_final', model, role: 'assistant', content: [{ type: 'text', text: reply }] } });
  return { tr, calls, errors, turns, usage, result, reply, model };
}

// --- graders.
function grade(caseDir, runRoot, trace, info) {
  const gdir = path.join(caseDir, 'graders'); const res = [];
  const report = fs.existsSync(path.join(runRoot, 'home/cwd/.eval-report.txt')) ? fs.readFileSync(path.join(runRoot, 'home/cwd/.eval-report.txt'), 'utf8') : '';
  for (const f of fs.readdirSync(gdir).filter((x) => x.endsWith('.md')).sort()) {
    const name = f.replace(/\.md$/, ''); const { meta, body } = frontMatter(path.join(gdir, f));
    let passed = false, evidence;
    try {
      if (meta.type === 'regex') {
        const text = meta.target === 'trace' ? trace : (meta.target?.source === 'file' ? (meta.target.path === '.eval-report.txt' ? report : (fs.existsSync(path.join(runRoot, 'home/cwd', meta.target.path)) ? fs.readFileSync(path.join(runRoot, 'home/cwd', meta.target.path), 'utf8') : '')) : trace);
        const flags = String(meta.flags || '').replace(/[^imsu]/g, '');
        const n = (text.match(new RegExp(meta.pattern, flags + 'g')) || []).length;
        const mt = String(meta.match || 'contains');
        passed = mt === 'not_contains' ? n === 0 : mt.startsWith('count:') ? n === Number(mt.slice(6)) : n > 0;
      } else if (meta.type === 'tool_used') {
        const re = meta.input_match ? new RegExp(meta.input_match) : null;
        const n = info.calls.filter((c) => c.name === meta.tool && (!re || re.test(c.name === 'Bash' ? c.input.command : (c.input.file_path || JSON.stringify(c.input))))).length;
        passed = n >= (meta.min ?? 1) && (meta.max === undefined || n <= meta.max);
      } else if (meta.type === 'llm') {
        if (JUDGE === '0') { res.push({ name, passed: false, skipped: true, evidence: 'llm grader skipped (JUDGE=0)' }); continue; }
        const prompt = `You grade an AI agent's final reply to a user against a rubric. Answer with one line: PASS or FAIL, then a colon and one sentence of reason.\n\nRUBRIC:\n${body}\n\nTHE AGENT'S FINAL REPLY:\n${info.reply}`;
        const o = execFileSync('claude', ['-p', '--model', JUDGE, '--output-format', 'json', '--max-turns', '1'], { input: prompt, encoding: 'utf8', cwd: os.tmpdir(), timeout: 180000 });
        const j = JSON.parse(o); evidence = String(j.result || '').trim(); passed = /^\W*PASS\b/i.test(evidence);
        info.judgeCost = (info.judgeCost || 0) + (j.total_cost_usd || 0);
      } else { evidence = `unknown grader type ${meta.type}`; }
    } catch (err) { evidence = `grader error: ${String(err.message || err).slice(0, 300)}`; passed = false; }
    res.push({ name, passed, ...(evidence ? { evidence } : {}) });
  }
  return res;
}

// --- one run.
function sh(cmd, args, opts) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, opts); let so = '', se = '';
    p.stdout?.on('data', (d) => { so += d; }); p.stderr?.on('data', (d) => { se += d; });
    if (opts.input !== undefined) { p.stdin.end(opts.input); }
    p.on('close', (code) => resolve({ code, stdout: so, stderr: se }));
  });
}
async function runOne(c, n) {
  const caseDir = path.join(E, partDir, c);
  const R = fs.mkdtempSync(path.join(os.tmpdir(), 'a-')); const id = path.basename(R);
  const home = path.join(R, 'home'), cwd = path.join(home, 'cwd'); fs.mkdirSync(cwd, { recursive: true });
  fs.mkdirSync(path.join(home, '.gemini/antigravity-cli'), { recursive: true });
  fs.copyFileSync(settings, path.join(home, '.gemini/antigravity-cli/settings.json'));
  // The agent's environment: no benchmark variables (the validator path, the metrics file), so it cannot use them.
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(EVAL_|OOXML_|STETDOC_|CLAUDE|ANTHROPIC_|KEEP$|JUDGE$|AGY)/.test(k)));
  const agentEnv = { ...inherited, HOME: home, PATH: agentPath, GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'dummy',
    GOOGLE_GEMINI_BASE_URL: process.env.GOOGLE_GEMINI_BASE_URL || 'http://127.0.0.1:6969' };
  // The harness's environment (scaffold and report.sh) adds what they read.
  const baseEnv = { ...agentEnv, EVAL_STETDOC_BIN: STETDOC, EVAL_OOXML_VALIDATE: OOXML, EVAL_STETDOC_METRICS: path.join(out, 'metrics.jsonl'), CLAUDE_PROJECT_DIR: cwd };
  const meta = frontMatter(path.join(caseDir, 'prompt.md'));
  let error;
  try { installArm(cwd, agentEnv); } catch (e) { error = `arm install: ${e.message}`; }
  const sc = await sh('bash', [path.join(caseDir, 'scaffold.sh')], { cwd, env: { ...baseEnv, PATH: process.env.PATH } });
  if (sc.code !== 0) error = `scaffold failed: ${sc.stderr.slice(0, 300)}`;
  // agy's log goes straight to the results, outside the run root the agent can list.
  const keep = path.join(out, 'reports'); fs.mkdirSync(keep, { recursive: true });
  const logFile = path.join(keep, `${c}-${id}.agy.log`);
  const t0 = Date.now(); let lines = [];
  if (!error) {
    const timeout = meta.meta.timeout_seconds || 600;
    const r = await sh(AGY, ['-p', meta.body, '--model', MODEL, '--dangerously-skip-permissions', '--output-format', 'stream-json',
      '--print-timeout', `${timeout}s`, '--log-file', logFile], { cwd, env: agentEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    lines = r.stdout.split('\n').filter(Boolean);
    if (r.code !== 0) error = `agy exit ${r.code}: ${r.stderr.trim().slice(-300)}`;
  }
  const wall = Math.round((Date.now() - t0) / 1000);
  const info = convert(lines);
  if (!error && info.result && info.result.status !== 'SUCCESS') error = `agy status ${info.result.status}`;
  if (!error && !info.result) error = 'agy wrote no result event';
  // agy reports a print timeout as SUCCESS with an empty response; its log says so.
  const agyLog = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
  if (!error && /print timeout after/.test(agyLog)) error = `timed out after ${meta.meta.timeout_seconds || 600}s (agy print timeout)`;
  const transcript = path.join(R, 'transcript.jsonl'); const traceText = info.tr.map((x) => JSON.stringify(x)).join('\n') + '\n';
  fs.writeFileSync(transcript, traceText);
  // The harness report, exactly as the Stop hook runs it (stdin carries the transcript path).
  await sh('bash', [path.join(E, 'harness/report.sh')], { cwd, env: baseEnv, input: JSON.stringify({ transcript_path: transcript }) });
  fs.writeFileSync(path.join(keep, `${c}-${id}.agy.jsonl`), lines.join('\n') + '\n');
  const graders = grade(caseDir, R, traceText, info);
  const notAcc = (g) => g.startsWith('process-') || g.startsWith('secondary-') || g === 'precondition' || g.startsWith('rubric-');
  const acc = graders.filter((g) => !notAcc(g.name));
  const run = { tracePath: path.join(R, 'out', 'trace.jsonl'), runId: id, graders, turns: info.turns, toolCalls: info.calls.length,
    toolErrors: info.errors, usage: info.usage, model: info.model, conversationId: info.result?.conversation_id,
    durationSeconds: info.result?.duration_seconds ? Math.round(info.result.duration_seconds) : wall, wallSeconds: wall,
    costUsd: 0, judgeCostUsd: info.judgeCost || 0, score: acc.length ? acc.filter((g) => g.passed).length / acc.length : 0, reply: info.reply, ...(error ? { error } : {}) };
  console.log(`  ${c} run ${n}: accuracy ${acc.filter((g) => g.passed).length}/${acc.length}${acc.every((g) => g.passed) && !error ? ' (pass)' : ''}  turns ${info.turns}  tools ${info.calls.length}  errors ${info.errors.length}  ${run.durationSeconds}s${error ? '  ERROR ' + error : ''}`);
  if (!process.env.KEEP) fs.rmSync(R, { recursive: true, force: true });
  return run;
}

// --- the part: every case (or --case), RUNS runs each, J at a time.
const cases = fs.readdirSync(path.join(E, partDir)).filter((c) => fs.existsSync(path.join(E, partDir, c, 'prompt.md')))
  .filter((c) => !only.length || only.includes(c)).filter((c) => !(part === 'short' && c === 'stale-colleague-edit' && !only.includes(c)));
if (cases.includes('stale-colleague-edit')) { console.error('stale-colleague-edit needs a seeded conversation; not supported with agy'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
console.log(`agy ${MODEL}, arm ${arm}, part ${part}: ${cases.length} cases x ${RUNS} runs, ${J} at a time`);
const jobs = cases.flatMap((c) => Array.from({ length: RUNS }, (_, i) => ({ c, n: i + 1 })));
const results = {}; let next = 0;
await Promise.all(Array.from({ length: Math.min(J, jobs.length) }, async () => {
  while (next < jobs.length) { const j = jobs[next++]; (results[j.c] ||= [])[j.n - 1] = await runOne(j.c, j.n); }
}));
const agg = { runner: 'agy', model: MODEL, arm, part, cases: cases.map((c) => ({ name: c, arms: { with: results[c] || [] } })) };
fs.mkdirSync(path.join(out, 'eval'), { recursive: true });
fs.writeFileSync(path.join(out, 'eval', 'aggregate-result.json'), JSON.stringify(agg, null, 1));
console.log(`wrote ${path.join(out, 'eval', 'aggregate-result.json')}`);
