---
type: regex
pattern: '^#[\d,]+ [a-z -]+? \S+ \d{4}-\d\d-\d\d p(?!(?:268|273)\b)\d+'
flags: m
match: not_contains
target: { source: file, path: .eval-report.txt }
---

No revision outside the paragraphs the task names (p268 for clause 22.7, p273 for clause 23.1).
