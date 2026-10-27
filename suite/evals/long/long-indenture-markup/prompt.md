---
description: "Harvey LAB long task (long-indenture-markup), adapted only to say where the files are."
tags: [long]
plugins: ["../../arm", "../../harness"]
max_turns: 120
timeout_seconds: 1800
allowed_tools: [Read, Glob, Grep, Skill, Bash, Edit, Write]
---

The documents are in docs/: issuer-draft-indenture.docx (the issuer's draft indenture), ip-indenture-playbook.docx (our purchaser's playbook), offering-term-sheet.docx (the term sheet) and catherine-ng-email.eml (Catherine's email).

Redline the draft indenture against our purchaser's playbook, using the term sheet and Catherine's email for context, and produce an annotated markup with an executive summary of deviations. Output: `redlined-indenture-markup.docx`. Save it as a new file in docs/ and leave issuer-draft-indenture.docx unchanged.
