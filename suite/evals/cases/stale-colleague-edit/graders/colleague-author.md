---
type: regex
pattern: '^\{authors: .*\"Dana Colleague\"'
flags: m
target: { source: file, path: .eval-report.txt }
---

Accuracy: the colleague's revision is still attributed to Dana Colleague.
