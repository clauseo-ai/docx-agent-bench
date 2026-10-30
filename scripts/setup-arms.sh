#!/usr/bin/env bash
# Builds every arm's plugin directory under $ARMS (default /tmp/bench-arms), pinned:
#   none             arms/none (an empty plugin)
#   stetdoc          $STETDOC_REPO/plugins/claude (the stetdoc checkout under test)
#   anthropic-docx   anthropics/skills skills/docx as a plugin
#   anthropic-legal  anthropics/knowledge-work-plugins legal/ (its remote MCP connectors are not started)
#   adeu             dealfluence/adeu skills/adeu-redlining plus @adeu/mcp-server, the server it recommends
# Pins are each source's latest as of 2026-10-30: anthropics/skills main ca45fc4 (2026-10-28), knowledge-work-plugins
# main 2574e29 (2026-10-27), dealfluence/adeu release v3.0.7 (096baa8, 2026-10-05) with @adeu/mcp-server 3.0.7.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd); A=${ARMS:-/tmp/bench-arms}; mkdir -p "$A"
clone() { [ -d "$A/src/$1" ] || git clone -q "https://github.com/$2.git" "$A/src/$1"
  git -C "$A/src/$1" cat-file -e "$3^{commit}" 2>/dev/null || git -C "$A/src/$1" fetch -q origin; git -C "$A/src/$1" checkout -q "$3"; }
clone skills anthropics/skills ca45fc496a3436251f191354091d557da31c15b5
clone kwp anthropics/knowledge-work-plugins 2574e29377c7173d0cecffef29a6ecbd7f8ccb5d
clone adeu dealfluence/adeu 096baa88b8ea6980ad305abaae8e31b49c3c3918
rm -rf "$A/anthropic-docx" "$A/anthropic-legal" "$A/adeu" "$A/none"
cp -R "$root/arms/none" "$A/none"
mkdir -p "$A/anthropic-docx/.claude-plugin" "$A/anthropic-docx/skills"
cp -R "$A/src/skills/skills/docx" "$A/anthropic-docx/skills/"
echo '{"name":"document-skills-docx","version":"1.0.0","description":"Anthropic docx skill (anthropics/skills main @ca45fc4; the marketplace version, 1.0.0) as a plugin"}' > "$A/anthropic-docx/.claude-plugin/plugin.json"
cp -R "$A/src/kwp/legal" "$A/anthropic-legal"
mkdir -p "$A/adeu/.claude-plugin" "$A/adeu/skills" "$A/adeu-server"
cp -R "$A/src/adeu/skills/adeu-redlining" "$A/adeu/skills/"
(cd "$A/adeu-server" && npm install --silent --no-audit --no-fund @adeu/mcp-server@3.0.7)
echo '{"name":"adeu-redlining","version":"1.14.0","description":"Adeu plugin (dealfluence/adeu v3.0.7 @096baa8) plus @adeu/mcp-server 3.0.7"}' > "$A/adeu/.claude-plugin/plugin.json"
printf '{"mcpServers":{"adeu":{"command":"node","args":["%s/adeu-server/node_modules/@adeu/mcp-server/dist/index.js"]}}}\n' "$A" > "$A/adeu/.mcp.json"
if [ -n "${STETDOC_REPO:-}" ]; then rm -rf "$A/stetdoc"; cp -R "$STETDOC_REPO/plugins/claude" "$A/stetdoc"; echo "stetdoc arm from $STETDOC_REPO @ $(git -C "$STETDOC_REPO" rev-parse --short HEAD)"; fi
echo "arms ok in $A"
