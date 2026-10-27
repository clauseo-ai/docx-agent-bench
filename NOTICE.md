# Third-party material

- **Harvey LAB** (https://github.com/harveyai/harvey-labs, MIT licence, commit 465d1fcf270daa01b0d1d63e30e3da9876d7a268).
  The test documents of every case come from it. They are fetched by SHA-256 at setup (`scripts/fetch-fixtures.sh`) and
  are not stored in this repository. `rubrics/*.json` are the `criteria` of three Harvey LAB tasks
  (`tasks/capital-markets/draft-markup-of-indenture`, `tasks/capital-markets/draft-markup-of-underwriting-agreement`,
  `tasks/contracts/banking/credit-support-annex-first-turn-redline`), copied unchanged, as are the task instructions that the
  long cases' prompts quote. Copyright Harvey AI, used under the MIT licence.
- **Arms.** `scripts/setup-arms.sh` clones, at pinned commits, anthropics/skills (the docx skill),
  anthropics/knowledge-work-plugins (legal) and dealfluence/adeu, and installs @adeu/mcp-server 3.0.7 from npm. None of
  them is stored here; their own licences apply.
