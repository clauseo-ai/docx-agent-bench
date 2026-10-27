---
type: regex
pattern: '^\{threads: [1-9]'
flags: m
target: { source: file, path: .eval-report.txt }
---

Accuracy: the markup is annotated: it has at least one comment.
