---
description: "Three edits chained into the same redline, the last rejecting the first."
tags: [edit, chain]
plugins: ["../../arm", "../../harness"]
max_turns: 40
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Bash, Edit, Write]
---

In docs/master-supply-agreement.docx, change the payment terms to net 45 days as a tracked change and save the redline as a new file. Then, in that redline, also change the governing law to England and Wales as a tracked change. Finally, we've decided to keep the original payment terms after all, so reject your payment-term change in that redline.
