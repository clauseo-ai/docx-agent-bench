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
# The neutral validity check: the Open XML SDK validator (ooxml-validate). bench.sh writes its path into
# evals/ooxml-validate-bin from OOXML_VALIDATE; without it the report says "ooxml-valid: unavailable".
O="${EVAL_OOXML_VALIDATE:-$(cat "$(dirname "$0")/../ooxml-validate-bin" 2>/dev/null)}"
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
# class_a FILE: the number of findings Word would reject or repair (everything but the lints below).
class_a() { "$S" check "$1" --all 2>&1 | grep -E '^  [a-z_]+ \(' | grep -vcE '^  (schema_non_canonical_order|empty_properties|para_id_missing) \(' || true; }
# findings FILE: every check finding, counted by code and part, so a reader can classify them.
findings() { "$S" check "$1" --all 2>&1 | sed -n 's/^  \([a-z_]*\) (\([^) ]*\).*/\1 \2/p' | sort | uniq -c | sed 's/^ */finding: /'; }
# body: the block lines of a view, without their refs.
# Comment anchors ({c58}...{/c58}) are not text, so they are dropped.
# A block the view wraps continues on the next lines after a trailing backslash; those are joined, so a
# wrap that falls elsewhere (the lines of the two modes differ in length) is not a difference.
body() {
  awk '
    /^[ptr][0-9]+ / { if (cur != "") print cur; cur = $0; next }
    cur != "" && cur ~ /\\$/ { sub(/ *\\$/, "", cur); cur = cur " " $0; next }
  END { if (cur != "") print cur }' | sed -E 's/^[ptr][0-9]+ //; s/\{\/?c[0-9]+\}//g; s/\{joins-next\} ?//g; s/ +/ /g'
}
m=$(metrics)
[ -n "${EVAL_STETDOC_METRICS:-}" ] && echo "$m" >> "$EVAL_STETDOC_METRICS"

{
  echo "eval-report 2"
  echo "metrics: $m"
  echo "stetdoc-on-path: $on_path"
  worst=0 worst_a=0
  while read -r sum path; do
    if [ ! -e "$path" ]; then echo "deleted: $path"
    elif [ "$(sha256 "$path")" = "$sum" ]; then echo "unchanged: $path"
    else echo "changed: $path"; fi
    if [[ "$path" == "$(cat "$state/base-final")" || "$path" == "$(cat "$state/base-original")" ]]; then
      v=$(violations "$path"); [ "${v:-0}" -gt "$worst" ] && worst=$v
      a=$(class_a "$path"); [ "${a:-0}" -gt "$worst_a" ] && worst_a=$a
    fi
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
    # Valid: no more findings Word would reject or repair than the edited base has. The lints Word
    # accepts (non-canonical order, empty properties, a missing paragraph id) and notes do not count.
    # Validity, primary: the Open XML SDK validator opens the file, and compared with the edited input
    # (count-based: a group of errors is new only where the output has more than the input) nothing is new.
    base=$(cat "$state/base-final")
    if [ -n "$O" ] && [ -x "$O" ]; then
      oj=$("$O" --compare "$base" "$f" --json 2>/dev/null)
      onew=$(jq -r '.newCount // "error"' <<<"$oj" 2>/dev/null); oopen=$(jq -r '.out.opened // false' <<<"$oj" 2>/dev/null)
      if [ "$oopen" = true ] && [ "$onew" = 0 ]; then echo "ooxml-valid: yes"; else echo "ooxml-valid: no"; fi
      echo "ooxml: opened $oopen, new $onew, output errors $(jq -r '.out.errorCount // "?"' <<<"$oj" 2>/dev/null), input errors $(jq -r '.base.errorCount // "?"' <<<"$oj" 2>/dev/null) ($base)"
      jq -r '.new[]? | "ooxml-new: \(.delta) \(.id) \(.part // "-") \(.description | .[0:200])"' <<<"$oj" 2>/dev/null | head -40
    else
      echo "ooxml-valid: unavailable"
    fi
    # Validity, secondary: stetdoc check, counting only findings Word would reject or repair against the base.
    a=$(class_a "$f")
    if [ "$v" -ge 0 ] && [ "${a:-0}" -le "$worst_a" ]; then echo "valid: yes"; else echo "valid: no"; fi
    echo "class-a findings: ${a:-0} (base at most $worst_a)"
    echo "violations: $v (inputs at most $worst)"
    ledger=$("$S" view "$f" --revisions --full --all 2>&1)
    n=$(sed -n 's/^{summary: \([0-9][0-9]*\) tracked change.*/\1/p' <<<"$ledger" | head -1)
    echo "remaining-revisions: ${n:-0}"
    "$S" view "$f" --mode original --all 2>/dev/null | body > "$state/out-original.txt"
    "$S" view "$f" --mode final --all 2>/dev/null | body > "$state/out-final.txt"
    body < "$state/base-original.txt" > "$state/b-original.txt"
    if [ -f "$norm" ]; then body < "$state/base-final.txt" | perl -p "$norm" > "$state/b-final.txt"; else body < "$state/base-final.txt" > "$state/b-final.txt"; fi
    diff "$state/b-original.txt" "$state/out-original.txt" | grep '^[<>]' | head -3000 | cut -c1-8000 | sed 's/^/untracked-diff: /'
    diff "$state/b-final.txt" "$state/out-final.txt" | grep '^[<>]' | head -3000 | cut -c1-8000 | sed 's/^/text-diff: /'
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
