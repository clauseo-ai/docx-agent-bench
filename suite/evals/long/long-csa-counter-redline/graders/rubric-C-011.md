---
type: regex
pattern: '(minus|less) 5 (basis points|bps|bp)|-\s?5\s?bps'
target: { source: file, path: .eval-report.txt }
---

Rubric C-011 (exact string): €STR minus 5 bps appears.
