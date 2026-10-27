---
type: regex
pattern: '-- final text[\s\S]*(18 months|eighteen \(18\) months|18-month)'
target: { source: file, path: .eval-report.txt }
---

Rubric C-003 (exact string): the text read as final says 18 months.
