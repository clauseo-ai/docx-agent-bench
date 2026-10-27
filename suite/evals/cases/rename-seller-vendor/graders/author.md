---
type: regex
pattern: '^\{authors: .*\"[^\"]+\"'
flags: m
target: { source: file, path: .eval-report.txt }
---

Accuracy: the changes are tracked under a non-empty author name (any name; the report lists it).
