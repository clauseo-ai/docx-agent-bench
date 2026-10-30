#!/usr/bin/env node
// Validity: a written .docx is valid when it opens in Microsoft Word desktop with no error and no repair prompt.
//   node scripts/word-validity.mjs TAG triage   lists every .docx a run wrote (kept with KEEP_OUTPUTS=1) and triages it
//   node scripts/word-validity.mjs TAG word     opens the files that need Word, one by one (resumable)
//   node scripts/word-validity.mjs TAG batch DIR    copies those files (and the built test files) to DIR with a manifest
//   node scripts/word-validity.mjs TAG import V.tsv reads the verdicts for a batch opened elsewhere
//   node scripts/word-validity.mjs TAG apply    writes results/TAG/validity.tsv, one row per run
// Triage only decides which files Word must open; it is never a verdict. A file goes to Word when the Open XML SDK
// validator finds an error the edited input does not have (or cannot open it), or when stetdoc check finds more
// findings than the input had (the report's `ooxml-valid:`, `violations:` and `class-a findings:` lines). Files clean
// under both are counted valid, and a seeded random sample of SAMPLE (default 20) of them is opened in Word too; if any
// of the sample fails, every clean file is opened. Word verdicts go to results/TAG/word-verdicts.tsv (file, verdict,
// dialog, screenshot), screenshots to results/TAG/word-shots/. Needs WORD_CHECK (default ~/stetdoc-cc-test/word-check.sh).
import fs from 'fs'; import path from 'path'; import os from 'os'; import { execFileSync } from 'child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const [TAG, mode] = process.argv.slice(2);
if (!TAG || !['triage', 'word', 'batch', 'import', 'apply'].includes(mode)) { console.error('usage: word-validity.mjs TAG triage|word|batch DIR|import VERDICTS.tsv|apply'); process.exit(2); }
const R = path.join(root, 'results', TAG);
const TRIAGE = path.join(R, 'validity-triage.tsv'), VERD = path.join(R, 'word-verdicts.tsv'), OUT = path.join(R, 'validity.tsv');
const SHOTS = path.join(R, 'word-shots');
const SAMPLE = Number(process.env.SAMPLE || 20);
const WORD_CHECK = process.env.WORD_CHECK || path.join(os.homedir(), 'stetdoc-cc-test/word-check.sh');
const tsv = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t')) : []);
const dirs = (d) => (fs.existsSync(d) ? fs.readdirSync(d).filter((x) => fs.statSync(path.join(d, x)).isDirectory()) : []);

// Every (run, written .docx): from each report's "== ./path" blocks, with the kept copy under outputs/<case>-<id>/.
function runs() {
  const out = [];
  for (const model of dirs(R)) for (const arm of dirs(path.join(R, model))) for (const part of dirs(path.join(R, model, arm))) {
    const rep = path.join(R, model, arm, part, 'reports');
    if (!fs.existsSync(rep)) continue;
    for (const f of fs.readdirSync(rep).filter((x) => x.endsWith('.txt'))) {
      const m = f.match(/^(.*)-([a-z]-[A-Za-z0-9]+)\.txt$/); if (!m) continue;
      const [, kase, id] = m; const text = fs.readFileSync(path.join(rep, f), 'utf8');
      const files = [];
      for (const b of text.split(/\n(?=== )/).slice(1)) {
        const p = b.split('\n')[0].slice(3);
        const get = (re) => (b.match(re) || [])[1];
        const sdkBad = /^ooxml-valid: no$/m.test(b);
        const v = Number(get(/^violations: (-?\d+) \(inputs at most (\d+)\)$/m) ?? 0), vin = Number(get(/^violations: -?\d+ \(inputs at most (\d+)\)$/m) ?? 0);
        const a = Number(get(/^class-a findings: (\d+) \(base at most \d+\)$/m) ?? 0), ain = Number(get(/^class-a findings: \d+ \(base at most (\d+)\)$/m) ?? 0);
        const stetBad = v < 0 || v > vin || a > ain;
        const kept = path.join(R, model, arm, part, 'outputs', `${kase}-${id}`, p);
        files.push({ p, kept, sdkBad, stetBad });
      }
      out.push({ model, arm, part, kase, id, files });
    }
  }
  return out;
}
const fileKey = (r, f) => [r.model, r.arm, r.part, r.kase, r.id, f.p].join('|');

if (mode === 'triage') {
  const rs = runs(); const rows = []; let missing = 0;
  for (const r of rs) for (const f of r.files) {
    const exists = fs.existsSync(f.kept); if (!exists) missing++;
    rows.push([fileKey(r, f), f.kept, exists ? 'kept' : 'missing', f.sdkBad ? 'sdk-new-error' : 'sdk-clean', f.stetBad ? 'stetdoc-new-finding' : 'stetdoc-clean',
      f.sdkBad || f.stetBad ? 'word' : 'clean']);
  }
  // Seeded sample of the clean files (mulberry32, seed 20261030), marked "sample". A sample drawn by an earlier triage of
  // this tag is kept as it was (runs added later, e.g. re-runs, do not redraw it).
  const prevSample = new Set(tsv(TRIAGE).filter((x) => x[5] === 'sample').map((x) => x[0]));
  let seed = 20261030; const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const clean = rows.filter((x) => x[5] === 'clean' && x[2] === 'kept');
  if (prevSample.size) { for (const x of clean) if (prevSample.has(x[0])) x[5] = 'sample'; }
  else {
    for (let i = clean.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [clean[i], clean[j]] = [clean[j], clean[i]]; }
    for (const x of clean.slice(0, SAMPLE)) x[5] = 'sample';
  }
  fs.writeFileSync(TRIAGE, ['key\tkept\tstatus\tsdk\tstetdoc\tword'].concat(rows.map((x) => x.join('\t'))).join('\n') + '\n');
  const n = (k) => rows.filter((x) => x[5] === k).length;
  console.log(`${rs.length} runs, ${rows.length} written .docx (${missing} not kept): ${n('word')} to Word by triage, ${n('sample')} clean in the Word sample, ${n('clean')} clean not opened. ${TRIAGE}`);
}

if (mode === 'word') {
  const t = tsv(TRIAGE).slice(1); const done = new Set(tsv(VERD).map((x) => x[0]));
  // If a sampled clean file failed in Word, every clean file goes to Word.
  const sampleFailed = tsv(VERD).some((x) => t.find((y) => y[0] === x[0] && y[5] === 'sample') && x[1] !== 'CLEAN');
  const todo = t.filter((x) => x[2] === 'kept' && (x[5] === 'word' || x[5] === 'sample' || (sampleFailed && x[5] === 'clean')) && !done.has(x[0]));
  fs.mkdirSync(SHOTS, { recursive: true });
  if (!fs.existsSync(VERD)) fs.writeFileSync(VERD, '');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'word-validity-'));
  let i = 0;
  if (!process.env.CUA_SESSION) process.env.CUA_SESSION = `word-validity-${process.pid}`;
  for (const x of todo) {
    i++;
    const name = x[0].replace(/\|\.\//, '|').replace(/[|/]+/g, '__').replace(/[^A-Za-z0-9._-]/g, '_');
    const copy = path.join(tmp, name.endsWith('.docx') ? name : name + '.docx'); fs.copyFileSync(x[1], copy);
    let line = '';
    try { line = execFileSync(WORD_CHECK, [copy, SHOTS], { encoding: 'utf8', timeout: 300000 }).trim().split('\n').pop(); } catch (e) { line = `${copy}\tERROR_DRIVER\t${String(e.message).split('\n')[0]}`; }
    const [, verdict = 'ERROR_DRIVER', dialog = ''] = line.split('\t');
    const shot = path.join(SHOTS, path.basename(copy).replace(/\.docx$/, '.png'));
    fs.rmSync(copy, { force: true });
    // Only Word's own reaction is a verdict: CLEAN, REPAIR_PROMPT or ERROR. A driver failure, a timeout or an unrelated
    // dialog is logged for a retry or a manual look and not recorded.
    if (!['CLEAN', 'REPAIR_PROMPT', 'ERROR'].includes(verdict)) { fs.appendFileSync(VERD.replace(/\.tsv$/, '.retry.log'), line + '\n'); console.log(`${i}/${todo.length} ${verdict} (not a verdict, retry) ${x[0]}`); continue; }
    fs.appendFileSync(VERD, [x[0], verdict, dialog.replace(/[\t\n]/g, ' '), fs.existsSync(shot) ? path.relative(R, shot) : ''].join('\t') + '\n');
    console.log(`${i}/${todo.length} ${verdict} ${x[0]}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  if (!sampleFailed && tsv(VERD).some((x) => t.find((y) => y[0] === x[0] && y[5] === 'sample') && x[1] !== 'CLEAN')) console.log('a sampled clean file failed in Word: run `word` again to open every clean file');
}

// batch DIR: copies every file Word must open (the same list as `word`) into DIR, flat, with DIR/manifest.tsv
// (copy name, key). The test files scripts/build-fixtures.py makes (built: rows) go in too, keyed fixture|NAME.
// The copies can then be opened elsewhere (another machine or a VM); `import` reads the verdicts back.
if (mode === 'batch') {
  const dir = path.resolve(process.argv[4] || ''); if (!process.argv[4]) { console.error('usage: word-validity.mjs TAG batch DIR'); process.exit(2); }
  const t = tsv(TRIAGE).slice(1); const done = new Set(tsv(VERD).map((x) => x[0]));
  const sampleFailed = tsv(VERD).some((x) => t.find((y) => y[0] === x[0] && y[5] === 'sample') && x[1] !== 'CLEAN');
  const todo = t.filter((x) => x[2] === 'kept' && (x[5] === 'word' || x[5] === 'sample' || (sampleFailed && x[5] === 'clean')) && !done.has(x[0])).map((x) => [x[0], x[1]]);
  const ev = path.join(root, 'suite/evals');
  for (const l of tsv(path.join(ev, 'fixtures.tsv'))) if (l[2]?.startsWith('built:')) todo.push([`fixture|${l[0]}.docx`, path.join(ev, 'fixtures', `${l[0]}.docx`)]);
  for (const l of tsv(path.join(ev, 'long-fixtures.tsv'))) if (l[3]?.startsWith('built:')) todo.push([`fixture|${l[0]}/${l[1]}`, path.join(ev, 'long-fixtures', l[0], l[1])]);
  fs.mkdirSync(dir, { recursive: true });
  const man = [];
  for (const [k, src] of todo) {
    let name = k.replace(/\|\.\//, '|').replace(/[|/]+/g, '__').replace(/[^A-Za-z0-9._-]/g, '_'); if (!name.endsWith('.docx')) name += '.docx';
    fs.copyFileSync(src, path.join(dir, name)); man.push([name, k].join('\t'));
  }
  fs.writeFileSync(path.join(dir, 'manifest.tsv'), man.join('\n') + '\n');
  console.log(`${man.length} files (${man.filter((m) => m.includes('\tfixture|')).length} test files) copied to ${dir}`);
}

// import FILE.tsv: Word verdicts from a batch (word-check-vm.sh's results.tsv, or FILE, VERDICT, DIALOG[, SCREENSHOT]; FILE
// matched by its name against the batch's manifest.tsv beside it, or MANIFEST; screenshots copied to word-shots/).
// Run files go to word-verdicts.tsv, test files to word-fixtures.tsv.
if (mode === 'import') {
  const f = process.argv[4]; if (!f) { console.error('usage: word-validity.mjs TAG import VERDICTS.tsv [MANIFEST]'); process.exit(2); }
  const man = new Map(tsv(process.argv[5] || path.join(path.dirname(path.resolve(f)), 'manifest.tsv')).map((x) => [x[0], x[1]]));
  const FIX = path.join(R, 'word-fixtures.tsv'); const done = new Set([...tsv(VERD), ...tsv(FIX)].map((x) => x[0]));
  let n = 0, skipped = 0;
  for (const row of tsv(f)) {
    // word-check-vm.sh rows are FILE, SHA256, VERDICT, SCREENSHOT, SECONDS, DIALOG; word-check.sh rows FILE, VERDICT, DIALOG.
    const vm = /^[0-9a-f]{64}$/.test(row[1] || '');
    const [file, verdict, dialog = '', shot0 = ''] = vm ? [row[0], row[2], row[5], row[3]] : row;
    const k = man.get(path.basename(file || ''));
    if (!k || !['CLEAN', 'REPAIR_PROMPT', 'ERROR'].includes(verdict)) { skipped++; if (k) fs.appendFileSync(VERD.replace(/\.tsv$/, '.retry.log'), [file, verdict, dialog].join('\t') + '\n'); continue; }
    if (done.has(k)) continue;
    let shot = shot0;
    if (shot0 && fs.existsSync(shot0)) { fs.mkdirSync(SHOTS, { recursive: true }); shot = path.join(SHOTS, path.basename(file).replace(/\.docx$/, '') + path.extname(shot0)); fs.copyFileSync(shot0, shot); shot = path.relative(R, shot); }
    fs.appendFileSync(k.startsWith('fixture|') ? FIX : VERD, [k, verdict, dialog.replace(/[\t\n]/g, ' '), shot].join('\t') + '\n'); done.add(k); n++;
  }
  console.log(`${n} verdicts imported, ${skipped} lines not a verdict or not in the manifest`);
}

if (mode === 'apply') {
  const t = new Map(tsv(TRIAGE).slice(1).map((x) => [x[0], x])); const w = new Map(tsv(VERD).map((x) => [x[0], x]));
  const sampleFailed = [...w.values()].some((x) => t.get(x[0])?.[5] === 'sample' && x[1] !== 'CLEAN');
  const rows = [['model', 'arm', 'part', 'case', 'id', 'docx_written', 'opened_in_word', 'word_failures', 'valid', 'note'].join('\t')];
  let pending = 0;
  for (const r of runs()) {
    let valid = r.files.length ? 'yes' : '', opened = 0; const fails = []; const notes = [];
    for (const f of r.files) {
      const k = fileKey(r, f), tr = t.get(k), v = w.get(k);
      if (!tr) { valid = 'pending'; notes.push('not triaged'); continue; }
      if (tr[2] !== 'kept') { valid = 'no'; notes.push(`${f.p} not kept`); continue; }
      const needsWord = tr[5] === 'word' || tr[5] === 'sample' || sampleFailed;
      if (v) { opened++; if (v[1] !== 'CLEAN') { fails.push(`${f.p}: ${v[1]}`); valid = 'no'; } }
      else if (needsWord) { if (valid !== 'no') valid = 'pending'; notes.push(`${f.p} awaits Word`); }
    }
    if (valid === 'pending') pending++;
    rows.push([r.model, r.arm, r.part, r.kase, r.id, r.files.length, opened, fails.join('; '), valid, notes.join('; ')].join('\t'));
  }
  fs.writeFileSync(OUT, rows.join('\n') + '\n');
  console.log(`${rows.length - 1} runs; pending ${pending}; ${OUT}`);
}
