#!/usr/bin/env bash
# Benchmark variant of the harness Stop hook: arm-neutral. It calls stetdoc by the absolute path in
# EVAL_STETDOC_BIN, and for every .docx the agent created or changed it reports, besides the check,
# ledger, comments and final text:
#   untracked-diff: lines where the text with every revision rejected differs from base-original
#                   (an edit made without tracking it), and
#   text-diff:      lines where the final text differs from base-final (after the case's normalize.pl),
# each without the paragraph ref, so graders can say which paragraphs changed.
set -uo pipefail
input=$(cat)
cd "${CLAUDE_PROJECT_DIR:-$PWD}" || exit 0
state="$HOME/.eval-state"
report=.eval-report.txt
[ -f "$state/before.sha" ] || exit 0
# stetdoc reads the outputs for every arm; bench.sh writes its absolute path into evals/stetdoc-bin.
S="${EVAL_STETDOC_BIN:-$(cat "$(dirname "$0")/../stetdoc-bin" 2>/dev/null)}"
sha256() { if command -v sha256sum >/dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1; }
on_path=no; command -v stetdoc >/dev/null 2>&1 && on_path=yes

metrics() {
  local t root
  t=$(jq -r '.transcript_path // empty' <<<"$input" 2>/dev/null)
  root=${PWD%/home/cwd}
  if [ -z "$t" ] || [ ! -f "$t" ]; then jq -cn --arg root "$root" --arg case "$(cat "$state/case")" '{case:$case, root:$root}'; return; fi
  jq -cs --arg case "$(cat "$state/case" 2>/dev/null)" --arg root "$root" '
    [.[] | select(.type == "assistant")] as $a
    | [$a[] | .message.content[]? | select(type == "object" and .type == "tool_use")] as $calls
    | ($a | map(select(.message.id != null)) | unique_by(.message.id) | map(.message.usage // {})) as $u
    | { case: $case, root: $root,
        tool_calls: ($calls | length),
        by_tool: ($calls | map(.name) | group_by(.) | map({(.[0]): length}) | add // {}),
        tool_errors: ([.[] | select(.type == "user") | .message.content[]?
                       | select(type == "object" and .type == "tool_result" and .is_error == true)] | length),
        skills: ($calls | map(select(.name == "Skill") | .input.skill)),
        models: ($a | map(select(.message.id != "msg_eval_history_01")) | map(.message.model) | map(select(. != null)) | unique),
        bash: ($calls | map(select(.name == "Bash") | .input.command | .[0:300])),
        input_tokens: ($u | map(.input_tokens // 0) | add // 0),
        cache_creation_tokens: ($u | map(.cache_creation_input_tokens // 0) | add // 0),
        cache_read_tokens: ($u | map(.cache_read_input_tokens // 0) | add // 0),
        output_tokens: ($u | map(.output_tokens // 0) | add // 0),
        haiku_list_cost_usd: ($u | map(((.input_tokens // 0) + (.cache_read_input_tokens // 0) + (.cache_creation_input_tokens // 0)) as $ctx
            | (if $ctx > 100000 then 5 else 1 end) as $k
            | ((.input_tokens // 0) * 0.10 + (.cache_read_input_tokens // 0) * 0.01 + (.cache_creation_input_tokens // 0) * 0.125 + (.output_tokens // 0) * 0.50) * $k / 1000000)
            | add // 0),
        max_request_context: ($u | map((.input_tokens // 0) + (.cache_read_input_tokens // 0) + (.cache_creation_input_tokens // 0)) | max // 0) }' "$t" 2>/dev/null || echo '{}'
}
# violations FILE: stetdoc check's violation count (notes excluded), or -1 when check fails.
violations() {
  local out
  out=$("$S" check "$1" 2>&1) || { echo -1; return; }
  if grep -q '^Validation: no violations' <<<"$out"; then echo 0; else
    sed -n 's/^Validation: \([0-9][0-9]*\) violation.*/\1/p' <<<"$out" | head -1; fi
}
# findings FILE: every check finding, counted by code and part, so a reader can classify them.
findings() { "$S" check "$1" --all 2>&1 | sed -n 's/^  \([a-z_]*\) (\([^) ]*\).*/\1 \2/p' | sort | uniq -c | sed 's/^ */finding: /'; }
# body: the block lines of a view, without their refs.
# Comment anchors ({c58}...{/c58}) are not text, so they are dropped.
body() { grep -E '^[ptr][0-9]+ ' | sed -E 's/^[ptr][0-9]+ //; s/\{\/?c[0-9]+\}//g'; }
m=$(metrics)
[ -n "${EVAL_STETDOC_METRICS:-}" ] && echo "$m" >> "$EVAL_STETDOC_METRICS"

{
  echo "eval-report 2"
  echo "metrics: $m"
  echo "stetdoc-on-path: $on_path"
  worst=0
  while read -r sum path; do
    if [ ! -e "$path" ]; then echo "deleted: $path"
    elif [ "$(sha256 "$path")" = "$sum" ]; then echo "unchanged: $path"
    else echo "changed: $path"; fi
    if [[ "$path" == "$(cat "$state/base-final")" || "$path" == "$(cat "$state/base-original")" ]]; then v=$(violations "$path"); [ "${v:-0}" -gt "$worst" ] && worst=$v; fi
  done < "$state/before.sha"
  find . -type d -name '*.stet' -prune -o -type f ! -name "$report" -print | sort | while read -r f; do
    grep -q "  $f\$" "$state/before.sha" || echo "created: $f"
  done
  find . -type d -name '*.stet' -prune -print | sort | sed 's/^/leftover-working-copy: /'
  norm="$(dirname "$0")/../cases/$(cat "$state/case")/normalize.pl"
  find . -type d -name '*.stet' -prune -o -type f -name '*.docx' -print | sort | while read -r f; do
    before=$(grep "  $f\$" "$state/before.sha" | cut -d' ' -f1)
    [ -n "$before" ] && [ "$before" = "$(sha256 "$f")" ] && continue
    echo
    echo "== $f"
    v=$(violations "$f"); v=${v:--1}
    # Valid: no more violations than the edited base, or only stetdoc lints Word accepts (class b).
    if [ "$v" -ge 0 ] && { [ "$v" -le "$worst" ] || ! findings "$f" | grep -qvE ' (schema_non_canonical_order|empty_properties|para_id_missing) '; }; then echo "valid: yes"; else echo "valid: no"; fi
    echo "violations: $v (inputs at most $worst)"
    ledger=$("$S" view "$f" --revisions --full --all 2>&1)
    n=$(sed -n 's/^{summary: \([0-9][0-9]*\) tracked change.*/\1/p' <<<"$ledger" | head -1)
    echo "remaining-revisions: ${n:-0}"
    "$S" view "$f" --mode original --all 2>/dev/null | body > "$state/out-original.txt"
    "$S" view "$f" --mode final --all 2>/dev/null | body > "$state/out-final.txt"
    body < "$state/base-original.txt" > "$state/b-original.txt"
    if [ -f "$norm" ]; then body < "$state/base-final.txt" | perl -p "$norm" > "$state/b-final.txt"; else body < "$state/base-final.txt" > "$state/b-final.txt"; fi
    diff "$state/b-original.txt" "$state/out-original.txt" | grep '^[<>]' | head -3000 | cut -c1-1500 | sed 's/^/untracked-diff: /'
    diff "$state/b-final.txt" "$state/out-final.txt" | grep '^[<>]' | head -3000 | cut -c1-1500 | sed 's/^/text-diff: /'
    echo "-- check"; "$S" check "$f" 2>&1 | grep '^Validation'; findings "$f"
    echo "-- revisions"; echo "$ledger"
    echo "-- comments"; "$S" view "$f" --comments --all 2>&1
    echo "-- final text"; "$S" view "$f" --mode final --all 2>&1
  done
} > "$report" 2>&1
# Keep a copy of the report next to the metrics, as evidence for the benchmark write-up.
if [ -n "${EVAL_STETDOC_METRICS:-}" ]; then
  keep="$(dirname "$EVAL_STETDOC_METRICS")/reports"; mkdir -p "$keep"
  cp "$report" "$keep/$(cat "$state/case")-$(basename "${PWD%/home/cwd}").txt" 2>/dev/null
  t=$(jq -r '.transcript_path // empty' <<<"$input" 2>/dev/null)
  [ -n "$t" ] && [ -f "$t" ] && cp "$t" "$keep/$(cat "$state/case")-$(basename "${PWD%/home/cwd}").transcript.jsonl" 2>/dev/null
fi
exit 0
