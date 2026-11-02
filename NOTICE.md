# Third-party material

- **Harvey LAB** (https://github.com/harveyai/harvey-labs, MIT licence, commit 465d1fcf270daa01b0d1d63e30e3da9876d7a268).
  The test documents of every case come from it. They are fetched by SHA-256 at setup (`scripts/fetch-fixtures.sh`) and
  are not stored in this repository. Five test documents are derived from them by `scripts/build-fixtures.py` (Python
  standard library, byte-deterministic; recorded by SHA-256 as `built:` rows in `suite/evals/fixtures.tsv` and
  `long-fixtures.tsv`): `greenleaf-revised-confirmation` (greenleaf-marked-confirmation with its tracked changes accepted
  and its typed-in markup removed), `swap-confirmation-counterparty` and its `.expected` grading reference
  (tidemark-draft-confirmation with 26 added tracked changes), `master-supply-agreement.redline` (two added tracked
  changes) and the long CSA task's `stonehill-first-markup-csa.docx` (property order fixed to the schema, the
  transmittal banner insertions removed). `rubrics/*.json` are the `criteria` of three Harvey LAB tasks
  (`tasks/capital-markets/draft-markup-of-indenture`, `tasks/capital-markets/draft-markup-of-underwriting-agreement`,
  `tasks/contracts/banking/credit-support-annex-first-turn-redline`), copied unchanged except that each item's
  `deliverables` key is dropped, and the long cases' prompts quote those tasks' instructions (`suite/evals/long/*/prompt.md`). Copyright Harvey AI, used under the MIT licence; its
  text is reproduced below.
- **Arms.** `scripts/setup-arms.sh` clones, at pinned commits, anthropics/skills (the docx skill),
  anthropics/knowledge-work-plugins (legal) and dealfluence/adeu, and installs @adeu/mcp-server 3.0.7 from npm. None of
  them is stored here; their own licences apply.
- **Dealfluence docx-benchmark** (https://github.com/dealfluence/docx-benchmark, AGPL-3.0). An earlier public
  benchmark of agents editing Word documents through tools; `protocol/v2-protocol-draft.md` names it as a possible
  external task set. Nothing from it (cases, prompts, fixtures, graders, code or text) is stored in this repository, in
  any commit; see it at the link above.

## Harvey LAB licence

The following notice applies to `rubrics/*.json` and to the Harvey LAB task instructions quoted in
`suite/evals/long/*/prompt.md` (harveyai/harvey-labs, `LICENSE` at commit 465d1fcf270daa01b0d1d63e30e3da9876d7a268):

```
MIT License

Copyright (c) 2026 Harvey AI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
