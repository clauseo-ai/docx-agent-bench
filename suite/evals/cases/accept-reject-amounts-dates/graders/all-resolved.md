---
type: regex
pattern: '^remaining-revisions: [1-9]'
flags: m
match: not_contains
target: { source: file, path: .eval-report.txt }
---

No tracked change is left in any .docx the agent wrote.
