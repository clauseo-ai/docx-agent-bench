---
type: regex
pattern: '^  \{c\d+ \S+ [\d-]+\} (?=[^\n]*(?:\b2 ?x\b|2×|two times|twice|doubl|200 ?%))(?=[^\n]*(?:month|annual|year))'
flags: mi
target: { source: file, path: .eval-report.txt }
---

The comment asks for the cap to be raised to twice (2x, two times, double, 200%) the amount over the twelve-month
(annual, yearly) period, in any wording.
