// node --test scripts/test/  — the grading normaliser (suite/evals/harness/normalise.sh).
import { test } from 'node:test'; import assert from 'node:assert/strict'; import { execFileSync } from 'child_process'; import path from 'path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const norm = (s) => execFileSync(path.join(root, 'suite/evals/harness/normalise.sh'), { input: s, encoding: 'utf8' });

test('comment range markers are dropped and the wrapped text kept (Haiku adeu chained-edits e-zqC1Zv)', () => {
  const raw = 'p145 {style "First Paragraph"} {c3}11.1{/c3} Payment for each Shipment of Products shall be due within thirty (30) days from the date of the Bill of Lading\n';
  const out = norm(raw);
  assert.equal(out, 'p145 {style "First Paragraph"} 11.1 Payment for each Shipment of Products shall be due within thirty (30) days from the date of the Bill of Lading\n');
  // the chained-edits grader payment-back-to-30 now matches
  assert.match(out, /11\.1 Payment[^\n]*thirty \(30\) days/);
});

test('a lone point anchor is dropped; comment labels and thread lines stay', () => {
  assert.equal(norm('p9 Text{c4} more\n'), 'p9 Text more\n');
  const label = '  {c3 C 2026-10-30} Payment term kept at thirty (30) days.\n{thread c3 open · on p145 "11.1"}\n{c3 C 2026-10-30 on p145 "11.1"} Payment term kept.\n';
  assert.equal(norm(label), label);
});

test("the reader's note on other authors' changes is dropped, nothing else", () => {
  const raw = [
    '{stet 1 view=body base=7fe3b62dd9b2422e:0:7fe3b62dd9b2422e mode=final common-style="Compact" range=p1..p537}',
    '2 tracked changes by Claude already in the document: #0 delete p273 "Republic of Singapore", #1 insert p273 "England and Wales".',
    'If you did not make them, tell the user about them.',
    '{summary: 2 tracked changes (C 2) · 1 section}',
    '5 tracked changes by others (Eval Reviewer 4, Dana Colleague 1) already in the document: #0 delete p145 "thirty (30)" \\',
    '  #1 insert p145 "forty-five (45)".',
    'If you did not make them, tell the user about them.',
    '1 tracked change by Adeu AI (TS) already in the document: #0 insert p6 "Vendor".',
    'If you did not make them, tell the user about them.',
    'p1 {style "heading 1"} MASTER SUPPLY AGREEMENT',
    ''].join('\n');
  assert.equal(norm(raw), [
    '{stet 1 view=body base=7fe3b62dd9b2422e:0:7fe3b62dd9b2422e mode=final common-style="Compact" range=p1..p537}',
    '{summary: 2 tracked changes (C 2) · 1 section}',
    'p1 {style "heading 1"} MASTER SUPPLY AGREEMENT',
    ''].join('\n'));
});

test('text without markers or a note is unchanged', () => {
  const raw = 'eval-report 2\ncreated: ./docs/x.docx\nremaining-revisions: 0\nuntracked-diff: > a {b} c\n';
  assert.equal(norm(raw), raw);
});
