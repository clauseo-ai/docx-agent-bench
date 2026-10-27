---
type: regex
pattern: '^ooxml-valid: yes$'
flags: m
target: { source: file, path: .eval-report.txt }
---

Accuracy: the Open XML SDK validator opens every .docx the agent wrote, and compared with the edited input it finds no new error.
