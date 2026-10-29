// Post-hoc v1.1 corrections of final-1: per-run verdict columns, tables and task-clustered bootstrap.
//
//   node corrections.mjs IN.csv OUT.csv [TABLES.md]
// IN is reports/benchmark-final-runs.csv (frozen runs.csv columns plus regraded_correct and
// notrack_correct). It needs results/final-1/posthoc/ar-neutral-votes.jsonl (ar-neutral-judge.mjs).
// Every new column starts from the re-graded verdict (the no-seller-left banner fix):
//   compare_normalized_correct  compare-v1-v2 nothing-else-changed re-read with fixture artefacts
//                               normalized (compare-normalized.mjs); other rows = regraded_correct
//   ar_neutral_correct          accept-reject-ambiguous: a new .docx must exist, the file graders must
//                               pass, and the neutral judge (3 Sonnet votes, majority) must say PASS;
//                               the frozen `interpretation` grader is dropped; other rows = regraded
//   stetdoc_check_valid         1/0: stetdoc check finds no more findings Word would reject or repair
//                               than the input has, in every .docx written ('' when none was written)
//   stetdoc_validity_correct    regraded verdict with the validity rule swapped: the Open XML SDK
//                               graders (no-invalid-output, output-valid) dropped, stetdoc check required
//   corrected_correct           all corrections at once: re-grade, tracking not required on the two
//                               prompts that don't ask for it, compare normalized, accept-reject neutral,
//                               and stetdoc check as the validity rule
//   corrected_sdk_correct       the same, but keeping the Open XML SDK validity rule
import fs from 'fs'; import path from 'path';
import { load, esc, key, fails, blocks, created } from './lib.mjs';
import { compareNormalized } from './compare-normalized.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '../..');
const [IN, OUT, TABLES] = process.argv.slice(2);
const VOTES = process.env.VOTES || path.join(root, 'results/final-1/posthoc/ar-neutral-votes.jsonl');
const TRACK = { 'rename-seller-vendor': ['all-changes-tracked', 'author', 'only-the-rename'], 'redline-net60-new-york': ['all-changes-tracked', 'author', 'law-deleted', 'law-inserted', 'payment-deleted', 'payment-inserted', 'no-other-changes'] };
const SDK = ['no-invalid-output', 'output-valid'];
const AR_FILE = ['all-resolved', 'text-changes-accepted', 'no-invalid-output', 'original-unchanged'];

const [h, rows] = load(IN);
const votes = new Map(fs.readFileSync(VOTES, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((v) => [v.report, v]));
const rep = (r) => (r.report && fs.existsSync(r.report) ? fs.readFileSync(r.report, 'utf8') : '');
// The re-graded failure list: regrade.mjs only removed no-seller-left where the banner caused it.
// All 15 no-seller-left failures in final-1 are adeu rename runs, and the re-grade cleared every one.
const regradedFails = (r) => fails(r).filter((g) => !(g === 'no-seller-left' && r.case === 'rename-seller-vendor' && r.arm === 'adeu'));

for (const r of rows) {
  const t = rep(r);
  const base = regradedFails(r); const err = !!r.error;
  const ok = (f) => (!err && f.length === 0 ? '1' : '0');
  // validity, stetdoc check
  const bl = blocks(t); const vl = bl.map((b) => b.lines.find((l) => /^valid: (yes|no)$/.test(l)));
  r.stetdoc_check_valid = bl.length === 0 ? '' : vl.every((l) => l === 'valid: yes') ? '1' : '0';
  // compare normalized
  const cmpPass = r.case === 'compare-v1-v2' && t ? compareNormalized(t).pass : false;
  const dropCmp = (f) => (cmpPass ? f.filter((g) => g !== 'nothing-else-changed') : f);
  // accept-reject neutral
  let arFail = null; // null: not an AR row
  if (r.case === 'accept-reject-ambiguous') {
    const v = votes.get(r.report); if (!v) throw new Error('no neutral vote for ' + r.report);
    const wrote = created(t).length > 0;
    r.ar_neutral_sonnet = v.sonnet.join(' '); r.ar_neutral_gemini = v.gemini;
    arFail = (f) => { let x = f.filter((g) => g !== 'interpretation'); if (!wrote) x = x.concat(AR_FILE.filter((g) => !x.includes(g))); if (v.sonnet_majority !== 'PASS') x.push('neutral-reading'); return x; };
  }
  const dropTrack = (f) => (TRACK[r.case] ? f.filter((g) => !TRACK[r.case].includes(g)) : f);
  const stetValidity = (f) => { const x = f.filter((g) => !SDK.includes(g)); if (r.stetdoc_check_valid === '0') x.push('stetdoc-check'); return x; };
  const ar = (f) => (arFail ? arFail(f) : f);
  r.compare_normalized_correct = ok(dropCmp(base));
  r.ar_neutral_correct = ok(ar(base));
  r.stetdoc_validity_correct = ok(stetValidity(base));
  r.corrected_sdk_correct = ok(ar(dropCmp(dropTrack(base))));
  r.corrected_correct = ok(stetValidity(ar(dropCmp(dropTrack(base)))));
  r._newsdk = bl.flatMap((b) => b.lines.filter((l) => l.startsWith('ooxml-new: ')).map((l) => l.split(' ')[2]));
}
// sanity: our regraded failure list reproduces regraded_correct
for (const r of rows) { const f = regradedFails(r); if ((!r.error && f.length === 0 ? '1' : '0') !== r.regraded_correct) throw new Error('regrade mismatch ' + key(r) + ' ' + f.join(' ')); }

const NEW = ['compare_normalized_correct', 'ar_neutral_correct', 'ar_neutral_sonnet', 'ar_neutral_gemini', 'stetdoc_check_valid', 'stetdoc_validity_correct', 'corrected_sdk_correct', 'corrected_correct'];
const cols = [...h.filter((c) => !NEW.includes(c)), ...NEW];
fs.writeFileSync(OUT + '.tmp', [cols.join(',')].concat(rows.map((r) => cols.map((k) => esc(r[k])).join(','))).join('\n') + '\n');
fs.renameSync(OUT + '.tmp', OUT);

// ---------- tables ----------
const MODELS = ['claude-haiku-5-5', 'claude-opus-5-5', 'gemini-3.8-flash-medium'];
const ARMS = ['stetdoc', 'none', 'anthropic-docx', 'anthropic-legal', 'adeu'];
const short = (r) => r.kind === 'short' && r.case !== 'not-installed';
const wilson = (k, n) => { if (!n) return [0, 0]; const z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, w = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d; return [Math.round(100 * Math.max(0, c - w)), Math.round(100 * Math.min(1, c + w))]; };
const cell = (rs, col) => { const k = rs.filter((r) => r[col] === '1').length, n = rs.length; if (!n) return 'not run'; const [lo, hi] = wilson(k, n); return `${k}/${n} (${lo}–${hi})`; };
// mulberry32, seeded so the intervals are reproducible
let seed = 20261029; const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function boot(model, other, col, filter = () => true, B = 10000) {
  const rs = rows.filter((r) => r.model === model && short(r) && filter(r));
  const tasks = [...new Set(rs.filter((r) => r.arm === 'stetdoc').map((r) => r.case))].sort();
  const agg = (arm) => Object.fromEntries(tasks.map((t) => { const x = rs.filter((r) => r.arm === arm && r.case === t); return [t, [x.filter((r) => r[col] === '1').length, x.length]]; }));
  const S = agg('stetdoc'), O = agg(other);
  const diff = (ts) => { let sk = 0, sn = 0, ok = 0, on = 0; for (const t of ts) { sk += S[t][0]; sn += S[t][1]; ok += O[t][0]; on += O[t][1]; } return 100 * (sk / sn - ok / on); };
  const point = diff(tasks); const d = [];
  for (let b = 0; b < B; b++) { const ts = tasks.map(() => tasks[Math.floor(rnd() * tasks.length)]); d.push(diff(ts)); }
  d.sort((a, b) => a - b);
  return { point: Math.round(point), lo: Math.round(d[Math.floor(0.025 * B)]), hi: Math.round(d[Math.ceil(0.975 * B) - 1]), tasks: tasks.length };
}
const out = [];
const SCORINGS = [['fully_correct', 'frozen'], ['notrack_correct', 're-graded, no tracking'], ['corrected_sdk_correct', 'corrected, SDK validity'], ['corrected_correct', 'corrected, stetdoc-check validity']];
out.push('# final-1 v1.1 corrections: generated tables', '', `Generated by scripts/posthoc/corrections.mjs from ${path.basename(IN)} and ar-neutral-votes.jsonl. Wilson 95% intervals are descriptive only (runs are clustered by task).`, '');
out.push('## Short tasks, fully correct runs', '');
out.push('| model | arm | ' + SCORINGS.map((s) => s[1]).join(' | ') + ' | corrected, accept-reject dropped |', '|---|---|' + SCORINGS.map(() => '---|').join('') + '---|');
for (const m of MODELS) for (const a of ARMS) { const rs = rows.filter((r) => r.model === m && r.arm === a && short(r)); if (!rs.length) continue;
  out.push(`| ${m} | ${a} | ` + SCORINGS.map(([c]) => cell(rs, c)).join(' | ') + ' | ' + cell(rs.filter((r) => r.case !== 'accept-reject-ambiguous'), 'corrected_correct') + ' |'); }
out.push('', '## Single corrections (short tasks; each applied alone on top of the re-grade)', '', '| model | arm | re-graded | compare normalized | accept-reject neutral | stetdoc-check validity |', '|---|---|---|---|---|---|');
for (const m of MODELS) for (const a of ARMS) { const rs = rows.filter((r) => r.model === m && r.arm === a && short(r)); if (!rs.length) continue;
  out.push(`| ${m} | ${a} | ` + ['regraded_correct', 'compare_normalized_correct', 'ar_neutral_correct', 'stetdoc_validity_correct'].map((c) => cell(rs, c)).join(' | ') + ' |'); }
out.push('', '## Task-clustered bootstrap: stetdoc minus other arm, percentage points (short tasks)', '', 'Resamples whole tasks with replacement (10,000 draws, seed 20261029), recomputing each arm\'s pooled rate over the drawn tasks; 95% percentile interval. Point estimate is the observed difference.', '');
const BS = [['fully_correct', 'frozen'], ['notrack_correct', 'no tracking'], ['corrected_correct', 'corrected (stetdoc-check validity)'], ['corrected_sdk_correct', 'corrected (SDK validity)'], ['corrected_correct', 'corrected, no accept-reject', (r) => r.case !== 'accept-reject-ambiguous']];
out.push('| model | vs arm | ' + BS.map((b) => b[1]).join(' | ') + ' |', '|---|---|' + BS.map(() => '---|').join(''));
const bsjson = {};
for (const m of MODELS) for (const a of ARMS.slice(1)) { if (!rows.some((r) => r.model === m && r.arm === a)) continue;
  const cells = BS.map(([c, n, f]) => { const b = boot(m, a, c, f); (bsjson[m] ??= {})[a + ' / ' + n] = b; return `${b.point >= 0 ? '+' : ''}${b.point} [${b.lo}, ${b.hi}]`; });
  out.push(`| ${m} | ${a} | ` + cells.join(' | ') + ' |'); }
out.push('', '## Long tasks: validity rule side by side (fully correct of 6)', '', '| model | arm | Open XML SDK rule (frozen) | stetdoc check rule | runs failing only on SDK validity | new SDK error classes, runs with each (all runs failing the SDK rule) |', '|---|---|---|---|---|---|');
for (const m of MODELS) for (const a of ARMS) { const rs = rows.filter((r) => r.model === m && r.arm === a && r.kind === 'long'); if (!rs.length) continue;
  const sdkOnly = rs.filter((r) => r.regraded_correct === '0' && !r.error && fails(r).every((g) => SDK.includes(g)));
  const cls = {}; for (const r of rs.filter((x) => fails(x).some((g) => SDK.includes(g)))) for (const c of new Set(r._newsdk)) cls[c] = (cls[c] || 0) + 1;
  out.push(`| ${m} | ${a} | ${rs.filter((r) => r.regraded_correct === '1').length}/6 | ${rs.filter((r) => r.stetdoc_validity_correct === '1').length}/6 | ${sdkOnly.length} | ${Object.entries(cls).sort((x, y) => y[1] - x[1]).map(([c, n]) => `${c} ${n}`).join(', ') || '-'} |`); }
out.push('', '## Validity flags, all runs that wrote a .docx', '', '| model | arm | SDK new errors (ooxml-valid: no) | stetdoc check fails | SDK fails but stetdoc check passes |', '|---|---|---|---|---|');
for (const m of MODELS) for (const a of ARMS) { const rs = rows.filter((r) => r.model === m && r.arm === a && r.stetdoc_check_valid !== ''); if (!rs.length) continue;
  const sdkBad = (r) => /^ooxml-valid: no$/m.test(rep(r));
  out.push(`| ${m} | ${a} | ${rs.filter(sdkBad).length}/${rs.length} | ${rs.filter((r) => r.stetdoc_check_valid === '0').length} | ${rs.filter((r) => sdkBad(r) && r.stetdoc_check_valid === '1').length} |`); }
// SDK error classes over every run with new SDK errors
const allCls = {}; for (const r of rows) for (const c of new Set(r._newsdk)) allCls[c] = (allCls[c] || 0) + 1;
out.push('', 'New SDK error classes, counted once per run that has them: ' + Object.entries(allCls).sort((x, y) => y[1] - x[1]).map(([c, n]) => `${c} ${n}`).join(', '));
// judges
const V = [...votes.values()];
const agree = (f) => V.filter(f).length;
const unanimous = agree((v) => new Set(v.sonnet).size === 1);
const sg = agree((v) => v.sonnet_majority === v.gemini);
out.push('', '## accept-reject-ambiguous neutral re-judge', '', `Runs judged: ${V.length}. Sonnet 3 votes unanimous: ${unanimous}/${V.length}. Sonnet majority = Gemini (gemini-4-argon) verdict: ${sg}/${V.length}. Sonnet judge cost: $${V.reduce((s, v) => s + v.sonnet_cost_usd, 0).toFixed(2)}; Gemini tokens in/out: ${V.reduce((s, v) => s + v.gemini_usage.in, 0)}/${V.reduce((s, v) => s + v.gemini_usage.out, 0)}.`, '');
out.push('| model | arm | frozen interpretation pass | file written | neutral, Sonnet majority PASS | neutral, Gemini PASS | ar_neutral_correct |', '|---|---|---|---|---|---|---|');
for (const m of MODELS) for (const a of ARMS) { const rs = rows.filter((r) => r.model === m && r.arm === a && r.case === 'accept-reject-ambiguous'); if (!rs.length) continue; const vs = rs.map((r) => votes.get(r.report));
  out.push(`| ${m} | ${a} | ${rs.filter((r) => !fails(r).includes('interpretation')).length}/5 | ${vs.filter((v) => v.file_written).length}/5 | ${vs.filter((v) => v.sonnet_majority === 'PASS').length}/5 | ${vs.filter((v) => v.gemini === 'PASS').length}/5 | ${rs.filter((r) => r.ar_neutral_correct === '1').length}/5 |`); }
const R1 = path.join(path.dirname(VOTES), 'ar-neutral-votes-r1.jsonl');
if (fs.existsSync(R1)) {
  const V1 = new Map(fs.readFileSync(R1, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((v) => [v.report, v]));
  const v1 = [...V1.values()];
  out.push('', `Round 1 (superseded: the prompt cut each change to 170 characters; ar-neutral-rubric-r1.md): Sonnet unanimous ${v1.filter((v) => new Set(v.sonnet).size === 1).length}/${v1.length}, Sonnet majority = Gemini ${v1.filter((v) => v.sonnet_majority === v.gemini).length}/${v1.length}, Sonnet majority round 1 = round 2 ${v1.filter((v) => votes.get(v.report)?.sonnet_majority === v.sonnet_majority).length}/${v1.length}, Sonnet cost $${v1.reduce((s, v) => s + v.sonnet_cost_usd, 0).toFixed(2)}, Gemini tokens in/out ${v1.reduce((s, v) => s + v.gemini_usage.in, 0)}/${v1.reduce((s, v) => s + v.gemini_usage.out, 0)}.`, '', '| model | arm | round 1 Sonnet majority PASS | round 1 Gemini PASS |', '|---|---|---|---|');
  for (const m of MODELS) for (const a of ARMS) { const vs = v1.filter((v) => v.model === m && v.arm === a); if (!vs.length) continue; out.push(`| ${m} | ${a} | ${vs.filter((v) => v.sonnet_majority === 'PASS').length}/5 | ${vs.filter((v) => v.gemini === 'PASS').length}/5 |`); }
}
if (TABLES) fs.writeFileSync(TABLES, out.join('\n') + '\n');
fs.writeFileSync((TABLES || OUT) + '.bootstrap.json', JSON.stringify(bsjson, null, 1));
console.log(out.join('\n'));
