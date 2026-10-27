// Summarises a fix-verify loop for one arm: node scripts/verify.mjs DIR > out.md, where DIR holds short/, stale/ and long/
// (each with eval/ or cases/, reports/ and metrics.jsonl).
import fs from 'fs'; import path from 'path';
const dir = path.resolve(process.argv[2]);
const notAcc = (g) => g.startsWith('process-') || g.startsWith('secondary-') || g === 'precondition' || g.startsWith('rubric-');
const rows = [];
for (const [sub, only, drop] of [['short', null, 'stale-colleague-edit'], ['stale', 'stale-colleague-edit', null], ['without-stetdoc', null, null], ['long', null, null]]) {
  const d = path.join(dir, sub);
  for (const ev of ['eval', 'cases', 'without-stetdoc']) {
    const f = path.join(d, ev, 'aggregate-result.json'); if (!fs.existsSync(f)) continue;
    const agg = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const c of agg.cases) {
      if (only && c.name !== only) continue; if (drop && c.name === drop) continue;
      (c.arms.with || []).forEach((r, i) => {
        const id = path.basename((r.tracePath || '').split('/out/')[0]);
        const base = path.join(d, 'reports', `${c.name}-${id}`);
        const tr = fs.existsSync(base + '.transcript.jsonl') ? fs.readFileSync(base + '.transcript.jsonl', 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return {}; } }) : [];
        const uses = {}, errors = [], calls = [];
        for (const e of tr) for (const b of (e.message && Array.isArray(e.message.content) ? e.message.content : [])) {
          if (b.type === 'tool_use') { uses[b.id] = b; calls.push(b); }
          if (b.type === 'tool_result' && b.is_error) {
            const u = uses[b.tool_use_id] || {}; const txt = Array.isArray(b.content) ? b.content.map((x) => x.text || '').join(' ') : String(b.content || '');
            errors.push(`${u.name}: \`${String(u.input && (u.input.command || u.input.file_path || JSON.stringify(u.input))).slice(0, 200).replace(/\n/g, ' ⏎ ')}\` → ${txt.slice(0, 300).replace(/\n/g, ' ')}`);
          }
        }
        const nonStet = calls.filter((b) => {
          const s = b.name === 'Bash' ? b.input.command : (b.input && (b.input.file_path || b.input.path)) || '';
          if (!/\.docx\b/.test(s)) return false;
          if (b.name !== 'Bash') return true;
          if (/<<\s*'?(EOF|PY|PYEOF|END)/.test(s) && !/(zipfile|docx\.Document|unzip|lxml|document\.xml)/.test(s)) return false;
          // Lines and chained commands are checked one by one; a shell variable set to a path (F=x.docx) is not an access.
          return s.split(/&&|\|\||;|\||\n/).some((part) => /\.docx\b/.test(part) && !/^\s*(stetdoc|ls|cp|mv|rm|test|\[|echo|cd|md5|shasum|sha256sum|stat|file|wc|du)\b/.test(part.trim()) && !/^[A-Za-z_][A-Za-z0-9_]*=\S*$/.test(part.trim()));
        }).map((b) => `${b.name}: \`${String(b.name === 'Bash' ? b.input.command : b.input.file_path).slice(0, 160).replace(/\n/g, ' ⏎ ')}\``);
        const manual = calls.some((b) => b.name === 'Bash' && /--manual/.test(b.input.command));
        const gs = r.graders || [];
        const acc = gs.filter((g) => !notAcc(g.name));
        const reply = (gs.find((g) => g.evidence) || {}).evidence || '';
        const repText = fs.existsSync(base + '.txt') ? fs.readFileSync(base + '.txt', 'utf8') : '';
        const ooxml = [...repText.matchAll(/^ooxml-valid: (\w+)$/gm)].map((x) => x[1]).join('/') || '-';
        const ooxmlNew = [...repText.matchAll(/^ooxml-new: (.*)$/gm)].map((x) => x[1]);
        rows.push({ case: c.name, run: i + 1, id, pass: acc.length && acc.every((g) => g.passed) && !r.error,
          failed: acc.filter((g) => !g.passed).map((g) => g.name), failedProc: gs.filter((g) => notAcc(g.name) && !g.passed).map((g) => g.name),
          turns: r.turns, ooxml, ooxmlNew, calls: calls.length, errors, nonStet, manual, cost: r.costUsd, wall: r.durationSeconds, error: r.error, reply, report: base + '.txt', transcript: tr.length ? base + '.transcript.jsonl' : '(missing)' });
      });
    }
  }
}
const P = console.log;
P('| case | run | accuracy | ooxml | turns | tool calls | tool errors | non-stetdoc .docx access | --manual | cost $ (CC) | wall s |');
P('|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) P(`| ${r.case} | ${r.run} | ${r.pass ? 'pass' : 'FAIL: ' + r.failed.join(', ')} | ${r.ooxml} | ${r.turns} | ${r.calls} | ${r.errors.length} | ${r.nonStet.length} | ${r.case === 'long-indenture-markup' ? (r.manual ? 'yes' : 'no') : (r.manual ? 'yes (!)' : '-')} | ${(r.cost || 0).toFixed(3)} | ${r.wall} |`);
P('\n## Details\n');
for (const r of rows) {
  if (r.pass && !r.errors.length && !r.nonStet.length && !r.failedProc.length && !r.ooxmlNew.length) continue;
  P(`### ${r.case} run ${r.run} (${r.id})\n`);
  if (!r.pass) P(`- failed accuracy: ${r.failed.join(', ')}${r.error ? ' [run error: ' + r.error + ']' : ''}`);
  if (r.failedProc.length) P(`- failed process notes: ${r.failedProc.join(', ')}`);
  for (const e of r.errors) P(`- tool error: ${e}`);
  for (const e of r.nonStet) P(`- non-stetdoc .docx access: ${e}`);
  for (const e of r.ooxmlNew) P(`- ooxml new error group: ${e}`);
  if (r.reply) P(`- judged reply: ${r.reply.slice(0, 500).replace(/\n/g, ' ')}`);
  P(`- report: ${r.report}\n- transcript: ${r.transcript}\n`);
}
const sum = (k) => rows.reduce((s, r) => s + Number(r[k] || 0), 0);
P(`\nRuns: ${rows.length}, accuracy pass ${rows.filter((r) => r.pass).length}, tool errors ${rows.reduce((s, r) => s + r.errors.length, 0)}, Claude Code cost $${sum('cost').toFixed(2)}.`);
