---
type: regex
pattern: '^== (?![^\n]*cover)[^\n]*\n(?:(?!== )[^\n]*\n)*?-- final text\n(?:(?!== )[^\n]*\n)*?[^\n]*(?:(?:minus|less) 5 (?:basis points|bps|bp)|-\s?5\s?bps)'
flags: m
target: { source: file, path: .eval-report.txt }
---

Rubric C-011 (exact string): €STR minus 5 bps appears in the redline read as final (any written .docx except the
cover note; not the cover note, not the commands the agent ran).
