# Environment variables

Every variable the scripts read, with its default. None of the defaults points at a private machine or service.
`bench.sh` and `agy-bench.mjs` strip the benchmark variables from the agent's environment.

| Variable | Read by | Default / when unset |
|---|---|---|
| `ARMS` | bench.sh, setup-arms.sh, agy-bench.mjs | `/tmp/bench-arms` |
| `TOOLS` | bench.sh, setup-tools.sh, agy-bench.mjs | `/tmp/bench-tools` |
| `STETDOC_REPO` | setup-arms.sh | unset: the stetdoc arm is not copied into `ARMS` (copied from `$STETDOC_REPO/plugins/claude` when set) |
| `STETDOC_BIN` | bench.sh, agy-bench.mjs | `stetdoc` on PATH |
| `OOXML_VALIDATE` | bench.sh, agy-bench.mjs | `ooxml-validate` on PATH; without it the validity criterion reports "unavailable" |
| `STETDOC_CORPUS_DIR` | fetch-fixtures.sh | `$HOME/.cache/stetdoc/corpora` (a local cache, checked before downloading) |
| `MODEL` | bench.sh | `claude-opus-5-5` |
| `JUDGE` | bench.sh, agy-bench.mjs | `claude-sonnet-5-5`; `JUDGE=0` skips llm graders in agy-bench.mjs |
| `KEEP_OUTPUTS` | bench.sh, run-all.sh, agy-bench.mjs | unset; `1` keeps each run's new or changed .docx under `<out>/outputs/` |
| `KEEP` | agy-bench.mjs | unset; `1` keeps the run roots |
| `GOOGLE_APPLICATION_CREDENTIALS` | bench.sh | `$HOME/.config/gcloud/application_default_credentials.json` if that file exists (Claude Code on Vertex AI) |
| `TMPDIR` | bench.sh | `/tmp` |
| `TAG` | run-all.sh, agy-run-all.sh | required (exits with "set TAG") |
| `RUNS` | run-all.sh, agy-run-all.sh | `5` |
| `LONG_RUNS` | run-all.sh, agy-run-all.sh | `1` (run-all.sh), `2` (agy-run-all.sh) |
| `J` | run-all.sh, agy-run-all.sh | `4` (run-all.sh), `3` (agy-run-all.sh) |
| `MODELS` | run-all.sh | `claude-opus-5-5 claude-haiku-5-5` |
| `ARMS_LIST` | run-all.sh | `stetdoc none anthropic-docx anthropic-legal adeu` |
| `CAP` | run-all.sh | `20` (`--max-cost-usd` per invocation) |
| `AGY` | agy-bench.mjs | `~/.local/bin/agy` (the Antigravity CLI's install location) |
| `AGY_MODEL` | agy-bench.mjs | `gemini-3.8-flash-medium` |
| `AGY_MODELS`, `AGY_ARMS` | agy-run-all.sh | `gemini-3.8-flash-medium`; `stetdoc none anthropic-docx adeu` |
| `AGY_TIMEOUT` | agy-bench.mjs | `1800` seconds per run |
| `AGY_SANDBOX` | agy-bench.mjs | sandboxed on macOS; `0` turns the sandbox off |
| `GEMINI_API_KEY` | agy-bench.mjs, fit-check-ar.mjs | required; the script exits with a message naming it |
| `GOOGLE_GEMINI_BASE_URL` | agy-bench.mjs | unset: not passed, so agy uses Google's public Gemini API endpoint |
| `GEMINI_URL` | fit-check-ar.mjs | `https://generativelanguage.googleapis.com` |
| `VOTES` | judge.mjs | `1` |
| `SAMPLE` | word-validity.mjs | `20` |
| `WORD_CHECK` | word-validity.mjs | required in `word` mode (exits with a message naming it); an executable `WORD_CHECK FILE SHOTS_DIR` that opens FILE in Word and prints `FILE<TAB>VERDICT<TAB>DIALOG[<TAB>SCREENSHOT]`. Not in this repository; `batch`/`import` work without it |
| `CUA_SESSION` | word-validity.mjs | set to `word-validity-<pid>` for the Word driver |
| `BUILD_FIXTURES_LOG` | build-fixtures.py | unset; set, it prints the build log at the end |

Set by the runners for the harness (`suite/evals/harness/report.sh`, `suite/evals/lib/scaffold.sh`), not by hand:
`EVAL_STETDOC_BIN`, `EVAL_OOXML_VALIDATE`, `EVAL_STETDOC_METRICS`, `EVAL_KEEP_OUTPUTS`, `CLAUDE_PROJECT_DIR`.

## Tests

`node --test scripts/test/` runs the script tests.
