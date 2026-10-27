#!/usr/bin/env bash
# The Antigravity half of a frozen run: every arm, short tasks (RUNS runs each; the stale case is not run with agy),
# the not-installed case for the stetdoc arm, and the long tasks (LONG_RUNS runs each). Same layout as run-all.sh.
#   TAG=frozen-1 RUNS=5 LONG_RUNS=2 AGY_MODELS="gemini-3.8-flash-medium" AGY_ARMS="stetdoc none anthropic-docx adeu" scripts/agy-run-all.sh
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
TAG=${TAG:?set TAG}; RUNS=${RUNS:-5}; LONG_RUNS=${LONG_RUNS:-2}; J=${J:-3}
AGY_MODELS=${AGY_MODELS:-gemini-3.8-flash-medium}; AGY_ARMS=${AGY_ARMS:-stetdoc none anthropic-docx adeu}
for model in $AGY_MODELS; do for arm in $AGY_ARMS; do
  o=$root/results/$TAG/$model/$arm; mkdir -p "$o"
  AGY_MODEL=$model node "$root/scripts/agy-bench.mjs" "$arm" short "$o/short" --runs "$RUNS" -j "$J" > "$o.short.log" 2>&1 || true
  [ "$arm" = stetdoc ] && { AGY_MODEL=$model node "$root/scripts/agy-bench.mjs" "$arm" without-stetdoc "$o/without-stetdoc" --runs "$RUNS" -j "$J" > "$o.without.log" 2>&1 || true; }
  AGY_MODEL=$model node "$root/scripts/agy-bench.mjs" "$arm" long "$o/long" --runs "$LONG_RUNS" -j "$J" > "$o.long.log" 2>&1 || true
done; done
echo "done $TAG (agy)"
