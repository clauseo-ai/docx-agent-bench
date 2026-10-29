// Post-hoc re-grade of compare-v1-v2 / nothing-else-changed (v1.1 correction 1).
//
// The fixture isda-confirmation-v2.docx (Harvey LAB, greenleaf-marked-confirmation.docx) carries
// typed-in markup as literal text: "### " heading markers (4), "[DELETED: ...]" and "[ADDED: ...]"
// (4 each) and "<!-- indent:1 -->" / "<!-- /indent -->" (4). The frozen grader demands the redline,
// read as final, equal v2 exactly, so an agent that cleaned that markup up fails.
//
// This grader re-reads the saved text-diff lines (< = expected v2, > = the agent's file read as final)
// and applies the same normalization to both sides, for every arm alike:
//   - drop "#" heading markers and the indent comments, collapse whitespace, drop empty lines;
//   - drop stetdoc view's {style "..."} paragraph-style marker (a reader artefact: an agent that turned
//     "### " into a real heading style shows as {style "heading 3"});
//   - for the [DELETED: x] [ADDED: y] markers, accept either reading:
//       A: the markers are instructions (x removed, y kept), or
//       B: the markers are noise (both x and y kept, the brackets dropped).
// A written .docx passes when, under A or B, both sides are equal. A run passes when every written
// .docx passes. The frozen verdict is kept beside it.
//
//   node compare-normalized.mjs RUNS.csv          prints one line per compare-v1-v2 run
import fs from 'fs';
import { load, blocks, fails } from './lib.mjs';

// Remove "[TAG: ...]" spans with bracket matching; keep the content when keep is true.
function markers(s, keep) {
  for (const tag of ['[DELETED: ', '[ADDED: ']) {
    let i;
    while ((i = s.indexOf(tag)) >= 0) {
      let d = 0, j = i;
      for (; j < s.length; j++) { if (s[j] === '[') d++; else if (s[j] === ']') { d--; if (d === 0) break; } }
      const inner = s.slice(i + tag.length, j);
      const keepIt = keep || tag === '[ADDED: ';
      s = s.slice(0, i) + (keepIt ? inner : '') + s.slice(j + 1);
    }
  }
  return s;
}
export function norm(lines, keep) {
  let s = lines.join('\n');
  s = markers(s, keep);
  s = s.replace(/<!-- ?\/?indent(:\d+)? ?-->/g, '');
  return s.split('\n').map((l) => l.replace(/^(\{style "[^"]*"\} ?)+/, '').replace(/^\s*#+\s+/, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
}
export function compareNormalized(report) {
  const res = [];
  for (const b of blocks(report)) {
    const d = b.lines.filter((l) => l.startsWith('text-diff: ')).map((l) => l.slice(11));
    const exp = d.filter((l) => l.startsWith('<')).map((l) => l.slice(2));
    const act = d.filter((l) => l.startsWith('>')).map((l) => l.slice(2));
    if (!d.length) { res.push({ file: b.file, pass: true, how: 'no diff' }); continue; }
    const eq = (k) => JSON.stringify(norm(exp, k)) === JSON.stringify(norm(act, k));
    const A = eq(false), B = eq(true);
    const left = (k) => { const e = norm(exp, k), a = norm(act, k); return e.filter((x) => !a.includes(x)).length + a.filter((x) => !e.includes(x)).length; };
    res.push({ file: b.file, pass: A || B, how: A ? 'A' : B ? 'B' : `differs (${Math.min(left(false), left(true))} lines)` });
  }
  return { pass: res.every((r) => r.pass), files: res };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, rows] = load(process.argv[2]);
  for (const r of rows.filter((x) => x.case === 'compare-v1-v2')) {
    const c = r.report && fs.existsSync(r.report) ? compareNormalized(fs.readFileSync(r.report, 'utf8')) : { pass: false, files: [{ how: 'no report' }] };
    const f = fails(r);
    console.log([r.model, r.arm, r.run, 'frozen=' + r.fully_correct, 'fails=' + (f.join(' ') || '-'), 'norm=' + (c.pass ? 'pass' : 'FAIL'), c.files.map((x) => x.how).join('/')].join('\t'));
  }
}
