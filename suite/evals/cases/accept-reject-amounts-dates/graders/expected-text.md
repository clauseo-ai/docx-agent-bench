---
type: regex
pattern: '^text-diff:'
flags: m
match: not_contains
target: { source: file, path: .eval-report.txt }
---

Read as final, every .docx the agent wrote has exactly the expected text (whitespace-normalized): the seven changes
to a dollar amount or a calendar date rejected, the other nineteen accepted.
