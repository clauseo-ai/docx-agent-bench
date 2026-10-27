---
type: tool_used
tool: Bash
input_match: '\b(unzip|zipinfo|bsdtar|7z|ditto|xmllint|soffice|libreoffice|docx2python|pandoc)\b|document\.xml|word/|\b(python3?|perl|ruby|node)\b.*\.docx'
min: 0
max: 0
arm: both
---

The agent never opens the .docx another way: no unzip, no scripting language, no XML.
