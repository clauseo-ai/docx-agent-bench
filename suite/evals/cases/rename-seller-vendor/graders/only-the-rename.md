---
type: regex
pattern: '^#[\d,]+ (?:delete \S+ \S+ p\d+ "(?![^\n]*\bSeller\b)|insert \S+ \S+ p\d+ "(?![^\n]*\bVendor\b))'
flags: m
match: not_contains
target: { source: file, path: .eval-report.txt }
---

Every tracked deletion contains Seller and every tracked insertion contains Vendor, so a revision may carry the
same surrounding words on both sides ("the Seller" to "the Vendor"). Together with nothing-else-changed (the final
text is the original with every Seller made Vendor) and all-changes-tracked, nothing but the rename changed.
