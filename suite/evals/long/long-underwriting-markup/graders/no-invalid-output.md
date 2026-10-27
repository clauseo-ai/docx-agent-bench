---
type: regex
pattern: '^valid: no$'
flags: m
match: not_contains
target: { source: file, path: .eval-report.txt }
---

Accuracy: no .docx written fails stetdoc check.
