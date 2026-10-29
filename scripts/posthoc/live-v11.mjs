// Adds the v1.1 verdict columns to the live page CSV, atomically, after a one-time backup.
//   node live-v11.mjs CORRECTED.csv LIVE.csv
// CORRECTED is corrections.mjs's output; rows are joined on model, arm, kind, case, run.
import fs from 'fs';
import { load, esc, key } from './lib.mjs';
const [CORR, LIVE] = process.argv.slice(2);
const ADD = ['compare_normalized_correct', 'ar_neutral_correct', 'stetdoc_check_valid', 'stetdoc_validity_correct', 'corrected_sdk_correct', 'corrected_correct'];
const [, corr] = load(CORR); const by = new Map(corr.map((r) => [key(r), r]));
const [h, live] = load(LIVE);
const bak = LIVE.replace(/\.csv$/, '.pre-v1.1.csv');
if (!fs.existsSync(bak)) fs.copyFileSync(fs.realpathSync(LIVE), bak);
const cols = [...h.filter((c) => !ADD.includes(c)), ...ADD];
let n = 0;
const body = live.map((r) => { const c = by.get(key(r)); if (!c) throw new Error('no corrected row for ' + key(r)); n++; for (const k of ADD) r[k] = c[k]; return cols.map((k) => esc(r[k])).join(','); });
if (n !== corr.length) throw new Error(`row count differs: live ${n}, corrected ${corr.length}`);
fs.writeFileSync(LIVE + '.tmp', [cols.join(',')].concat(body).join('\n') + '\n');
fs.renameSync(LIVE + '.tmp', LIVE);
console.log('updated', n, 'rows; backup', bak);
