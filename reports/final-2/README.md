# final-2: summary outputs

The scored results of benchmark run `final-2`, copied from `results/final-2/` (which is gitignored). The raw per-run
outputs (reports, transcripts, written .docx files, Word screenshots) are packaged separately.

- Runs: 2026-10-30, 12:59 to 21:35 IST, from commit `2ce4d25`. The runner, harness, suite and graders that ran are
  byte-identical at `a6f72be`; only the orchestration scripts (`run-all.sh`, `agy-run-all.sh` resume) differ.
- Scoring: 2026-10-31, 01:19 to 01:41 IST, with the code at tag `final-2` (commit `7cad905`).

## Reproduce the tables offline (no agent or judge calls)

From a checkout of tag `final-2` with the raw outputs unpacked at `results/final-2/` and this directory's
`rubric-scores.jsonl` copied over the one there:

```sh
node scripts/rescore.mjs final-2              # rescore-audit.tsv, rescore-changes.tsv; stdout = rescore.log
node scripts/word-validity.mjs final-2 triage # validity-triage.tsv (keeps the sample drawn by the first triage)
node scripts/word-validity.mjs final-2 apply  # validity.tsv
node scripts/analyze.mjs final-2              # tables.md, runs.csv, bootstrap.json
```

Checked on 2026-11-02 with Node 26.12.0: `tables.md`, `bootstrap.json`, `validity.tsv`, `rescore-audit.tsv`,
`rescore-changes.tsv` and the rescore stdout came out byte-identical to the originals. `runs.csv` and
`validity-triage.tsv` matched once the checkout's absolute path was replaced (see below). The raw outputs had already
been rescored once: `rescore.mjs` keeps the original reports as `.raw` and the original verdicts as
`aggregate-result.raw.json`, and running it again rebuilds the same files.

## Files

| file | what it is | produced by |
|---|---|---|
| `tables.md` | every published table: short-task fully-correct counts with Wilson intervals, per-task counts, the stetdoc-minus-arm bootstrap, long tasks, process metrics, total agent and judge cost | `node scripts/analyze.mjs final-2` |
| `runs.csv` | one row per run (639): graders, Word validity, blocked flag, fully correct, rubric, turns, tool calls, tokens, cost, wall time | `node scripts/analyze.mjs final-2` |
| `bootstrap.json` | the bootstrap intervals behind the "stetdoc minus each other arm" table (seed 20261030, 10,000 draws) | `node scripts/analyze.mjs final-2` |
| `rubric-scores.jsonl` | judge verdicts per long-task run and rubric item (claude-sonnet-5-5), with judge cost. 89 lines; when a report was scored twice, `analyze.mjs` uses the later line | `node scripts/judge.mjs final-2`, run before the rescore, so the judge read the raw reports |
| `word-verdicts.tsv` | Microsoft Word verdicts (CLEAN, REPAIR_PROMPT, ERROR) with the screenshot name. One file in the clean sample got a repair prompt, so every one of the 651 written .docx was opened in Word. 660 rows: the other 9 keys are not in the current triage and `apply` ignores them | `node scripts/word-validity.mjs final-2 batch DIR`, opened in Word for Mac in a macOS VM, then `... import` |
| `word-fixtures.tsv` | Word verdicts for the test files built by `scripts/build-fixtures.py` | same batch and import |
| `validity-triage.tsv` | each written .docx: kept or not, Open XML SDK validator result, stetdoc check result, and whether it went to Word (`word`, `sample`, `clean`) | `node scripts/word-validity.mjs final-2 triage` |
| `validity.tsv` | Word validity per run, the input to `analyze.mjs` | `node scripts/word-validity.mjs final-2 apply` |
| `rescore-audit.tsv` | every run and grader whose regex matches or verdict differ between the raw and the normalised report | `node scripts/rescore.mjs final-2` |
| `rescore-changes.tsv` | runs whose all-graders verdict changed in the rescore (one) | `node scripts/rescore.mjs final-2` |
| `rescore.log` | stdout of that rescore: per-arm counts and the one changed verdict | `node scripts/rescore.mjs final-2 > rescore.log` |
| `rescore-summary.md` | a written summary of the rescore. No script produces it. Its saved-run, grader-matches and verdicts-changed counts match `rescore.log`; its "runs with the note" and "runs with comment markers" columns are not printed by any script | written by hand |
| `spend.log` | running spend total every 5 minutes during the runs, by model | a spend monitor that is not part of this repo |
| `monitor.log` | that monitor's final line (total $241.50 at 2026-10-30T16:00:49Z) | the same monitor |
| `judge.log` | per-report judge score and cost | stdout of `judge.mjs` |
| `refusals.log` | runs where Claude Code's built-in safety check refused a tool call (`analyze.mjs` finds blocked runs from the transcripts itself, not from this log) | no script in this repo; kept as a record |

The published cost figures come from the `cost_usd`, `cost_tokens_list_usd` and `judge_cost_usd` columns of `runs.csv`
and the last line of `tables.md`. `spend.log` was a live monitor; its last line ($242.52) is close to, but not the
same as, the `tables.md` agent total ($243.17), because the two count costs differently.

## Substitutions made in this copy

Each one replaces text only. No number changed.

| file | substitution | count |
|---|---|---|
| `runs.csv` | the checkout's absolute path prefix (a home directory path ending in `/docx-agent-bench/`) removed from the `report` and `transcript` columns, which leaves repo-relative `results/final-2/...` paths | 1278 |
| `runs.csv` | `authors` column of run `a-bay5tK` (gemini-3.8-flash-medium, none, redline-net60-new-york): the machine's user name replaced by `USER` | 1 |
| `rubric-scores.jsonl` | the same absolute path prefix removed from the `report` field. `analyze.mjs` resolves this field against the repo root, so the relative form is the one that reproduces `tables.md` from another checkout | 89 |
| `validity-triage.tsv` | the same absolute path prefix removed from the `kept` column | 651 |

All other files are byte-identical to `results/final-2/`.
