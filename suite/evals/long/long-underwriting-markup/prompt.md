---
description: "Harvey LAB long task (long-underwriting-markup), adapted only to say where the files are and that the annotations are comments."
tags: [long]
plugins: ["../../arm", "../../harness"]
max_turns: 120
timeout_seconds: 1800
allowed_tools: [Read, Glob, Grep, Skill, Bash, Edit, Write]
---

The documents are in docs/: initial-draft-underwriting-agreement.docx (the agreement to mark up), issuer-markup-playbook.docx (the playbook), executed-term-sheet.docx (the term sheet), board-resolutions.docx (the board resolutions), prior-underwriting-agreement-nov2023.docx (the prior deal) and gc-disclosure-email.eml (the GC email).

Redline the attached underwriting agreement from the issuer's perspective, cross-referencing the playbook, term sheet, board resolutions, prior deal, and GC email; annotate each change with its basis in a comment.

Output: `marked-up-underwriting-agreement.docx`. Save it as a new file in docs/ and leave initial-draft-underwriting-agreement.docx unchanged.
