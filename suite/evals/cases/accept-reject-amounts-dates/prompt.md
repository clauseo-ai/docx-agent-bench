---
description: "Resolve 26 counterparty tracked changes: reject the 7 that change a dollar amount or a calendar date, accept the rest."
tags: [edit, revisions]
plugins: ["../../arm", "../../harness"]
max_turns: 40
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Bash, Edit, Write]
---

docs/swap-confirmation-counterparty.docx has the counterparty's tracked changes. Reject the ones that change a dollar amount or a calendar date and accept all the others. Save the result as a new file and tell me which changes you rejected.
