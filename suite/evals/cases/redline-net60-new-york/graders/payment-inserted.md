---
type: regex
pattern: '^#[\d,]+ insert \S+ \S+ p14[4-6] \"[^\n]*(sixty|60)'
flags: m
target: { source: file, path: .eval-report.txt }
---

Clause 11.1 (p145): sixty days is a tracked insertion by ER.
