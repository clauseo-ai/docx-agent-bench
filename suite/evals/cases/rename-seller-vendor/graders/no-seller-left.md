---
type: regex
pattern: '-- final text[\s\S]*\bSeller\b'
match: not_contains
target: { source: file, path: .eval-report.txt }
---

Read as final, the result no longer says Seller anywhere.
