#!/usr/bin/env bash
# Builds every arm's plugin directory under $ARMS (default /tmp/bench-arms), pinned:
#   none             arms/none (an empty plugin)
#   stetdoc          $STETDOC_REPO/plugins/claude (the stetdoc checkout under test)
#   anthropic-docx   anthropics/skills skills/docx as a plugin
#   anthropic-legal  anthropics/knowledge-work-plugins legal/ (its remote MCP connectors are not started)
#   adeu             dealfluence/adeu skills/adeu-redlining plus @adeu/mcp-server, the server it recommends
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd); A=${ARMS:-/tmp/bench-arms}; mkdir -p "$A"
clone() { [ -d "$A/src/$1" ] || git clone -q "https://github.com/$2.git" "$A/src/$1"; git -C "$A/src/$1" checkout -q "$3"; }
clone skills anthropics/skills dbd4588f9e1033efb41dad4bef2f7947c8993d44
clone kwp anthropics/knowledge-work-plugins c75fda00ff0e41c8ee331ae312c8a07f1967653b
clone adeu dealfluence/adeu 557eb3f924e395948ccf6e3f8cb9404da9e39738
rm -rf "$A/anthropic-docx" "$A/anthropic-legal" "$A/adeu" "$A/none"
cp -R "$root/arms/none" "$A/none"
mkdir -p "$A/anthropic-docx/.claude-plugin" "$A/anthropic-docx/skills"
cp -R "$A/src/skills/skills/docx" "$A/anthropic-docx/skills/"
echo '{"name":"document-skills-docx","version":"0.0.0","description":"Anthropic docx skill (anthropics/skills @dbd4588) as a plugin"}' > "$A/anthropic-docx/.claude-plugin/plugin.json"
cp -R "$A/src/kwp/legal" "$A/anthropic-legal"
mkdir -p "$A/adeu/.claude-plugin" "$A/adeu/skills" "$A/adeu-server"
cp -R "$A/src/adeu/skills/adeu-redlining" "$A/adeu/skills/"
(cd "$A/adeu-server" && npm install --silent --no-audit --no-fund @adeu/mcp-server@3.0.7)
echo '{"name":"adeu-redlining","version":"1.14.0","description":"Adeu plugin (dealfluence/adeu @557eb3f) plus @adeu/mcp-server 3.0.7"}' > "$A/adeu/.claude-plugin/plugin.json"
printf '{"mcpServers":{"adeu":{"command":"node","args":["%s/adeu-server/node_modules/@adeu/mcp-server/dist/index.js"]}}}\n' "$A" > "$A/adeu/.mcp.json"
if [ -n "${STETDOC_REPO:-}" ]; then rm -rf "$A/stetdoc"; cp -R "$STETDOC_REPO/plugins/claude" "$A/stetdoc"; echo "stetdoc arm from $STETDOC_REPO @ $(git -C "$STETDOC_REPO" rev-parse --short HEAD)"; fi
echo "arms ok in $A"
