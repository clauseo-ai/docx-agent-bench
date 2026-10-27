---
type: regex
pattern: '^== '
flags: m
match: "count:1"
target: { source: file, path: .eval-report.txt }
---

Accuracy: exactly one .docx was written or changed (a new file, or the original with the comment; the prompt does not say which).
