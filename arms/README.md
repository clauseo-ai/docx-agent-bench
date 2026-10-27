# Arms

| id | what the agent gets | source |
|---|---|---|
| `stetdoc` | the stetdoc Claude Code plugin (skill and docx guard hook) and the `stetdoc` command on PATH, author preset to "Eval Reviewer" | `$STETDOC_REPO/plugins/claude` |
| `none` | no document plugin (`arms/none`) | this repository |
| `anthropic-docx` | Anthropic's docx skill, wrapped as a plugin | anthropics/skills @dbd4588 |
| `anthropic-legal` | Anthropic's legal plugin; its remote MCP connectors are not started | anthropics/knowledge-work-plugins @c75fda0, `legal/` 1.3.0 |
| `adeu` | the adeu-redlining plugin and its recommended Node MCP server, run as a real server | dealfluence/adeu @557eb3f (skill 1.18.2), @adeu/mcp-server 3.0.7 |

Every arm also gets the same tools on PATH: a Python venv (python-docx, lxml, defusedxml, openpyxl) and pandoc 3.13
(`scripts/setup-tools.sh`). In every arm but `stetdoc`, each PATH directory that holds a `stetdoc` command is removed.
The grading hook still calls stetdoc, by absolute path.
