# docx-agent-bench

A benchmark for AI coding agents that read and edit Word documents. Each case gives an agent a realistic request
about a real contract (documents from Harvey LAB), with one document plugin or skill loaded. That plugin is the
"arm". Graders then check the files the agent wrote. The same criteria apply to every arm, so stetdoc, no plugin,
Anthropic's docx skill, Anthropic's legal plugin and Adeu are measured the same way. Claude models run in Claude Code
(`claude plugin eval`), Gemini runs in the Antigravity CLI (`agy`).

**Conflict of interest.** This benchmark was written by the author of stetdoc, one of the arms it compares.
stetdoc is made by Clauseo (https://clauseo.chat): https://github.com/clauseo-ai/stetdoc, site
https://stetdoc.clauseo.chat. The stetdoc site quotes numbers from run `final-2` of this benchmark. This repository is
public so that anyone can check those numbers: rescore final-2 from its raw outputs, read the graders, or run the
benchmark again. stetdoc also reads every arm's output for the content checks (see "How grading works"), so a bug in
stetdoc's reader would affect every arm's score.

## Run final-2

final-2 is the run the stetdoc site quotes. It ran on 2026-10-30 and was scored on 2026-10-31.

- Scored summary: [`reports/final-2/`](reports/final-2/). [`tables.md`](reports/final-2/tables.md) holds the headline
  numbers, [`runs.csv`](reports/final-2/runs.csv) one row per run, and
  [`reports/final-2/README.md`](reports/final-2/README.md) names the command that produced each file.
- Raw outputs (per-run reports, transcripts, written .docx files, Word screenshots): the GitHub release asset
  `docx-agent-bench-final-2-raw.tar.gz` at https://github.com/clauseo-ai/docx-agent-bench/releases/tag/final-2,
  SHA-256 `561991ee755391ef60c4a0f1a31b54d6e809603c50973064dadffdaebf6e87bc`. Text logs in it are redacted; the tarball's `REDACTIONS.md` lists each redaction.
- Tags: `final-2` is the scoring commit `7cad905`. The runs used commit `2ce4d25`. No git hash is recorded in the
  results, so the run commit is inferred from file times: the outputs date from 2026-10-30 12:59 to 21:35 IST, after
  2ce4d25 was committed (12:46 IST). The `final-2` tag message gives the evidence (`git cat-file tag final-2`). Tag
  `final-1` (commit `d21bd99`) is an earlier frozen run; its numbers are not published and are not discussed here.

### Results

Short tasks, fully correct runs, with Wilson 95% intervals in brackets. Copied from
[`reports/final-2/tables.md`](reports/final-2/tables.md) lines 7-13:

| arm | claude-haiku-5-5 | claude-opus-5-5 | gemini-3.8-flash-medium |
|---|---|---|---|
| stetdoc | 40/40 (91–100) | 40/40 (91–100) | 34/35 (85–99) |
| none | 40/40 (91–100) | 35/35 (90–100) | 34/35 (85–99) |
| anthropic-docx | 40/40 (91–100) | 40/40 (91–100) | 33/35 (81–98) |
| anthropic-legal | 40/40 (91–100) | 36/37 (86–100) | not run |
| adeu | 34/40 (71–93) | 35/40 (74–95) | 30/35 (71–94) |

A run is fully correct when every accuracy grader passes, the run ended without an error, and every .docx it wrote
opens in Microsoft Word without an error or a repair prompt (tables.md line 3). Most cells are at or near 100%, so
the arms mostly tie on correctness. In the task-clustered bootstrap (tables.md lines 63-75), stetdoc minus none is +0
on all three models; the only differences above +3 points are against adeu, and every 95% interval includes 0.

Median wall-clock seconds per short run, from tables.md lines 100-113 (the "wall s" column):

| model | stetdoc | none | anthropic-docx | anthropic-legal | adeu |
|---|---|---|---|---|---|
| claude-haiku-5-5 | 21 | 41 | 42.5 | 44 | 44.5 |
| claude-opus-5-5 | 25 | 43 | 55.5 | 49 | 36.5 |
| gemini-3.8-flash-medium | 135 | 426 | 538 | not run | 274 |

Long tasks (3 Harvey LAB tasks, 2 runs each, so 6 runs per cell) are in tables.md lines 79-94: stetdoc is 6/6 fully
correct on each model, the other arms 2/6 to 5/6. The judge's rubric share is 75% to 99% across all cells, near the
ceiling for most arms.

The table counts 639 runs (tables.md line 115). The short-task table above leaves out the 15 `not-installed` runs, the
84 long runs and 8 blocked Opus runs (see "Known limits").

### Versions

| item | version | source |
|---|---|---|
| Claude Code | 2.1.311, the only version in the transcripts | `"version":"2.1.311"` in `*.transcript.jsonl` in the raw outputs |
| Antigravity CLI (`agy`) | language server 1.4.8; the CLI's own build string is not in the logs | `.agy.log` "Language server version: 1.4.8"; `ANTIGRAVITY_LS_VERSION=cli-1.4.8` |
| Agent models | claude-opus-5-5, claude-haiku-5-5, gemini-3.8-flash-medium | `model` column of runs.csv |
| Judge (long rubric and `llm` graders) | claude-sonnet-5-5 | scripts/judge.mjs line 42; scripts/bench.sh `--judge-model` |
| stetdoc | 0.9.0 (plugin and binary). The stetdoc commit was not recorded | runner logs: `Plugin under test: "stetdoc" version "0.9.0"` |
| anthropic-docx arm | anthropics/skills `ca45fc496a3436251f191354091d557da31c15b5`, `skills/docx`, wrapped as plugin document-skills-docx 1.0.0 | scripts/setup-arms.sh lines 14, 21 |
| anthropic-legal arm | anthropics/knowledge-work-plugins `2574e29377c7173d0cecffef29a6ecbd7f8ccb5d`, `legal/`, plugin legal 1.3.0 | scripts/setup-arms.sh lines 15, 22; runner logs |
| adeu arm | dealfluence/adeu v3.0.7 `096baa88b8ea6980ad305abaae8e31b49c3c3918`, `skills/adeu-redlining` (plugin adeu-redlining 1.14.0), plus npm `@adeu/mcp-server@3.0.7` | scripts/setup-arms.sh lines 16, 24-27 |
| none arm | `arms/none`, an empty plugin (no-document-plugin 0.0.0) | scripts/setup-arms.sh line 18 |
| Microsoft Word | Word for Mac 16.114.3 (build 16.114.26102720), in a macOS VM | suite/evals/cases/accept-reject-amounts-dates/README.md line 37 |
| Open XML SDK validator | `ooxml-validate`, over DocumentFormat.OpenXml 3.5.1. Now its own repository: https://github.com/clauseo-ai/ooxml-validate. The build used for final-2 was not recorded | this README at tag final-2 |
| Shared tools | pandoc 3.13 (pinned URL); Python venv with python-docx, lxml, defusedxml, openpyxl, unpinned (transcripts show Python 3.13.16, python-docx 1.2.0, lxml 6.1.3) | scripts/setup-tools.sh |
| Node | not recorded for the runs; the offline reproduction used Node 26.12.0 | reports/final-2/README.md line 22 |

### Cost

Total agent cost $243.17, judges $16.98 (tables.md line 115). How it is computed (scripts/analyze.mjs line 89):

- **Opus:** Claude Code's own `total_cost_usd` estimate (`cost_usd` in runs.csv).
- **Haiku:** tokens at list price, $0.10 input, $0.01 cache read, $0.125 cache write, $0.50 output per million
  (analyze.mjs line 24; `cost_tokens_list_usd` in runs.csv). Claude Code's own estimate for the same runs is $24.78.
- **Gemini:** agy reports no cost. Tokens are priced at assumed rates of $0.50 input, $0.05 cache read, $3 output per
  million (analyze.mjs lines 86-88). These rates were not checked against a bill.

By model, summed from runs.csv with that rule:

| model | agent $ | judge $ |
|---|---|---|
| claude-opus-5-5 | 156.66 | 6.25 |
| gemini-3.8-flash-medium (assumed rates) | 62.95 | 5.43 |
| claude-haiku-5-5 (list price) | 23.56 | 5.31 |

Median cost per short run by model and arm is in tables.md lines 100-113. `reports/final-2/spend.log` is a live
monitor that ran during the runs and counted differently; its last line says $242.52.

## What each arm got

Every arm got the same case files: `prompt.md`, the scaffold that sets up the workspace and the graders are shared, and
the arm is mounted as `../../arm` next to `../../harness` (`plugins:` in each `prompt.md`). Short cases allow 40 turns
and 600 s, long cases 120 turns and 1800 s. The allowed tools are Read, Glob, Grep, Skill, Bash, Edit and Write.

Every agent's PATH has the shared tools (a Python venv and pandoc) plus the host PATH with every directory containing
`stetdoc` removed. stetdoc's directory is added back only in the stetdoc arm.

- **Claude Code** (`scripts/bench.sh`): `claude plugin eval --scaffold --trust-plugin --ablation none --model $MODEL
  --judge-model claude-sonnet-5-5`, with `--allow-real-servers` for adeu only, and `--max-cost-usd 20` per invocation.
  Claude Code's eval sandbox applies. Benchmark variables are removed from Claude Code's environment.
- **Antigravity** (`scripts/agy-bench.mjs`): `agy -p --model $AGY_MODEL --dangerously-skip-permissions
  --print-timeout 1800s`, under macOS `sandbox-exec` (details below). No cost cap.

Per arm:

- **stetdoc**: Claude Code gets the stetdoc repository's `plugins/claude` (plugin 0.9.0, with a hook that guards .docx
  files) and the binary on PATH. agy gets `stetdoc init --project --agent antigravity` in the workspace (a skill and
  `AGENTS.md`, no guard hook). Only this arm also runs `not-installed`, with stetdoc off PATH.
- **none**: an empty plugin. agy installs nothing.
- **anthropic-docx**: Anthropic's `skills/docx` as a plugin. agy gets it in `.agents/skills/docx`.
- **anthropic-legal**: Anthropic's `legal/` plugin, with its remote MCP connectors not started. Claude Code only; it is
  not wired for agy.
- **adeu**: the `adeu-redlining` skill plus `@adeu/mcp-server` 3.0.7 started by node. agy gets the skill in
  `.agents/skills/adeu-redlining` and the server in the run's `~/.gemini/config/mcp_config.json`.

## Rerun from a clean clone

Every run is a real model call on your account. A fresh run will not reproduce final-2's numbers exactly: the models
are live services, the stetdoc commit was not pinned and the pip packages are not pinned.

### Prerequisites

- macOS (the pandoc download in `setup-tools.sh` is macOS-only, and agy runs under `sandbox-exec`)
- node, git, npm, jq, and Python 3.10 or later
- Claude Code 2.1.311 or later (`claude plugin eval`)
- for Gemini: `agy` with language server 1.4.8 or later, `~/.gemini/antigravity-cli/settings.json` holding
  `{"modelProvider":"gemini"}`, and `GEMINI_API_KEY`
- a stetdoc checkout (`STETDOC_REPO`) and an installed stetdoc binary (`STETDOC_BIN` or PATH). The grading hook reads
  every arm's output with it.
- `ooxml-validate` (`OOXML_VALIDATE` or PATH), from https://github.com/clauseo-ai/ooxml-validate. Without it the
  validity criterion reports "unavailable" and fails.
- for Word validity: Microsoft Word, and a `word-check.sh` script (`WORD_CHECK`) that opens a file in Word and prints
  its verdict. That script is not in this repository; `scripts/README.md` gives its interface. Without it, use
  `batch` and `import` (below) with Word on another machine.

Every environment variable the scripts read is listed with its default in [`scripts/README.md`](scripts/README.md).
The ones a full run needs: `STETDOC_REPO`, `STETDOC_BIN`, `OOXML_VALIDATE`, `GEMINI_API_KEY`, `KEEP_OUTPUTS=1` (keeps
the written .docx files for the Word check), `TAG`, `RUNS`, `LONG_RUNS`.

### Set up and run

```
scripts/setup-tools.sh                      # the PATH tools every arm gets (venv, pandoc) in /tmp/bench-tools
STETDOC_REPO=~/src/stetdoc scripts/setup-arms.sh   # every arm's plugin, pinned, in /tmp/bench-arms
scripts/fetch-fixtures.sh                   # the documents, checked by SHA-256, and the ones built from them
KEEP_OUTPUTS=1 TAG=mine RUNS=5 LONG_RUNS=2 scripts/run-all.sh       # Claude Code: every model x arm
KEEP_OUTPUTS=1 TAG=mine RUNS=5 LONG_RUNS=2 scripts/agy-run-all.sh   # Antigravity (Gemini)
node scripts/judge.mjs mine                 # Harvey's rubric for the long tasks (VOTES=3 for a majority of three)
node scripts/rescore.mjs mine               # rescore the saved reports through the normaliser
node scripts/word-validity.mjs mine triage && node scripts/word-validity.mjs mine word && node scripts/word-validity.mjs mine apply
#   or, with Word on another machine or a VM: ... batch DIR (copies + manifest.tsv), open them there, ... import VERDICTS.tsv DIR/manifest.tsv
node scripts/analyze.mjs mine               # results/mine/runs.csv, tables.md (fully correct, Wilson intervals, bootstrap)
```

final-2 used `RUNS=5 LONG_RUNS=2` and ran the Word step with `batch` and `import` in a macOS VM. `run-all.sh` defaults
to `LONG_RUNS=1`, so set it.

One arm, one model, one part: `MODEL=claude-haiku-5-5 scripts/bench.sh stetdoc short results/try/haiku/stetdoc/short --runs 2 -j 4`.
`scripts/verify.mjs DIR` prints a per-run table (accuracy, turns, tool calls, tool errors with the failing command, any
non-stetdoc tool touching a .docx, `--manual` on the indenture) for a fix-verify loop.

If Claude Code uses Vertex AI, `bench.sh` points `GOOGLE_APPLICATION_CREDENTIALS` at your application default
credentials, because each run has a temporary home.

### Score final-2 offline from the raw outputs

This needs no agent or judge calls and no Word.

```sh
shasum -a 256 -c docx-agent-bench-final-2-raw.tar.gz.sha256
mkdir -p results && tar -xzf docx-agent-bench-final-2-raw.tar.gz -C results
mv results/docx-agent-bench-final-2-raw results/final-2
git show main:reports/final-2/rubric-scores.jsonl > results/final-2/rubric-scores.jsonl
git checkout final-2
node scripts/rescore.mjs final-2
node scripts/word-validity.mjs final-2 triage
node scripts/word-validity.mjs final-2 apply
node scripts/analyze.mjs final-2
```

The committed `rubric-scores.jsonl` (added after the `final-2` tag, hence `git show main:`) replaces the archive's
copy, whose paths are absolute and redacted. Then compare
`results/final-2/` with `reports/final-2/`. On 2026-11-02 with Node 26.12.0, `tables.md`, `bootstrap.json`,
`validity.tsv` and the rescore outputs came out byte-identical; `runs.csv` and `validity-triage.tsv` matched after the
checkout's path prefix was replaced (reports/final-2/README.md lines 22-27, which also list the substitutions).

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
input). Every file either check flags goes to Word, through `WORD_CHECK` (it never saves). By default, files clean
under both checks count as valid and only a seeded random sample of them (`SAMPLE`, default 20) is opened in Word; if
any sampled file fails, every file is opened. Neither machine check is a verdict on its own. The Word verdicts (file,
result, dialog, screenshot) go to `results/TAG/word-verdicts.tsv`, the per-run result to `results/TAG/validity.tsv`.
`batch DIR` copies the files Word must open (and the test files `build-fixtures.py` makes) into a folder with a
manifest, for a Word that runs elsewhere, such as a macOS VM; `import` reads that run's verdicts back.

In final-2 the sample was 17 files, drawn by an earlier triage of the tag and kept (word-validity.mjs keeps an existing
sample). One sampled file got a repair prompt, so all 651 written .docx files were opened in Word
(`opened_in_word` in reports/final-2/validity.tsv sums to 651; reports/final-2/README.md line 36).

The graders read the report through `suite/evals/harness/normalise.sh`, the same for every arm: comment range markers
(`{c3}…{/c3}`) are removed with their text kept, and the reader's note on tracked changes by other authors is dropped.
The raw report is kept beside it as `<case>-<id>.raw`. `scripts/rescore.mjs TAG` re-scores saved runs offline from their
reports the same way (it first checks that the raw reports reproduce the stored verdicts) and writes an audit of what the
normaliser changed; `node --test scripts/test/` tests the normaliser.

Accuracy is the share of a case's graders passed (`precondition` and the long tasks' `rubric-*` exact-string items are
reported separately). A run is **fully correct** when every accuracy grader passes, the run ended without an error, and
every .docx it wrote is valid. Process is reported only as metrics: turns, tool calls, tool errors, time and cost.
Tracked changes are required only where the prompt asks for them.

### Antigravity (Gemini)

`scripts/agy-bench.mjs` runs the same cases headless with the Antigravity CLI instead of Claude Code, with the same
fixtures, scaffolds, harness report and graders:

```
node scripts/agy-bench.mjs stetdoc short results/try/gemini-3.8-flash-medium/stetdoc/short --runs 2 -j 3
node scripts/agy-bench.mjs none short results/try/gemini-3.8-flash-medium/none/short --case rename-seller-vendor
```

- Auth with a Gemini API key: `~/.gemini/antigravity-cli/settings.json` holds `{"modelProvider":"gemini"}`, and the
  runner passes `GEMINI_API_KEY` (required) and, if set, `GOOGLE_GEMINI_BASE_URL` (unset: Google's public endpoint).
  `AGY_MODEL` picks the model (default `gemini-3.8-flash-medium`), `AGY` the binary.
- Each run gets its own root with `HOME=<root>/home` (the settings file is copied in) and the workspace
  `<root>/home/cwd`, the layout `claude plugin eval` uses, so the scaffolds and `report.sh` run unchanged. The agent
  gets the same PATH as in `bench.sh` and no benchmark variables.
- agy runs every tool on the host (`--dangerously-skip-permissions`; Claude Code's eval sandbox does not apply), and in a
  test an agent ran `ps aux`, found the runner's command line and read the case's graders in this repository. So agy runs
  under macOS `sandbox-exec`: it cannot read or write the user's home, this repository, the temp folder or `/tmp`, except
  its own run root and the binaries and tools it needs (agy, stetdoc, node, `$TOOLS`, `$ARMS`), and it cannot list other
  processes. `AGY_SANDBOX=0` turns this off. Because the stetdoc binary's directory stays readable, an agent in another
  arm can still run it by absolute path (see "Known limits").
- Every run has one limit, `AGY_TIMEOUT` (default 1800 s), whatever the case's `timeout_seconds`. agy reports a print
  timeout as success with an empty reply; the runner reads agy's log and records it as an error.
- Parts: `short`, `long`, `without-stetdoc`. The stale case needs a seeded conversation, which agy's print mode cannot
  take, so it is not run.
- After agy exits, the runner calls the harness's `report.sh` (the Claude Code Stop hook) directly, with a Claude-style
  transcript converted from agy's stream-json (`run_command` becomes Bash, `view_file` Read, and so on; a command
  exiting non-zero is a tool error, as in Claude Code). It then evaluates the case's graders itself: regex,
  `tool_used`, and `llm` with `claude -p --model claude-sonnet-5-5` (`JUDGE=0` skips them). Turns are agy's model
  responses; tokens come from its per-step usage.
- Output is laid out as `bench.sh`'s (`eval/aggregate-result.json`, `metrics.jsonl`, `reports/` with the report, the
  converted transcript, the raw `.agy.jsonl` stream and agy's log), so `verify.mjs` and `analyze.mjs` read it. agy
  reports no cost; `analyze.mjs` prices the tokens (see "Cost"). `KEEP=1` keeps the run roots.
- `KEEP_OUTPUTS=1` (for `bench.sh`, `run-all.sh` and `agy-bench.mjs`) copies every .docx a run created or changed to
  `<out>/outputs/<case>-<id>/`, so the files the report describes can be opened in Word. It changes no grading and never
  reaches the agent.

## Known limits

These apply to final-2. Each points to where it can be checked.

- **Host stetdoc in two Gemini no-plugin runs.** In the agy sandbox the stetdoc binary's directory is readable, because
  it is on the sandbox's read list; it is only removed from PATH. Two Gemini `none` runs, chained-edits `a-01xoEW` and
  redline-net60-new-york `a-bay5tK`, ran the host stetdoc by absolute path. Both count as fully correct in runs.csv.
  To find them: `jq -r 'select(.bash)|select([.bash[]|select(test("cargo/bin/stetdoc"))]|length>0)|.case+" "+(.root|split("/")|last)' results/final-2/*/*/*/metrics.jsonl`.
  A third, gemini adeu comment-liability-cap `a-i1poo6`, read the stetdoc arm's skill file under `$ARMS` but edited
  through the adeu MCP server. No Claude Code run's `bash` list matches the host stetdoc path.
- **Gemini agents read the harness's `.eval-state`.** It sits in the run's HOME, inside the sandbox. It holds
  `before.sha`, `case`, `base-original.txt` and `base-final.txt`: the input document's text, not the expected answer; the expected file is never
  copied into the workspace (suite/evals/harness/report.sh lines 7-9). Runs with a command touching it: gemini adeu
  4/35, anthropic-docx 9/35, none 8/35, stetdoc 3/35; no Claude run.
- **The judge read pre-normalisation reports.** judge.mjs ran at 01:19 IST, before rescore.mjs normalised the reports at
  01:41 (tag message; reports/final-2/README.md line 35). The rubric is near its ceiling for most arms, and a judge
  with one vote can be lenient. The judge's excerpt leaves out the agent's chat reply and the final text, except for a
  cover note (scripts/judge.mjs lines 15-28).
- **Judge vote count not recorded.** judge.mjs defaults to one vote (line 13), and `rubric-scores.jsonl` has no votes
  field. A median judge cost of about $0.17 per report suggests one vote; that is an inference.
- **The rescore changed one verdict:** claude-haiku-5-5 adeu chained-edits `e-zqC1Zv`, false to true. The raw reports
  reproduce all 4,935 stored regex verdicts (reports/final-2/rescore.log).
- **rescore-summary.md is hand-written.** Two of its columns are printed by no script (reports/final-2/README.md
  line 43).
- **Blocked Opus runs are excluded.** Claude Code's safety check refused a tool call and nothing was written in 8 Opus
  stale-colleague-edit runs (anthropic-legal 3, none 5). They are in runs.csv with `blocked=1` and left out of the
  short-task table (tables.md line 15). `refusals.log` is a partial hand-kept record; analyze.mjs finds blocked runs
  from the transcripts.
- **Gemini timeouts.** 5 Gemini runs hit the 1800 s agy print timeout and count as errors, 4 of them anthropic-docx
  (`error` column of runs.csv).
- **Cost is not one kind of number.** Gemini cost uses assumed prices, Opus cost is Claude Code's estimate, and Haiku
  cost is list-price arithmetic (see "Cost").
- **Not recorded:** the stetdoc commit (setup-arms.sh prints it only to its own stdout), the ooxml-validate build, the
  Node version used for the runs and the judge's vote count. The run commit is inferred from file times.
- **Word.** All 651 written files were opened in Word in final-2, although the default path opens only a sample of the
  files both machine checks pass (see "How grading works"). By triage class, Word gave a repair prompt for 15 of 123
  flagged files, 1 of 17 sampled files and 6 of 511 clean files, so 7 files that passed both machine checks still
  prompted a repair. The verdict is that of one Word version on one Mac. The case README that records the Word version
  (16.114.3) was edited after the run; at 2ce4d25 it said 16.114.1.
- **anthropic-legal and the stale case were not run for Gemini.** The legal plugin is not wired for agy, and agy's
  print mode cannot seed a conversation.
- **Concurrency on the stale case.** Two runs of the stale case at the same time share one resumed conversation, so
  `run-all.sh` runs it alone with `-j 1`. The Claude `short` part also ran it at `-j 4`; those 50 runs are saved but
  not scored (scripts/analyze.mjs line 34).
- **One reader.** stetdoc reads the outputs for the content checks (`stetdoc view`), for every arm. No second reader
  is used.

## Licence

MIT, see [LICENSE](LICENSE). The rubrics and the long tasks' quoted instructions come from Harvey LAB (MIT, Harvey AI);
see [NOTICE.md](NOTICE.md). The test documents are fetched from Harvey LAB at setup and are not stored here. The arms
are cloned at setup under their own licences.
