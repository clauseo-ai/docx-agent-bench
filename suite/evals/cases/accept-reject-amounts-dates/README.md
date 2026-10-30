# accept-reject-amounts-dates

**Document.** `swap-confirmation-counterparty.docx`, built by `scripts/build-fixtures.py` from Harvey LAB's
`tidemark-draft-confirmation.docx` (harveyai/harvey-labs, MIT, commit 465d1fcf…; see NOTICE.md). The builder adds 26
tracked changes by "Counterparty Counsel" as raw WordprocessingML (Python standard library, no tool from the
comparison). Each change is a word or a phrase inside a paragraph or table cell. No change depends on another.

**The answer.** Reject 7 changes, accept 19.

| # | change | answer |
|---|---|---|
| 2 | Effective Date July 22, 2025 → July 29, 2025 | reject (date) |
| 3 | Notional Amount USD 250,000,000 (two hundred fifty million → 200,000,000 (two hundred million | reject (amount) |
| 5 | Fixed Rate Payer Payment Dates commencing January 22, 2026 → July 22, 2026 | reject (date) |
| 17 | Threshold, Party A, USD 10,000,000 → 20,000,000 | reject (amount) |
| 18 | Minimum Transfer Amount, Party A, USD 500,000 → 250,000 | reject (amount) |
| 20 | Rounding, Party A, USD 10,000 → 50,000 | reject (amount) |
| 21 | Credit Agreement dated as of March 14, 2025 → March 17, 2025 | reject (date) |
| 1, 4, 6–16, 19, 22–26 | wording, obligations, discretion standards, collateral types, governing law (New York → Delaware), a notice addressee's title, deletions of words | accept |

No accepted change adds, removes or alters a number, a period, a percentage, a count or a rating.

**Grading** (deterministic, no judge). `new-file` (a .docx was written; asking instead fails), `original-unchanged`,
`all-resolved` (no tracked change left in any written .docx) and `expected-text`: read as final, every written .docx has
exactly the text of `swap-confirmation-counterparty.expected.docx` read as final (the base with the 19 accepted changes
applied), whitespace-normalized and ignoring empty paragraphs. The scaffold names that reference in
`.eval-state/expected-final`; it is never copied into the workspace. The reply's list of rejected changes is not graded.
Validity (opens in Word) is applied to every run after the run, as for every case.

**Fit check** (2026-10-30, `scripts/fit-check-ar.mjs`). The 26 changes as text only (deleted / inserted text with
context, in document order, no labels), with the prompt, were given to two models that are not in the benchmark:
claude-sonnet-5-5 (`claude -p`, no tools) and gemini-4-argon (through the local Gemini API proxy). Each classified every
change ACCEPT or REJECT and listed any it found debatable. Both matched the intended answer exactly (0 mismatches of 26)
and both listed no change as debatable. The prompt is unchanged from the draft.

**Fixture checks.** Open XML SDK validator: no error the base does not have (the base's own 5 table-border order errors
remain). `stetdoc check`: no new finding. Microsoft Word for Mac 16.114.3 (build 16.114.26102720, in a macOS VM): opens with no error and no repair prompt, as does the `.expected` reference.
