---
type: regex
pattern: '^#[\d,]+ delete \S+ \S+ p14[4-6] \"[^\n]*(thirty|30)'
flags: m
target: { source: file, path: .eval-report.txt }
---

Clause 11.1 (p145): the thirty-day term is a tracked deletion.
