---
type: regex
pattern: '^#[\d,]+ insert \S+ \S+ p27[2-4] \"[^\n]*New York'
flags: m
target: { source: file, path: .eval-report.txt }
---

Clause 23.1 (p273): New York is a tracked insertion by ER.
