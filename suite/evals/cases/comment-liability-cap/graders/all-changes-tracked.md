---
type: regex
pattern: '^untracked-diff:'
flags: m
match: not_contains
target: { source: file, path: .eval-report.txt }
---

Accuracy: every change is a tracked change: with all revisions rejected, the text is the original's.
