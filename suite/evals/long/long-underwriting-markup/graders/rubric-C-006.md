---
type: regex
pattern: '-- final text[\s\S]*(?:\b(?:[1-6]?\d|7[0-5])\)?[- ]days?\b[^\n]*lock-up|lock-up[^\n]*\b(?:[1-6]?\d|7[0-5])\)?[- ]days?\b)'
flags: i
target: { source: file, path: .eval-report.txt }
---

Rubric C-006 (exact string): read as final, a lock-up paragraph sets a period of 75 days or less (the rubric accepts
60 days too). The draft's lock-up paragraphs say ninety (90) days.
