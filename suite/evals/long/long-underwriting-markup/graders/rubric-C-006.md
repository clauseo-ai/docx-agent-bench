---
type: regex
pattern: '-- final text[\s\S]*(75 days|seventy-five \(75\) days|75-day)'
target: { source: file, path: .eval-report.txt }
---

Rubric C-006 (exact string): the text read as final has a 75-day lock-up.
