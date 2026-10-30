---
type: regex
pattern: '^#[\d,]+ [a-z -]+? \S+ \d{4}-\d\d-\d\d p(?!(?:145|268|273)\b)\d+'
flags: m
match: not_contains
target: { source: file, path: .eval-report.txt }
---

No revision outside the paragraphs the task names (p145, p268, p273).
