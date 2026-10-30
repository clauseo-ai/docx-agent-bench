---
type: regex
pattern: '^created: .*\.docx$'
flags: m
target: { source: file, path: .eval-report.txt }
---

Accuracy: a new .docx was written (asking instead of saving fails).
