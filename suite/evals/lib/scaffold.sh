#!/usr/bin/env bash
# Shared scaffold of every case: arm-neutral. stetdoc is called by absolute path (the
# agent's PATH may not have it), the stetdoc author config is written only for the stetdoc arm, and
# the state directory has a neutral name.
set -euo pipefail
evals_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
STETDOC=$(cat "$evals_dir/stetdoc-bin")   # written by bench.sh
state="$HOME/.eval-state"
sha256() { if command -v sha256sum >/dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1; }

author_config() {
  if [ "$(cat "$evals_dir/arm-name" 2>/dev/null)" = stetdoc ]; then
    mkdir -p "$HOME/.config/stetdoc"; printf 'author = "Eval Reviewer"\n' > "$HOME/.config/stetdoc/config.toml"
  fi
}

# setup NAME...: copies each fixture to docs/NAME.docx and records the case. The first fixture is
# the base both for "final text" and "text with every revision rejected" unless the case overrides
# base-final / base-original after setup.
setup() {
  mkdir -p docs "$state"
  for name in "$@"; do
    local want src
    want=$(awk -F'\t' -v n="$name" '$1 == n { print $2 }' "$evals_dir/fixtures.tsv")
    src="$evals_dir/fixtures/$name.docx"
    [ -f "$src" ] || { echo "missing $src" >&2; exit 1; }
    [ "$(sha256 "$src")" = "$want" ] || { echo "$src does not match fixtures.tsv" >&2; exit 1; }
    cp "$src" "docs/$name.docx"
    # The corpus cache stores documents read-only; a user's documents are writable.
    chmod u+w "docs/$name.docx"
  done
  author_config
  basename "$(cd "$(dirname "$0")" && pwd)" > "$state/case"
  echo "./docs/$1.docx" > "$state/base-final"
  echo "./docs/$1.docx" > "$state/base-original"
}

# setup_long TASK MAIN: copies every document of a long task to docs/ (writable); MAIN is the
# document the agent marks up, and the base for the report's diffs.
setup_long() {
  mkdir -p docs "$state"
  local f want
  while IFS="$(printf '\t')" read -r t f want _; do
    [ "$t" = "$1" ] || continue
    cp "$evals_dir/long-fixtures/$1/$f" "docs/$f"; chmod u+w "docs/$f"
    [ "$(sha256 "docs/$f")" = "$want" ] || { echo "docs/$f does not match long-fixtures.tsv" >&2; exit 1; }
  done < "$evals_dir/long-fixtures.tsv"
  author_config
  basename "$(cd "$(dirname "$0")" && pwd)" > "$state/case"
  echo "./docs/$2" > "$state/base-final"
  echo "./docs/$2" > "$state/base-original"
}

snapshot() {
  find . -type f ! -path './.eval*' | sort | while read -r f; do echo "$(sha256 "$f")  $f"; done > "$state/before.sha"
  # The bases' text, read before the agent starts.
  "$STETDOC" view "$(cat "$state/base-final")" --mode final --all > "$state/base-final.txt"
  "$STETDOC" view "$(cat "$state/base-original")" --mode original --all > "$state/base-original.txt"
}
