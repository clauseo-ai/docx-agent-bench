#!/usr/bin/env bash
# Fetches the test documents into suite/evals/fixtures/ and suite/evals/long-fixtures/, verified by
# SHA-256. They come from Harvey LAB (harveyai/harvey-labs, MIT) at a pinned commit and are never
# committed here. A stetdoc corpus cache (STETDOC_CORPUS_DIR, else ~/.cache/stetdoc/corpora) is used
# when it holds a document; everything else is downloaded from GitHub.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd); E=$root/suite/evals
commit=465d1fcf270daa01b0d1d63e30e3da9876d7a268
cache=${STETDOC_CORPUS_DIR:-$HOME/.cache/stetdoc/corpora}
sha256() { if command -v sha256sum >/dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1; }
get() { # sha path out
  if [ -f "$3" ] && [ "$(sha256 "$3")" = "$1" ]; then return; fi
  mkdir -p "$(dirname "$3")"
  if [ -f "$cache/blobs/${1:0:2}/$1" ]; then cp "$cache/blobs/${1:0:2}/$1" "$3.part"
  else curl -fsSL "https://raw.githubusercontent.com/harveyai/harvey-labs/$commit/$2" -o "$3.part"; fi
  [ "$(sha256 "$3.part")" = "$1" ] || { rm -f "$3.part"; echo "error: $2 does not match $1" >&2; exit 1; }
  chmod 644 "$3.part"; mv "$3.part" "$3"; echo "fetched $(basename "$3")"
}
grep -v '^#' "$E/fixtures.tsv" | while IFS=$'\t' read -r name sha path; do get "$sha" "$path" "$E/fixtures/$name.docx"; done
grep -v '^#' "$E/long-fixtures.tsv" | while IFS=$'\t' read -r task file sha path; do get "$sha" "$path" "$E/long-fixtures/$task/$file"; done
echo "fixtures ok"
