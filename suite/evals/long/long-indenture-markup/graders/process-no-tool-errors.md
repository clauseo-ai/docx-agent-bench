---
type: regex
pattern: 'is_error\\?\"?:\s*true'
target: trace
match: not_contains
weight: 0.5
arm: both
---

Process note: no tool call failed.
