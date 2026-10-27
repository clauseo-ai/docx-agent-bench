---
type: regex
pattern: '-- final text[\s\S]*25%'
target: { source: file, path: .eval-report.txt }
---

Rubric C-002 (exact string): the text read as final has a 25% cap.
