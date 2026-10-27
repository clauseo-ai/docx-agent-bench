---
type: regex
pattern: '^created: .*\.docx$'
flags: m
match: not_contains
target: { source: file, path: .eval-report.txt }
---

No .docx was written.
