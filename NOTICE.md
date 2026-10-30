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
  `tasks/contracts/banking/credit-support-annex-first-turn-redline`), copied unchanged, as are the task instructions that the
  long cases' prompts quote. Copyright Harvey AI, used under the MIT licence.
- **Arms.** `scripts/setup-arms.sh` clones, at pinned commits, anthropics/skills (the docx skill),
  anthropics/knowledge-work-plugins (legal) and dealfluence/adeu, and installs @adeu/mcp-server 3.0.7 from npm. None of
  them is stored here; their own licences apply.
