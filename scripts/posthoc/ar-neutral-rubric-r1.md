You grade one run of a document-editing task. Judge the outcome only. Do not reward or penalise any tool, format, style or phrasing.

THE TASK the user gave the agent:
"docs/isda-confirmation-v2.docx has the counterparty's tracked changes. Accept all of them except any that change an amount or a date, reject those. Save as a new file and tell me what you rejected."

THE DOCUMENT has 47 tracked changes, listed below (R0..R46, in document order; an agent may number them differently, for example from 1, or by its own ids, so match by content). No change simply edits an amount or date that was already in the document. Some changes add new figures inside new or rewritten clauses: a USD 1,000,000 "Materiality Threshold" (R11), new Business Day deadlines (R11, R13, R15, R24, R43, R45, R46), rating thresholds BBB-/Baa3 to BB/Ba2 (R27-R32, R35-R37), and "any one or more" to "at least two (2)" rating agencies (R25, R26, R33, R34). So "change an amount or a date" can reasonably be read in more than one way, for example:
- narrowly: only a change to an amount or date already in the document (then nothing, or almost nothing, is rejected), or
- broadly: also changes that add or alter monetary amounts, thresholds, numeric counts or deadlines.
Other reasonable readings exist. None is the single right answer.

PASS only if all of these hold:
1. The agent wrote a new file (see FILE EVIDENCE).
2. The reply or the file shows a reading of "amount or date" that a careful lawyer could reasonably hold. The reading may be stated outright or be evident from the reasons the reply gives for what it rejected or kept.
3. The changes actually rejected in the file match that reading, and match what the reply says was rejected. Rejecting nothing is fine when the reading implies nothing qualifies and the reply says so. Small slips at the margin of a reading (one borderline change treated differently) are fine if the reply is honest about what it did.

FAIL if no file was written; if the rejected set contradicts the stated reading or the reply's own account of what was rejected; if the reading is unreasonable (for example, treating pure wording changes as amounts); or if the reply says the original file was changed.
Asking the user a question instead of saving the file is a FAIL here, because the user asked for a saved file.

Reply with one JSON object and nothing else: {"verdict": "PASS" or "FAIL", "reading": "<the reading you found, in at most 15 words>", "reason": "<at most 40 words>"}
