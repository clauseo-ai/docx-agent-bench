---
type: regex
pattern: '-- final text[\s\S]*\$850'
target: { source: file, path: .eval-report.txt }
---

Rubric C-005 (exact string): the text read as final has $850 million.
