# docx-agent-bench

A benchmark for coding agents that read and edit Word documents. Each case gives Claude Code a realistic request about
a real contract (Harvey LAB documents) with one document plugin loaded (the arm). Graders then check what the agent
actually wrote. The same arm-neutral criteria apply to every arm, so stetdoc, no plugin, Anthropic's docx skill,
Anthropic's legal plugin and Adeu are measured the same way. It runs on Claude Code's `claude plugin eval` (2.1.311 or
later).

## Run it

```
scripts/setup-tools.sh                      # the PATH tools every arm gets (venv, pandoc) in /tmp/bench-tools
STETDOC_REPO=~/src/stetdoc scripts/setup-arms.sh   # every arm's plugin, pinned, in /tmp/bench-arms
scripts/fetch-fixtures.sh                   # the documents, by SHA-256, and the ones built from them
KEEP_OUTPUTS=1 TAG=final-2 RUNS=5 LONG_RUNS=2 scripts/run-all.sh       # Claude Code: every model x arm
KEEP_OUTPUTS=1 TAG=final-2 RUNS=5 LONG_RUNS=2 scripts/agy-run-all.sh   # Antigravity (Gemini)
node scripts/judge.mjs final-2              # Harvey's rubric for the long tasks (VOTES=3 for three votes)
node scripts/word-validity.mjs final-2 triage && node scripts/word-validity.mjs final-2 word && node scripts/word-validity.mjs final-2 apply
#   or, with Word on another machine or a VM: ... batch DIR (copies + manifest.tsv), open them there, ... import VERDICTS.tsv DIR/manifest.tsv
node scripts/analyze.mjs final-2            # results/final-2/runs.csv, tables.md (fully correct, Wilson intervals, bootstrap)
```

One arm, one model, one part: `MODEL=claude-haiku-5-5 scripts/bench.sh stetdoc short results/try/haiku/stetdoc/short --runs 2 -j 4`.
`scripts/verify.mjs DIR` prints a per-run table (accuracy, turns, tool calls, tool errors with the failing command, any
non-stetdoc tool touching a .docx, `--manual` on the indenture) for a fix-verify loop.

Every run is a real model call on your account. The validity check needs the Open XML SDK validator CLI
`ooxml-validate` (`OOXML_VALIDATE=/path/to/ooxml-validate`, else PATH): a small .NET tool over DocumentFormat.OpenXml
3.5.1 with `ooxml-validate FILE` and the count-based `ooxml-validate --compare BASE OUT [--json]`. Without it the
primary validity criterion reports "unavailable" and fails. The stetdoc command must be installed (`STETDOC_BIN` or PATH), because
the grading hook reads every arm's output with it. If Claude Code uses Vertex AI, `bench.sh` points
`GOOGLE_APPLICATION_CREDENTIALS` at your application default credentials, because each run has a temporary home.

### Antigravity (Gemini)

`scripts/agy-bench.mjs` runs the same cases headless with Antigravity CLI (`agy`, 1.4.8 or later) instead of Claude
Code, with the same fixtures, scaffolds, harness report and graders:

```
node scripts/agy-bench.mjs stetdoc short results/try/gemini-3.8-flash-medium/stetdoc/short --runs 2 -j 3
node scripts/agy-bench.mjs none short results/try/gemini-3.8-flash-medium/none/short --case rename-seller-vendor
```

- Auth with a Gemini API key: `~/.gemini/antigravity-cli/settings.json` holds `{"modelProvider":"gemini"}`, and the
  runner passes `GEMINI_API_KEY` (required) and, if set, `GOOGLE_GEMINI_BASE_URL` (unset: Google's public endpoint).
  Every variable the scripts read is listed in `scripts/README.md`. `AGY_MODEL` picks the model (default `gemini-3.8-flash-medium`), `AGY` the binary.
- Each run gets its own root with `HOME=<root>/home` (the settings file is copied in) and the workspace
  `<root>/home/cwd`, the layout `claude plugin eval` uses, so the scaffolds and `report.sh` run unchanged. The agent
  gets the same PATH as in `bench.sh` and no benchmark variables.
- agy runs every tool on the host (`--dangerously-skip-permissions`; Claude Code's eval sandbox does not apply), and in a
  test an agent ran `ps aux`, found the runner's command line and read the case's graders in this repository. So agy runs
  under macOS `sandbox-exec`: it cannot read or write the user's home, this repository, the temp folder or `/tmp`, except
  its own run root and the binaries and tools it needs (agy, stetdoc, node, `$TOOLS`, `$ARMS`), and it cannot list other
  processes. `AGY_SANDBOX=0` turns this off.
- Arms: `stetdoc` runs `stetdoc init --project --agent antigravity` in the workspace (`.agents/skills/stetdoc/SKILL.md`
  and `AGENTS.md`; there is no docx guard hook as in the Claude Code plugin); `none` installs nothing;
  `anthropic-docx` copies Anthropic's docx skill into `.agents/skills/docx`; `adeu` copies the adeu-redlining skill
  into `.agents/skills/adeu-redlining` and writes its MCP server (the Claude Code arm's `.mcp.json`) into the run's
  `~/.gemini/config/mcp_config.json`, where `agy mcp add` puts it. `anthropic-legal` is not wired (see `installArm`).
- Every run has one limit, `AGY_TIMEOUT` (default 1800 s), whatever the case's `timeout_seconds`. agy reports a print
  timeout as success with an empty reply; the runner reads agy's log and records it as an error.
- `TAG=... RUNS=5 LONG_RUNS=2 scripts/agy-run-all.sh` runs every Antigravity arm, as `run-all.sh` does for Claude Code.
- Parts: `short`, `long`, `without-stetdoc`. The stale case needs a seeded conversation, which agy's print mode cannot
  take, so it is not run.
- After agy exits, the runner calls the harness's `report.sh` (the Claude Code Stop hook) directly, with a Claude-style
  transcript converted from agy's stream-json (`run_command` becomes Bash, `view_file` Read, and so on; a command
  exiting non-zero is a tool error, as in Claude Code). It then evaluates the case's graders itself: regex,
  `tool_used`, and `llm` with `claude -p --model claude-sonnet-5-5` (`JUDGE=0` skips them). Turns are agy's model
  responses; tokens come from its per-step usage.
- Output is laid out as `bench.sh`'s (`eval/aggregate-result.json`, `metrics.jsonl`, `reports/` with the report, the
  converted transcript, the raw `.agy.jsonl` stream and agy's log), so `verify.mjs` and `analyze.mjs` read it. Cost is
  not computed (0). `KEEP=1` keeps the run roots.
- `KEEP_OUTPUTS=1` (for `bench.sh`, `run-all.sh` and `agy-bench.mjs`) copies every .docx a run created or changed to
  `<out>/outputs/<case>-<id>/`, so the files the report describes can be opened in Word. It changes no grading and never
  reaches the agent.

## Cases

`suite/evals/cases/`, the short tasks, on a master supply agreement, a credit agreement and two ISDA confirmations:

| case | request | accuracy criteria |
|---|---|---|
| read-conditions-precedent | conditions precedent to the initial loan, with sections | the answer cites 4.01 and 4.02 (judged); nothing written |
| redline-net60-new-york | net 60 and New York law, as a new file | tracked deletions and insertions in 11.1 and 23.1, final text right, no other paragraph changed, no untracked edit, original byte-identical, valid |
| comment-liability-cap | comment on the liability cap asking for twice the 12-month delivered value | one comment thread in Clause 18 saying so (any wording), no tracked change, nothing else changed, exactly one .docx written or changed |
| accept-reject-amounts-dates | 26 counterparty tracked changes: reject the 7 that change a dollar amount or a calendar date, accept the 19 others | a new .docx, no tracked change left, its text read as final equals the expected text (whitespace-normalized), original unchanged |
| compare-v1-v2 | redline the Tidemark draft against Greenleaf's revised confirmation | final text equals the revised version, text with all revisions rejected equals the draft, at least 20 revisions, an author |
| rename-seller-vendor | "Seller" to "Vendor" throughout, as tracked changes | no Seller left, every tracked deletion has Seller and every insertion Vendor, nothing else changed |
| chained-edits | net 45 and English law as tracked changes into one redline, then reject the payment change | only the governing-law change remains, as tracked changes |
| stale-colleague-edit | a second turn on a redline a colleague edited in between | the colleague's change kept and under their name, the new change made as a tracked change, nothing else changed |
| not-installed (`without-stetdoc/`, stetdoc arm only) | the rename, with stetdoc off PATH | refuses without touching the file or offering another way (judged) |

`suite/evals/long/`, three Harvey LAB tasks with their instructions and all their documents (emails and spreadsheets
included): `long-indenture-markup` (60 rubric items; the task asks for manual strikethrough/underline, not Track
Changes), `long-underwriting-markup` (47), `long-csa-counter-redline` (46; a counter-turn redline and a cover note).
The quality number is the share of Harvey's rubric items a Sonnet judge passes over the harness report. Exact-string
items also have regex graders, and objective criteria check the output (new valid .docx, tracked changes by an author
where asked, comments, the original unchanged).

## How grading works

`claude plugin eval` has no custom-code graders. So every case also loads `suite/evals/harness/`, a plugin whose only
part is a Stop hook. When the agent stops, the hook has stetdoc read every .docx the agent created or changed. It writes
`.eval-report.txt` with the file status against the setup's SHA-256 snapshot, the `stetdoc check` findings by code and
part, the revision ledger, the comments, the final text, `text-diff` lines (paragraphs whose final text differs from
the base, after the case's `normalize.pl`) and `untracked-diff` lines (with every revision rejected, paragraphs that
differ from the base's original text). The graders are regexes over that report. The hook also records turns, tool
calls, tool errors, tokens and the transcript in `results/.../reports/`. The hook finds the stetdoc and validator paths
and the metrics file in files `bench.sh` writes into its copy of the suite, and `bench.sh` removes every benchmark
variable (`OOXML_VALIDATE`, `EVAL_*`, `STETDOC_*`, `MODEL`, ...) from Claude Code's environment, so the agent cannot see
the validator or the grading setup.

**Validity** is judged by Microsoft Word: a written .docx is valid when it opens in Word for Mac with no error and no
repair prompt. `scripts/word-validity.mjs` does this after a run (it needs `KEEP_OUTPUTS=1`, so every written .docx is
kept). It triages each file with the report's two machine checks, the Open XML SDK validator (`ooxml-validate
--compare` against the edited input: a new error, or a file it cannot open) and `stetdoc check` (more findings than the
input), and opens every file either flags in Word with `word-check.sh` (driven through cua-driver; it never saves). Files
clean under both count as valid, and a seeded random sample of 20 of them is opened in Word as well; if any of the
sample fails, every file is opened. Neither machine check is a verdict. The Word verdicts (file, result, dialog,
screenshot) are in `results/TAG/word-verdicts.tsv`, the per-run result in `results/TAG/validity.tsv`. `batch DIR` copies the
files Word must open (and the test files `build-fixtures.py` makes) into a folder with a manifest, for a Word that runs
elsewhere, such as a macOS VM; `import` reads that run's verdicts back.

The graders read the report through `suite/evals/harness/normalise.sh`, the same for every arm: comment range markers
(`{c3}…{/c3}`) are removed with their text kept, and the reader's note on tracked changes by other authors is dropped.
The raw report is kept beside it as `<case>-<id>.raw`. `scripts/rescore.mjs TAG` re-scores saved runs offline from their
reports the same way (it first checks that the raw reports reproduce the stored verdicts) and writes an audit of what the
normaliser changed; `node --test scripts/test/` tests the normaliser.

Accuracy is the share of a case's graders passed (`precondition` and the long tasks' `rubric-*` exact-string items are
reported separately). A run is **fully correct** when every accuracy grader passes, the run ended without an error, and
every .docx it wrote is valid. Process is reported only as metrics: turns, tool calls, tool errors, time and cost.
Tracked changes are required only where the prompt asks for them.

## Known limits

- Two runs of the stale case at the same time share one resumed conversation, so `run-all.sh` runs it alone with
  `-j 1`.
- The judge graders (and the long rubric, one vote by default) can be lenient: the long rubric is near its ceiling for
  most arms.
- stetdoc reads the outputs for the content checks (`stetdoc view`), for every arm. No second reader is used.
- Word's verdict is that of one Word version on one Mac (see the report); other Word versions may differ.

## Cost

From final-2 (`results/final-2/runs.csv`, `tables.md`): Opus 5.5 about $0.26 per short run (median; $0.08 to $1.33) and
$3.40 per long run ($1.54 to $5.08). Haiku 5.5 about a cent per short run and $0.77 per long run. Gemini 3.8 Flash, at
assumed rates of $0.50 / $0.05 / $3 per million input / cached / output tokens, about $0.11 to $0.42 per short run
(medians by arm). The whole suite (5 runs per short case, 2 per long task, every model and arm) cost about $157 on
Opus, $24 on Haiku and $62 on Gemini, plus about $17 for judges.
