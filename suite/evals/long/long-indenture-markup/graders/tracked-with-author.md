---
type: regex
pattern: '^\{authors: .*\"[^\"]+\"'
flags: m
target: { source: file, path: .eval-report.txt }
---

Accuracy: the redline has tracked changes under a non-empty author name.
