---
type: regex
pattern: '^ooxml-valid: no$'
flags: m
match: not_contains
target: { source: file, path: .eval-report.txt }
---

Accuracy: no .docx the agent wrote fails the Open XML SDK validator (fails to open, or has errors the edited input does not).
