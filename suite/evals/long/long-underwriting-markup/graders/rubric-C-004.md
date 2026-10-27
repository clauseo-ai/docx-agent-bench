---
type: regex
pattern: '-- final text[\s\S]*\$200,000'
target: { source: file, path: .eval-report.txt }
---

Rubric C-004 (exact string): the text read as final has a $200,000 cap.
