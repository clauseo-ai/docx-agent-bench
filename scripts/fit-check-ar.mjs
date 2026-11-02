// Fit check for accept-reject-amounts-dates: two models outside the benchmark classify every change under the prompt.
//   node fit-check.mjs CHANGES.txt ANSWER.txt
import fs from 'fs'; import { execFileSync } from 'child_process';
//   Env: GEMINI_API_KEY (required), GEMINI_URL (default https://generativelanguage.googleapis.com, Google's public endpoint).
const [CH, ANS] = process.argv.slice(2);
if (!CH || !ANS) { console.error('usage: fit-check-ar.mjs CHANGES.txt ANSWER.txt'); process.exit(2); }
const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) { console.error('GEMINI_API_KEY is not set: fit-check-ar.mjs calls the Gemini API with it'); process.exit(2); }
const GEMINI_URL = (process.env.GEMINI_URL || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
const changes = fs.readFileSync(CH, 'utf8').trim();
const answer = Object.fromEntries(fs.readFileSync(ANS, 'utf8').trim().split('\n').map((l) => { const m = l.match(/^(\d+)\s+(accept|reject)/i); return [m[1], m[2].toUpperCase()]; }));
const prompt = `A client sends you this instruction about a contract (an interest rate swap confirmation):

"docs/swap-confirmation-counterparty.docx has the counterparty's tracked changes. Reject the ones that change a dollar amount or a calendar date and accept all the others. Save the result as a new file and tell me which changes you rejected."

Here is every tracked change in the document, in document order, as text (deleted / inserted, with some surrounding context; "[...]" marks where the change sits):

${changes}

Classify every change under the client's instruction: REJECT if it changes a dollar amount or a calendar date, ACCEPT otherwise. Reply with one JSON object only, mapping each change number (as a string) to "ACCEPT" or "REJECT", plus a key "unclear" listing the numbers of any change whose classification you think is genuinely debatable (empty list if none).`;
const parse = (t) => JSON.parse(String(t).match(/\{[\s\S]*\}/)[0]);
const o = execFileSync('claude', ['-p', '--model', 'claude-sonnet-5-5', '--output-format', 'json', '--tools', '', '--no-session-persistence', '--strict-mcp-config', '--system-prompt', 'You are a careful contracts lawyer. Reply with one JSON object only.'], { input: prompt, encoding: 'utf8', cwd: '/tmp' });
const sj = JSON.parse(o); const s = parse(sj.result);
const r = await fetch(`${GEMINI_URL}/v1beta/models/gemini-4-argon:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
  body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }) });
const gj = await r.json(); if (gj.error) throw new Error(JSON.stringify(gj.error));
const g = parse((gj.candidates[0].content.parts || []).filter((x) => !x.thought).map((x) => x.text || '').join(''));
const cmp = (v) => Object.keys(answer).filter((k) => String(v[k]).toUpperCase() !== answer[k]);
console.log(JSON.stringify({ sonnet: { mismatches: cmp(s), unclear: s.unclear, cost_usd: sj.total_cost_usd, verdicts: s }, gemini: { model: 'gemini-4-argon', mismatches: cmp(g), unclear: g.unclear, usage: gj.usageMetadata, verdicts: g } }, null, 1));
