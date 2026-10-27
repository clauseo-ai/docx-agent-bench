---
type: regex
pattern: '^text-diff:'
flags: m
match: not_contains
target: { source: file, path: .eval-report.txt }
---

Accuracy: read as final, the text is exactly the revised document's (v2) (no paragraph differs).
