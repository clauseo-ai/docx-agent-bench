# Post-hoc corrections of final-1 (v1.1)

These scripts re-grade the frozen run `final-1` after an adversarial review. They change no frozen
grader, case or result file: they read the saved per-run reports and transcripts and add new verdict
columns beside the frozen ones. Nothing here re-runs an agent. Write-up:
`stetdoc-cc-test/reports/benchmark-final-v1.1.md`.

| script | what it does |
|---|---|
| `lib.mjs` | CSV and report-parsing helpers |
| `compare-normalized.mjs` | compare-v1-v2 `nothing-else-changed`, with the fixture's typed-in markup (`### `, `[DELETED: …]`, `[ADDED: …]`, `<!-- indent:1 -->`) and whitespace normalized on both sides, every arm alike |
| `ar-neutral-rubric.md` | the neutral accept-reject-ambiguous rubric (round 2, the one used) |
| `ar-neutral-rubric-r1.md` | round 1 rubric, kept for the record (superseded) |
| `ar-neutral-judge.mjs` | blind re-judge of every arm's accept-reject-ambiguous run: 3 Sonnet 5.5 votes + 1 gemini-4-argon vote |
| `corrections.mjs` | builds the v1.1 per-run CSV, the tables and the task-clustered bootstrap |
| `live-v11.mjs` | adds the v1.1 columns to the live page CSV (backup first, atomic rename) |

Outputs: `results/final-1/posthoc/` (`ar-neutral-votes.jsonl` round 2, `ar-neutral-votes-r1.jsonl`
round 1, `corrections-tables.md`, `bootstrap.json`).

Round 1 of the neutral judge cut each of the 47 changes to 170 characters in the prompt and called
`claude -p` with Claude Code's default system prompt; Sonnet then failed accurate replies for
"misdescribing" changes it could not see. Round 2 gives the full change text, tells the judge not to
grade the reply's summary, and calls `claude -p --tools '' --system-prompt …`. Only round 2 feeds the
verdict columns; round 1's votes are kept and summarised in `corrections-tables.md`.

Reproduce (from this repo; `RUNS` = `stetdoc-cc-test/reports/benchmark-final-runs.csv`):

```
node scripts/posthoc/compare-normalized.mjs RUNS
node scripts/posthoc/ar-neutral-judge.mjs RUNS            # costs about $6.5 Sonnet + Gemini tokens
node scripts/posthoc/corrections.mjs RUNS OUT.csv results/final-1/posthoc/corrections-tables.md
```
