# Grader normalisation audit (scripts/rescore.mjs final-2)

All saved runs of all models and parts (689), 4,935 regex verdicts; the raw reports reproduce every stored verdict.

| arm | saved runs | runs with the note | runs with comment markers | grader matches inside the note (before → after) | grader × run pairs whose matches depend on markers | grader verdicts changed |
|---|---|---|---|---|---|---|
| stetdoc | 158 | 0 | 30 | 0 → 0 | 0 | 0 |
| none | 143 | 82 | 29 | 83 → 0 | 0 | 0 |
| anthropic-docx | 143 | 91 | 27 | 88 → 0 | 0 | 0 |
| anthropic-legal | 102 | 60 | 20 | 59 → 0 | 0 | 0 |
| adeu | 143 | 92 | 39 | 86 → 0 | 1 | 1 |

One verdict changed: claude-haiku-5-5 adeu chained-edits e-zqC1Zv, payment-back-to-30 false → true. Per run and grader: rescore-audit.tsv.
