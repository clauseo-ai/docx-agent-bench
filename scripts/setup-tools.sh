#!/usr/bin/env bash
# The tools every arm's agent gets on PATH (the same for all arms): a Python venv with python-docx,
# lxml, defusedxml and openpyxl, and pandoc. Written to $TOOLS (default /tmp/bench-tools).
set -euo pipefail
T=${TOOLS:-/tmp/bench-tools}
mkdir -p "$T/bin"
[ -x "$T/venv/bin/python" ] || python3 -m venv "$T/venv"
"$T/venv/bin/pip" -q install defusedxml lxml python-docx openpyxl
if [ ! -x "$T/bin/pandoc" ]; then
  arch=$(uname -m); [ "$arch" = arm64 ] && a=arm64-macOS || a=x86_64-macOS
  curl -fsSL -o "$T/p.zip" "https://github.com/jgm/pandoc/releases/download/3.13/pandoc-3.13-$a.zip"
  (cd "$T" && unzip -q p.zip && cp pandoc-3.13-*/bin/pandoc bin/ && rm -rf p.zip pandoc-3.13-*)
fi
echo "tools ok in $T"
