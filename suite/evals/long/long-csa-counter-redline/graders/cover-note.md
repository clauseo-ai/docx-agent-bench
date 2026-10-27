---
type: regex
pattern: '^created: .*cover.*\.docx$'
flags: mi
target: { source: file, path: .eval-report.txt }
---

Accuracy: a cover note .docx was written.
