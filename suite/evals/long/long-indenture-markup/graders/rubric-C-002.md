---
type: regex
pattern: '-- final text[\s\S]*25%\)? of (?:such |the )?(?:pro forma )?Consolidated EBITDA'
target: { source: file, path: .eval-report.txt }
---

Rubric C-002 (exact string): the text read as final caps the addbacks at 25% of Consolidated EBITDA (the draft says
"at least 25%" elsewhere, so a bare 25% does not count).
