#!/usr/bin/env bash
# The whole benchmark for one tag: every model and arm, short tasks (RUNS runs each, the stale case
# alone with -j 1, because concurrent runs of a resumed conversation share one session), the
# not-installed case for the stetdoc arm, and the long tasks (LONG_RUNS runs each).
#   TAG=frozen-1 RUNS=5 LONG_RUNS=1 MODELS="claude-opus-5-5 claude-haiku-5-5" ARMS_LIST="stetdoc none anthropic-docx anthropic-legal adeu" scripts/run-all.sh
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
TAG=${TAG:?set TAG}; RUNS=${RUNS:-5}; LONG_RUNS=${LONG_RUNS:-1}; J=${J:-4}
MODELS=${MODELS:-claude-opus-5-5 claude-haiku-5-5}; ARMS_LIST=${ARMS_LIST:-stetdoc none anthropic-docx anthropic-legal adeu}
CAP=${CAP:-20}   # --max-cost-usd per invocation
for model in $MODELS; do for arm in $ARMS_LIST; do
  o=$root/results/$TAG/$model/$arm; mkdir -p "$o"
  MODEL=$model "$root/scripts/bench.sh" "$arm" short "$o/short" --runs "$RUNS" -j "$J" --max-cost-usd "$CAP" > "$o.short.log" 2>&1 || true
  MODEL=$model "$root/scripts/bench.sh" "$arm" stale "$o/stale" --runs "$RUNS" -j 1 --max-cost-usd "$CAP" > "$o.stale.log" 2>&1 || true
  [ "$arm" = stetdoc ] && MODEL=$model "$root/scripts/bench.sh" "$arm" without-stetdoc "$o/without-stetdoc" --runs "$RUNS" -j "$J" --max-cost-usd "$CAP" > "$o.without.log" 2>&1 || true
  MODEL=$model "$root/scripts/bench.sh" "$arm" long "$o/long" --runs "$LONG_RUNS" -j 3 --max-cost-usd "$CAP" > "$o.long.log" 2>&1 || true
done; done
echo "done $TAG"
