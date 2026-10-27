---
type: regex
pattern: '^\{authors: .*\"(?!Author\")[^\"]+\"'
flags: m
target: { source: file, path: .eval-report.txt }
---

Accuracy: the redline has tracked changes by an author other than the counterparty's (Author).
