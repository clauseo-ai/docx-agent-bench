---
type: regex
pattern: '^text-diff: [<>] (?:\{[^}]*\} )*(?!\{)(?!(?:22\.7|23\.1) )'
flags: m
match: not_contains
target: { source: file, path: .eval-report.txt }
---

Accuracy: read as final, only the paragraphs the task names changed (22.7, 23.1); every other paragraph's text is as in the original.
