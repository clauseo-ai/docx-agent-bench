---
type: regex
pattern: '^valid: yes$'
flags: m
target: { source: file, path: .eval-report.txt }
---

Secondary, not accuracy: stetdoc check finds no more Word-invalid findings than the edited input had.
