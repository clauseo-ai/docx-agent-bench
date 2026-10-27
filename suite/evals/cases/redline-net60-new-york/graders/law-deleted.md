---
type: regex
pattern: '^#[\d,]+ delete \S+ \S+ p27[2-4] \"[^\n]*Singapore'
flags: m
target: { source: file, path: .eval-report.txt }
---

Clause 23.1 (p273): Singapore is a tracked deletion by ER.
