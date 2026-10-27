#!/usr/bin/env bash
# The tools every arm's agent gets on PATH (the same for all arms): a Python venv with python-docx,
# lxml, defusedxml and openpyxl, and pandoc. Written to $TOOLS (default /tmp/bench-tools).
set -euo pipefail
T=${TOOLS:-/tmp/bench-tools}
mkdir -p "$T/bin"
# Python 3.10 or later: the skills' scripts use 3.10 syntax (Anthropic's docx skill fails on macOS's python3, 3.9).
py=$(for c in python3.13 python3.12 python3.11 python3.10 python3; do command -v "$c" >/dev/null && "$c" -c 'import sys; sys.exit(sys.version_info < (3, 10))' && { echo "$c"; break; }; done)
[ -n "$py" ] || { echo "need Python 3.10 or later" >&2; exit 1; }
if [ -x "$T/venv/bin/python" ] && ! "$T/venv/bin/python" -c 'import sys; sys.exit(sys.version_info < (3, 10))'; then
  echo "rebuilding $T/venv: it is $("$T/venv/bin/python" --version)"; rm -rf "$T/venv"
fi
[ -x "$T/venv/bin/python" ] || "$py" -m venv "$T/venv"
"$T/venv/bin/pip" -q install defusedxml lxml python-docx openpyxl
if [ ! -x "$T/bin/pandoc" ]; then
  arch=$(uname -m); [ "$arch" = arm64 ] && a=arm64-macOS || a=x86_64-macOS
  curl -fsSL -o "$T/p.zip" "https://github.com/jgm/pandoc/releases/download/3.13/pandoc-3.13-$a.zip"
  (cd "$T" && unzip -q p.zip && cp pandoc-3.13-*/bin/pandoc bin/ && rm -rf p.zip pandoc-3.13-*)
fi
echo "tools ok in $T"
