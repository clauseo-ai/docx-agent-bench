#!/usr/bin/env bash
# Runs one arm, one model, one part of the suite with Claude Code's `claude plugin eval`.
#   scripts/bench.sh ARM PART OUT [extra claude plugin eval options]
# PART is short (evals/cases), stale (only stale-colleague-edit), long (evals/long) or without-stetdoc.
# The arm's plugin comes from $ARMS/ARM (scripts/setup-arms.sh). stetdoc is removed from the agent's
# PATH in every arm but stetdoc, and from every arm in without-stetdoc. MODEL picks the agent model.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
arm=$1 part=$2 out=$3; shift 3
mkdir -p "$out"; out=$(cd "$out" && pwd)   # absolute: claude runs from the suite copy
A=${ARMS:-/tmp/bench-arms}; T=${TOOLS:-/tmp/bench-tools}
[ -d "$A/$arm" ] || { echo "no arm $A/$arm: run scripts/setup-arms.sh" >&2; exit 2; }
stetdoc_bin=${STETDOC_BIN:-$(command -v stetdoc)}
suite=$(mktemp -d "${TMPDIR:-/tmp}/bench-suite-XXXXXX")
trap 'rm -rf "$suite"' EXIT
cp -R "$root/suite/evals" "$suite/"; cp -R "$A/$arm/." "$suite/evals/arm"
echo "$arm" > "$suite/evals/arm-name"; echo "$stetdoc_bin" > "$suite/evals/stetdoc-bin"
ooxml=${OOXML_VALIDATE:-$(command -v ooxml-validate || true)}
[ -n "$ooxml" ] && [ -x "$ooxml" ] || echo "warning: no ooxml-validate (set OOXML_VALIDATE); the primary validity check will be unavailable" >&2
echo "$ooxml" > "$suite/evals/ooxml-validate-bin"
mkdir -p "$out"
claude=$(command -v claude)
clean=$(tr ':' '\n' <<<"$PATH" | while read -r d; do [ -n "$d" ] && [ ! -x "$d/stetdoc" ] && echo "$d"; done | paste -sd: -)
# The agent's shell runs in the eval's OS sandbox, which lets it read the loaded plugin folders but not /tmp or the
# temp folder: with $T (default /tmp/bench-tools) on PATH, zsh found no python3 there and ran macOS /usr/bin/python3 3.9
# without python-docx, and pandoc was unreadable (final-1). So the tools are cloned into the harness plugin, which every
# arm loads: cp -c is an APFS clone (no extra space), and -L copies symlinks as files, since the eval's plugin check
# flags a link that leaves the plugin's tree (the venv's python3 links to the base install). A venv runs from a new
# folder when python3 is called directly: it finds pyvenv.cfg next to it.
[ -x "$T/venv/bin/python3" ] && [ -x "$T/bin/pandoc" ] || { echo "no tools in $T: run scripts/setup-tools.sh" >&2; exit 2; }
ht=$suite/evals/harness/tools; mkdir -p "$ht"
cp -RLc "$T/venv" "$T/bin" "$ht/" 2>/dev/null || cp -RL "$T/venv" "$T/bin" "$ht/"
tools=$ht/venv/bin:$ht/bin
if [ "$arm" = stetdoc ] && [ "$part" != without-stetdoc ]; then agentpath=$tools:$(dirname "$stetdoc_bin"):$clean; else agentpath=$tools:$clean; fi
# The grading hook finds the stetdoc and validator paths and the metrics file in the suite copy (evals/stetdoc-bin,
# evals/ooxml-validate-bin, evals/metrics-path), not in the environment: the agent inherits Claude Code's environment,
# so no benchmark variable reaches it (they are removed below).
echo "$out/metrics.jsonl" > "$suite/evals/metrics-path"
# KEEP_OUTPUTS=1: the grading hook also copies each run's new or changed .docx files to $out/outputs/<case>-<id>/.
[ "${KEEP_OUTPUTS:-}" = 1 ] && touch "$suite/evals/keep-outputs"
adc=$HOME/.config/gcloud/application_default_credentials.json
[ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ] && [ -f "$adc" ] && export GOOGLE_APPLICATION_CREDENTIALS=$adc
common=(--scaffold --trust-plugin --ablation none --model "${MODEL:-claude-opus-5-5}" --judge-model "${JUDGE:-claude-sonnet-5-5}" --no-publish
  --allow-tools Bash Edit Write "mcp__plugin_adeu-redlining_adeu__*")
[ "$arm" = adeu ] && common+=(--allow-real-servers)
case "$part" in
  short) dir=evals/cases ;;
  stale) dir=evals/cases; common+=(--case stale-colleague-edit) ;;
  long) dir=evals/long ;;
  without-stetdoc) dir=evals/without-stetdoc ;;
  *) echo "unknown part $part" >&2; exit 2 ;;
esac
cd "$suite"
unset_bench=(-u KEEP_OUTPUTS -u EVAL_STETDOC_BIN -u EVAL_STETDOC_METRICS -u EVAL_OOXML_VALIDATE -u OOXML_VALIDATE -u STETDOC_BIN -u STETDOC_REPO
  -u ARMS -u TOOLS -u MODEL -u JUDGE -u TAG -u RUNS -u LONG_RUNS -u J -u MODELS -u ARMS_LIST -u CAP -u VOTES)
env "${unset_bench[@]}" PATH="$agentpath" "$claude" plugin eval . --eval-dir "$dir" --output-dir "$out/eval" "${common[@]}" "$@" || true
