---
type: regex
pattern: '^== (?![^\n]*cover)[^\n]*\n(?:(?!== )[^\n]*\n)*?-- final text\n(?:(?!== )[^\n]*\n)*?[^\n]*40%'
flags: m
target: { source: file, path: .eval-report.txt }
---

Rubric C-018 (exact string): a 40% concentration limit appears in the redline read as final (any written .docx except
the cover note).
