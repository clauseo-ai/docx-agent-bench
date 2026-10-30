---
type: regex
pattern: '-- final text[\s\S]*^[ptr]\d+ [^\n]*\bSeller\b'
flags: m
match: not_contains
target: { source: file, path: .eval-report.txt }
---

Read as final, no paragraph of the result says Seller. Only the document's own lines (p/t/r refs) count, not a
reader's notes about the revisions.
