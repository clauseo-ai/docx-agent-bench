---
type: regex
pattern: '^#[\d,]+ insert \S+ \S+ p14[4-6] \"[^\n]*forty-five'
flags: m
target: { source: file, path: .eval-report.txt }
---

ER's turn-1 change (forty-five days in p145) is still a tracked insertion.
