> **DRAFT — NOT ADOPTED.** This is a proposed protocol for a v2 benchmark, written 2026-10-28 after the adversarial review of final-1. None of its decisions (models, size, arms, judges, budget) has been made by the maintainer, nothing in it has been run, and it may change before adoption. Adoption will be a separate, dated commit that freezes it.

# Benchmark v2: pre-registered protocol (DRAFT, not adopted)

## Summary: decisions for the maintainer (≈200 words)

1. **Models.** (a) Sonnet 5.5 (Claude Code) and Gemini 3.8 Flash (Antigravity). **Recommended**: two vendors, one frontier-class model. Gemini only if it passes the quota preflight (§7.4); otherwise Haiku 5.5 replaces it. (b) Haiku and Sonnet: all-Anthropic. (c) Haiku, Opus and Gemini: about 2× the cost.
2. **Size.** Minimal: 60 held-out tasks × 2 runs, about **$5.6k**, about 4 weeks. **Recommended.** Cheaper first pass: Sonnet only, 1 run, about $1.6k. Strong: about $18k–30k.
3. **Harvey tasks the stetdoc corpus already used** (almost all redline-turn tasks). **Recommended:** keep them out of the primary set and report a 20-task contaminated set separately. Alternatives: exclude them entirely, or include them.
4. **Prompts.** **Recommended:** Harvey's instructions word for word, plus a fixed neutral preamble. Alternative: also append "show edits as tracked changes".
5. **Third judge** (alongside Sonnet and Gemini Pro). **Recommended:** an OpenAI model (needs an API key, roughly $150–300). Alternative: an open-weight model on Vertex.
6. **stetdoc's docx-guard hook.** **Recommended:** run stetdoc as shipped in the primary results, and run it without the hook as a secondary arm.
7. **MCP tool-schema deferral.** **Recommended:** load MCP tool schemas up front for every MCP arm. Alternative: Claude Code's default.
8. **Vespper.** **Recommended:** strong version only.
9. **python-docx in tool arms.** **Recommended:** available in every arm, and bypass is measured. Alternative: removed, as Vespper did.

---

## 0. Purpose and principle

v1 could not support any comparative claim. It tested on stetdoc's own development evals, read outputs through stetdoc, gave competitor arms a broken Python, and used an LLM rubric that matched stetdoc's skill wording. v2 removes the stetdoc team's influence wherever it can be removed:
- The tasks, rubrics and prompts come from Harvey LAB, written by Harvey.
- Selection uses a random seed nobody can choose.
- stetdoc is frozen before selection.
- Grading uses readers that are not stetdoc.
- Judges come from three model families.
- Competitors review their own configurations.

Whatever the result, it is published with the pre-committed wording in §9.

## 1. Point-by-point answer to the v1 adversarial review

| v1 finding | v2 answer | § |
|---|---|---|
| **C1** The test set was the dev set; stetdoc was iterated on it | Held-out Harvey LAB tasks selected by a public-beacon seed **after** stetdoc is frozen at a public release. Harvey tasks the stetdoc corpus already used are excluded from the primary set. The v1 8 tasks are reported only as a disclosed dev set. | 2, 3 |
| **C2** The validity rule was the validator's opinion; inputs carry the same errors | Primary validity = desktop Word opens the file with no repair prompt, after calibration (fallback: a Word for the web sample). SDK errors become secondary: baseline-subtracted per error signature, reported by class, never part of the primary endpoint. | 5.4 |
| **C3** Python was broken in competitor arms | One union environment (Python 3.12 venv, LibreOffice, pandoc, Poppler, Node) for every arm. A preflight inside the sandbox checks each arm before any run, and no run starts on a failed preflight. LibreOffice is added: Anthropic's skill declares it and v1 lacked it. | 6 |
| **M1** The accept-reject judge rewarded stetdoc's wording; stetdoc passed without writing a file | Harvey's own rubrics, written before stetdoc existed. Judges see deliverables only, never the chat reply. A missing deliverable fails every criterion that references it. | 5.3 |
| **M2** Defective compare fixture | Fixture defects are handled by a pre-run mechanical check. A task is never dropped after outcomes are seen. The dev-set compare fixture is repaired and both grades are shown. | 3.6, 8 |
| **M3** Tracked changes required without being asked | Tracking is checked only where Harvey's instructions or rubric ask for it, using a keyword rule frozen before selection. | 4, 5.2 |
| **M4** Wilson intervals over clustered runs; no multiplicity correction | Task-clustered paired bootstrap with a mixed-model cross-check, Holm correction over the confirmatory family, and minimum task counts sized by power. | 7 |
| **M5** Arm fairness, hook asymmetry, invocation rates, no author review | Each product installed as its docs say. Product-shipped hooks are allowed for everyone; stetdoc also runs without its hook. Invocation and bypass rates are published. Configurations go to authors 14 days before the freeze. | 6 |
| **M6** stetdoc graded its own and others' output | Two independent readers: a purpose-built Python/lxml reader and pandoc, cross-checked. The grading environment contains no stetdoc binary. | 5.1 |
| **M7** dontAsk refusals and sandbox cache errors | `claude -p` in bypass-permissions mode inside an OS sandbox, a writable TMPDIR, and `PYTHONDONTWRITEBYTECODE=1`. Sandbox denials are logged and reported separately. | 6.5 |
| **M8** Run order confounded with arm | Randomized, blocked, interleaved schedule from the beacon seed. | 7.3 |
| **M9** Factual errors in the v1 report | Every number is generated by script from the run table. Deviations go in `DEVIATIONS.md`. The v1 claims are corrected publicly before v2 is published. | 9 |
| Minor: assumed prices, Gemini 429s, same-family judge, Adeu tie | Costs reconciled against billing; written infra-retry rule; three judge families with sensitivity per judge; Adeu's tasks re-run as an external, previously seen set. | 7, 5.3, 3.5 |

## 2. Freeze order (each step is a commit or tag and a public timestamp)

| Step | What is frozen | Evidence |
|---|---|---|
| **T0** | stetdoc public release `vX.Y.Z`: commit, binary sha256, plugin/skill tree hash, hook hash. **No stetdoc change until §9 publication.** | GitHub release, plus the hash list posted publicly (e.g. a GitHub issue in docx-agent-bench). |
| **T1** | This protocol and its scripts: eligibility, contamination scan, selection, schedule generator, readers, integrity checks, judge harness, analysis code. The tag is `v2-protocol`. The future drand round is named here. | Tag sha posted publicly. |
| **T2** | Eligibility table for all 2,010 Harvey units at the pinned Harvey commit, and the contamination list. Both are computed and committed **before** the beacon round is published. | Committed TSVs. |
| **T3** | The beacon round arrives. `select.py` runs and the task list is committed (Harvey unit ids, file sha256s). | `tasks.tsv`. |
| **T4** | Arm configurations, versions and install logs; competitor-author review window (14 days, can overlap T1–T3); preflight logs; pilot on dev tasks only; Word calibration result. | `arms/*.json`, `preflight/*.log`. |
| **T5** | Freeze tag `v2-freeze`. Its annotated message holds: stetdoc release and hashes, every competitor version, CLI versions (`DISABLE_AUTOUPDATER=1`, agy pinned), model ids, judge ids, Word build, validator sha, union-environment lockfile, schedule seed. The analysis scripts are proven to run on pilot output. | Tag sha posted publicly before the first run. |
| **T6** | Runs, then grading, then analysis, then publication. | |

**What may change after T5:**
- Nothing in the arms, tasks, prompts, rubrics, judges or endpoints.
- Harness or grader bug fixes only, under all of these rules:
  1. The fix applies to every arm.
  2. Every affected run is re-graded, or re-run if the run itself was affected.
  3. Both the original and the fixed results are published.
  4. Each fix is logged in `DEVIATIONS.md` with a timestamp and the reason.
- No task or criterion is removed except under the pre-registered sensitivity analyses (§7.6).

The stetdoc team may see the selected tasks after T3. stetdoc is already frozen and every grader is generic or Harvey's, so seeing them can change nothing. The helpers who implement selection should still not report task contents to anyone working on stetdoc until publication.

## 3. Task set

### 3.1 Primary: held-out Harvey LAB editing tasks
- **Source:** github.com/harveyai/harvey-labs at a pinned commit. Use 465d1fc, or the latest commit at T1, recorded in the tag.
- **Size:** 2,010 task units (1,742 base tasks, 27 categories). Each unit has a `task.json` with `instructions`, `deliverables` and inline binary `criteria`: median 54 per unit, maximum 1,114.
- **Exception:** the 498 contracts units have no `deliverables` field; their output name is in `### Output:` inside `instructions`.

### 3.2 Eligibility ("edits an existing .docx"), applied to all 2,010 units before selection
A unit is eligible only if all of these hold:
- At least one deliverable is a `.docx`.
- The instructions direct marking up, revising or editing a provided `.docx`, rather than drafting a new document or memo.
- No deliverable requires `.xlsx` or `.pptx`.
- Arm-neutral feasibility filters, frozen at T1: at most 8 input `.docx` files and at most 150 criteria. Both bound judge cost and are blind to tooling.

How eligibility is decided:
- A name rule plus two LLM classifiers (Claude Sonnet and Gemini) read **only** `instructions` and `deliverables`. A third classifier settles disagreements.
- Labels and quotes are committed at T2.
- **Vespper alignment.** Before T2, ask Vespper (founders@vespper.com) for its list of 360 eligible tasks and its stratified 180-task sample. If it arrives, report the overlap and use the intersection of its list with ours as the eligible pool, so the results are comparable in kind.

Digest facts to set expectations:
- Of 631 classified units, 279 are edit tasks. Families: contracts first-turn-redline 82 units / 50 base tasks; subsequent-turn-redline 56/31; counterparty-paper-review 84 edit units / 52 base; about 57 non-contract `draft-markup-of-*` units.
- Of those 279: 157 mention track changes, 9 ask only for strikethrough/underline formatting, 113 mention neither.
- The 1,379 unclassified units must be classified too. A 30-unit random sample found 0 edit tasks, so the upper bound is about 160.

### 3.3 Contamination exclusion
A unit is contaminated if its task directory, or the sha256 of any of its input documents, appears in any of these:
- The stetdoc repo, including its whole git history (`git log -p --all`): especially `corpus/curated.tsv`, `corpus/pairs.tsv`, `crates/stetdoc-core/src/check/expected_findings.tsv`, `crates/stetdoc-testkit/src/bench/inputs.rs`, `evals/`.
- docx-agent-bench, including `results/`.
- The author's local benchmark scratch directory (outside both repositories).

The digest found about 250 distinct contaminated directories. `pairs.tsv` alone covers 214 contracts directories from 131 base tasks in the `*redline*` and `*term-negotiation*` families, which is nearly every redline-turn task. The exact numbers come from the T2 script.

**Recommended treatment (decision 3):**
- Primary set = uncontaminated units only.
- Secondary set = a random sample of 20 contaminated redline-turn units, reported separately. It shows whether exposure helps stetdoc.

### 3.4 Selection
- **Strata:** (1) contracts/counterparty-paper-review; (2) contracts/first-turn and subsequent-turn redline, which survive only where uncontaminated; (3) non-contract markup, all categories; (4) other edits (conform, update, fill).
- **Allocation:** proportional to eligible base tasks, with at least 5 per stratum where available.
- **One unit per base task.** A random scenario is picked, so near-duplicate scenarios cannot cluster.
- **Seed:** `sha256(drand mainnet signature of the round named at T1)`. `select.py` is deterministic given the seed.
- **K:** 60 for minimal, 100–120 for strong (§10). If fewer eligible units exist, take all of them and report K.

### 3.5 Secondary sets (never pooled with the primary)
- **Dev set (disclosed as tuned on):** the v1 8 short tasks and 3 long tasks, run in the v2 harness. The compare fixture is repaired, both the original-fixture and repaired grades are shown, and the defects are listed. The v1 accept-reject LLM rubric is replaced by the neutral rubric from §5.3. Labelled everywhere as: "stetdoc was developed against these tasks."
- **Adeu's docx-benchmark, 5 tasks (external, previously seen by the stetdoc team):**
  - Its deterministic checks are re-implemented over the independent reader rather than `@adeu/core`, and results from both readers are reported.
  - The prompt's `_processed.docx` naming convention is replaced by an explicit output file name.
  - The form-fill fixture is the Y Combinator SAFE under CC BY-ND: publish hashes and grades only, not modified outputs.
- **Outsider tasks:** at T1, competitor authors and an HN post are invited to contribute up to 5 tasks each, with fixture, prompt and deterministic check, until T4. Tasks are accepted if they run deterministically and name no product. They are reported per contributor, with the contributor's own tool flagged.

### 3.6 Pre-run mechanical task check
Before T5, a script verifies that every selected unit's referenced files exist and open in both readers. A unit that fails is replaced by the next unit in the seeded order of the same stratum, and the replacement is logged. Units are never replaced after any run.

## 4. Prompts

The agent receives exactly this:

```
<fixed preamble, identical for every arm and model>
You are working in the current folder. The materials for this task are in `documents/`.
Save each deliverable in `output/` with the file name the task gives. Leave the files in
`documents/` unchanged. Work through to the end without asking questions; no one will
be available to answer.

<Harvey task.json "instructions", verbatim>
```

- No tool, product or format vocabulary is added. Words like "stetdoc", "MCP" and "skill" never appear.
- The scaffold copies `documents/` and creates an empty `output/`. The working directory is a fresh temp directory outside every repo.
- **Tracked changes are required only where asked.** A unit is "tracking requested" if its instructions or any criterion match the frozen regex `track(ed)?[- ]changes?|redline|blackline|mark[- ]?up` **and** the T2 classifier marked it "tracked". The list is committed at T2, so it is frozen before any arm runs.
- Units that ask for strikethrough/underline formatting are graded by Harvey's rubric only; the real tracked-changes check is not applied.
- Decision 4 alternative: append "Show your edits to the Word document as tracked changes." to every tracking-requested unit. It is more explicit, but less comparable with Vespper and Harvey, and it alters Harvey's text.

## 5. Grading (no stetdoc anywhere in the pipeline)

### 5.1 Readers
- **R1:** a purpose-built Python 3.12 + lxml OOXML reader, written from ECMA-376 by a helper that does not read stetdoc's source. It produces:
  - body, table, header, footer and footnote text in three views: all-accepted, all-rejected, and agent-revisions-rejected;
  - `w:ins`/`w:del`/`w:moveFrom`/`w:moveTo` with author and date;
  - `w:rPrChange`/`w:pPrChange`;
  - comments with anchors, authors and replies;
  - a per-paragraph formatting signature (style, numbering, run properties).
- **R2:** pandoc (version pinned), `-t markdown --track-changes=accept|reject|all`, which also gives comments.
- **Cross-check:** R1 and R2 accepted and rejected texts must agree after normalization (Unicode NFKC, collapsed whitespace, smart quotes folded). A disagreement is adjudicated by a person blind to arm, and the count is published.
- **Calibration:** both readers are tested at T4 on a calibration set of Harvey inputs, Word-saved files and synthetic edge cases.
- **Audit:** the grading environment's PATH and filesystem contain no stetdoc binary, and this is checked in the grading log.

### 5.2 Deterministic integrity checks (generic, written before selection, sent to authors for review)
Applied to each `.docx` deliverable:
- **I1, produced:** the file exists at the requested name and both readers can read it.
- **I2, inputs intact:** every file in `documents/` has the same sha256 after the run.
- **I3, opens in Word:** no repair or unreadable-content prompt (§5.4).
- **I4, tracked when requested** (tracking-requested units only):
  - The deliverable has at least one revision not present in its base document. The base is the input with the highest text similarity to the deliverable's all-rejected view, a rule frozen at T1.
  - Rejecting only those new revisions gives text equal to the base's text after normalization, so there are 0 untracked text changes.
  - Pre-existing revisions and comments by other authors are not deleted unless resolved through accept/reject. They are compared by count per author; resolutions are allowed only where the instructions ask for them.
- **Secondary, formatting fidelity:** the share of paragraphs untouched by the agent whose R1 formatting signature equals the input's; headers, footers, images and tables retained.

### 5.3 LLM rubric judging
- **Rubrics:** Harvey's criteria, unchanged. If Harvey LAB ships a grading prompt or code, use it verbatim with only the judge model swapped; otherwise a neutral template, frozen at T1, that asks for PASS or FAIL per criterion with a one-sentence reason.
- **What judges see:** the R2 markdown of each deliverable (`--track-changes=all`, so insertions, deletions and comments are visible), plus any non-docx deliverables, plus the criteria. They never see transcripts, chat replies or the arm.
- **Blinding:**
  - Authors of agent-added revisions are replaced with "Reviewer"; pre-existing authors are kept.
  - `docProps` and producer application names are stripped.
  - File names are replaced with the requested deliverable names.
  - Judge order is randomized.
- **Judges:** Claude Sonnet 5.5 (Vertex); a Gemini Pro-tier model (Vertex; exact id frozen at T5); and a third, non-Anthropic, non-Google judge (decision 5: an OpenAI model **recommended**, or an open-weight model on Vertex Model Garden). One call per judge per run per deliverable. Majority vote per criterion.
- **Agreement:** Fleiss' κ is reported overall and per arm.
- **Human audit:**
  - 300 criterion verdicts, sampled across arms and across both judge disagreements and unanimous verdicts.
  - Labelled blind to arm by an outside annotator; the maintainer only if no outsider can be found, which is disclosed.
  - Reported: per-judge and majority accuracy, and whether the error rate differs by arm.

### 5.4 Validity (Word)
- **Primary instrument:** Microsoft Word for Mac (App Store, unlicensed viewer mode), automated with AppleScript and System Events:
  - Open one file at a time under a random file name.
  - Detect any sheet or dialog whose text matches the Word prompt list ("unreadable content", "found a problem", "repair", "cannot be opened", "experienced an error").
  - Take a screenshot, then close without saving. There is a 60 s timeout, and a hang counts as a failure.
- **Calibration (gate at T4):** 30 files:
  - 10 known-good: Harvey inputs, and files saved by Word for the web.
  - 10 deliberately broken, each class Word is known to repair or refuse: truncated zip; malformed `document.xml`; missing `[Content_Types]` override; dangling `r:embed`; comment reference to a missing comment; nested `w:p` in `w:r`; and so on.
  - 10 borderline: SDK schema-order errors such as `w:color` out of order, duplicate `w:id`.
  - All 30 are also opened by hand in Word for the web.
  - **Pass condition:** desktop Word flags every broken file that Word for the web flags, and opens every good file cleanly. The borderline outcomes are published, which settles the v1 `w:color` question with evidence.
- **Fallback, if calibration fails** (viewer mode won't open files, or suppresses prompts):
  - Word for the web on a stratified sample: every run whose deliverable has new SDK errors or fails a LibreOffice headless load, plus a random 15% of the rest per arm × model.
  - Opened by a person blind to arm.
  - I3 is then estimated with sampling weights, and the method is stated in the report.
- **Inherited quirks:** every input `.docx` gets the Word check first. Units whose base input itself triggers a prompt are excluded from I3 and counted, while still contributing to I1, I2 and I4.
- **Secondary, Open XML SDK** (`ooxml-validate`, sha pinned):
  - New errors = output error multiset minus base-input multiset, keyed by (error id, part, element local name).
  - Rates reported by class: schema order (`Sch_UnexpectedElementContentExpectingComplex`), duplicate ids (`Sem_UniqueAttributeValue`), missing part/relationship, other.
  - Errors repeating an input pattern (same id and element) are flagged "inherited pattern".
- **Tertiary:** LibreOffice headless load success.

## 6. Arms and parity

### 6.1 Arms

| # | Arm | Install, per the product's own docs (version pinned at T4) | Notes |
|---|---|---|---|
| 1 | **stetdoc (as shipped)** | Claude Code plugin from the T0 release (skill, docx-guard PreToolUse hook, binary); Antigravity skill per stetdoc docs | Primary arm |
| 1b | stetdoc without hook | Same, with `STETDOC_GUARD=off` | Secondary; attributes the hook's effect. Minimal version: one model only |
| 2 | Anthropic docx skill | anthropics/skills `skills/docx` at a pinned commit, copied as a skill folder; its declared dependencies (pandoc, LibreOffice, Poppler, Python ≥3.10 packages) come from the union environment | |
| 3 | Adeu | Claude Code: `/plugin marketplace add dealfluence/adeu` (latest release; plugin and skill versions reconciled and logged). Antigravity: documented MCP `npx -y @adeu/mcp-server` | |
| 4 | Safe Docx | `npm i -g @usejunior/safe-docx`, then `claude mcp add safe-docx -- <abs path>`, with `SAFE_DOCX_ALLOWED_ROOTS` set to the run directory (hard-coded for agy) | |
| 5 | SuperDoc MCP | `claude mcp add superdoc -- <abs path to @superdoc-dev/mcp>` | AGPL |
| 6 | OfficeCLI | Binary plus `officecli install` (skill), or `officecli mcp claude`: whichever the README presents first; asked of the authors | `OFFICECLI_SKIP_UPDATE=1` pins the version (disclosed deviation from the default) |
| 7 | docx-cli | Claude Code plugin, or `npx skills add kklimuk/docx-cli`, plus binary | |
| 8 | Stemma | `@stemma-sh/mcp` prebuilt binary via `claude mcp add` | |
| 9 | SecurityRonin docx-mcp | `claude mcp add docx-mcp -- uvx docx-mcp-server`, with its auto-installed companion skill | |
| 10 | python-docx floor | No docx skill or tool; union environment only | Replaces v1 "none" |
| 11 | Vespper (optional, strong version) | Remote MCP with token; paid plan, since the free 500 edits are too few | Documents leave the machine (public MIT documents) |

- anthropic-legal is dropped: its skill was invoked in 2 of 101 v1 runs.
- Codex is not installed (`command -v codex` is empty), so the Codex harness is out of scope for v2.

### 6.2 Uniform rules
- **Union environment, identical in every arm:** Python 3.12 venv first on PATH (python-docx, lxml, defusedxml, openpyxl), pandoc, LibreOffice, Poppler, Node 22, uv. Versions are locked.
- **Product binaries live only on their own arm's PATH.** The sandbox denies reads of other arms' install directories, `~/.cargo/bin`, the stetdoc and bench repos, and the author's local benchmark scratch directory. This answers Stemma's finding that agents use any stronger tool they find on the host.
- **Hooks:** arm-specific hooks only if they ship in that product's default install, and that rule applies to every product. The harness adds no hook that affects the agent; grading runs after the agent exits.
- **MCP schemas (decision 7):** **recommended** to disable Claude Code's tool-search deferral for every MCP arm, using the switch the pinned Claude Code version documents; verify its name. Stemma found that deferral blocks Haiku from MCP tools, and stetdoc, a CLI, would be immune to it. If no such switch exists, use the default and report invocation rates.
- **python-docx availability (decision 9):** **recommended** to leave it available in every arm and measure bypass. This is closer to a real user's machine, and stetdoc's own hook blocks bypass only because that hook ships with the product.

### 6.3 Preflight (inside each arm's sandbox, per model, before T5 and again daily during runs)
- A scripted shell inside the sandbox records:
  - `python3 --version` (must be 3.12.x);
  - `python3 -c "import docx, lxml"`;
  - `pandoc --version`, `soffice --headless --version`, `node --version`;
  - the arm binary's `--version` and its sha256.
- A headless probe prompt ("List the tools and skills available to you. Then run `python3 --version`.") is run and its `system/init` stream-json event is captured. It must show the arm's MCP servers as `connected` with their tools listed, the arm's skill or plugin present, and no other arm's tools.
- A failed preflight means that arm × model does not run until it is fixed, and the fix is logged.

### 6.4 Competitor review
- At T1 every author gets their arm's config, install log, preflight output and the integrity checks: Adeu (GitHub, adeu.ai), Safe Docx (steven@usejunior.com), SuperDoc, OfficeCLI (GitHub/Discord), docx-cli (Kirill Klimuk), Stemma (evaluation-report issue template), SecurityRonin, Anthropic (skills repo issue), and Vespper if included.
- The review window is 14 days.
- Corrections that match the product's public docs or default install are applied to the config.
- Requests for non-default tuning are run as an extra "author-tuned" arm on one model if budget allows; otherwise they are declined, with the reason published.
- All correspondence is published.

### 6.5 Execution environment
- **Claude Code:** `claude -p --output-format stream-json --verbose --model <id> --max-turns 150 --permission-mode bypassPermissions`.
  - Runs inside a `sandbox-exec` profile: writes limited to the run directory and its TMPDIR; network limited to the model endpoint and proxy (plus Vespper for that arm).
  - `CLAUDE_CONFIG_DIR` is set per arm, so only that arm's plugins, skills and MCP config load.
  - `PYTHONDONTWRITEBYTECODE=1`.
- **Antigravity:** `agy -p … --model gemini-3.8-flash-medium --dangerously-skip-permissions --output-format stream-json`, with HOME isolated per arm and the same sandbox profile.
- **Wall-clock limit:** 3,600 s for every arm and model. A timeout is a task failure, not an infrastructure error.
- **Kept per run:** all outputs, the raw transcript, the stderr log, CLI versions and the preflight hash.

## 7. Metrics and statistics

### 7.1 Primary endpoints (co-primary, per model)
- **PE1, integrity pass:** per run, I1 ∧ I2 ∧ I3 ∧ (I4 if tracking was requested).
- **PE2, Harvey rubric score:** per run, the share of criteria passed by majority vote. A missing deliverable fails the criteria that reference it.

### 7.2 Secondary endpoints
- **All-pass:** rubric all-pass ∧ PE1, Vespper's analog.
- **Completion rate:** the deliverable exists.
- **Validity detail:** SDK new-error rate by class, LibreOffice load success, formatting fidelity.
- **Per-arm tool use:**
  - Invocation rate: runs where the arm's tool was used, from the transcript.
  - Bypass ratio: `.docx` reads or writes done through python-docx, unzip, pandoc or LibreOffice instead of the arm's tool, divided by all `.docx` operations. Classified by a deterministic pattern list, with an LLM pass for ambiguous calls (Vespper's definition).
- **Process:** turns, tool calls, tool errors (sandbox denials separate), wall time.
- **Cost per run:** described in §7.5.

### 7.3 Run schedule
- Blocks are (model, task, replicate). Within a block, arm order is randomized from the beacon seed, and the arms of a block start within one scheduling window. Blocks are shuffled.
- Concurrency: up to 8 for Claude and 4 for Gemini, tuned in the pilot on dev tasks only.
- Judging starts only after every agent run of that model has finished.
- Agents and judges use separate quota projects.

### 7.4 Infrastructure errors
- **Definition:** a fatal provider error (429, 5xx, stream interruption), a proxy failure, a harness crash before the agent's first tool call, or a machine sleep.
- **Rule:** automatic retry, at most 3 times, with exponential backoff and a fresh directory. The decision is made from the error signature alone, without looking at the outcome. A run that finishes despite intermittent 429s is kept.
- **Analysis:** the primary analysis counts runs still failing after retries as failures (intention-to-treat). A sensitivity analysis excludes them. Infra rates are published per arm × model.
- **Gemini quota gate:** if Gemini infra errors exceed 10% in any arm, Gemini results are labelled "indicative" and leave the confirmatory family. A 1-hour sustained preflight at the planned concurrency gates Gemini's inclusion (decision 1).

### 7.5 Cost
- Per-run token counts are priced at the Vertex price list as of the run date; the list is archived in the repo.
- Reconciled against the Vertex billing export (BigQuery, per model SKU per day). Per-arm costs are scaled by that model-day's billed/estimated ratio. Claude Code's `costUsd` is a cross-check.
- The reconciliation ratio is published. No assumed rates.

### 7.6 Analysis
**Primary analysis, per model:**
- For each competitor c, take the paired task-level difference of arm means, stetdoc − c, averaged over replicates.
- 95% CI from a task-clustered bootstrap: 10,000 resamples of tasks, percentile intervals, with p-values from the bootstrap null.
- **Confirmatory family per model:** 9 competitors × 2 co-primaries = 18 tests, Holm at two-sided α = 0.05. The stetdoc-without-hook and Vespper arms are outside the family.
- **Cross-check:** a GLMM for PE1 (logit, arm fixed effect, random intercepts for task and task × arm) and an LMM for PE2 (or binomial on criterion counts). If the cross-check and the bootstrap disagree about a claim, the more conservative one governs.

**Non-inferiority margins:** PE1 −5 points, PE2 −3 points.

**Decision rules per model and competitor:**
- **stetdoc better:** Holm-significant superiority on at least one co-primary, **and** the other co-primary's 95% CI lower bound above −margin, **and** the PE2 point estimate has the same sign under each single judge.
- **stetdoc worse:** Holm-significant inferiority on either co-primary.
- **Equivalent:** both CIs fall inside ±margin.
- **Inconclusive:** anything else.
- **No pooled-across-models confirmatory claim.** "Across models" means the claim holds in each model separately.

**Pre-registered sensitivity analyses** (reported; they never change the headline):
- Infra failures excluded.
- Criteria that no run in any arm passes are dropped.
- Majority judge replaced by each single judge.
- I3 scored by the SDK rule, then by the LibreOffice rule.
- The contaminated set.
- Tracking-requested units only.

### 7.7 Power (task count)
- Minimum detectable difference ≈ (z₁₋α/₂ + z₀.₈) × SD_d / √K. Worst case is Holm's first step, α = 0.05/18, so z = 2.99.
- **K = 60:**
  - PE2 ≈ 5.9 points, assuming a task-level SD of paired differences of 0.12.
  - PE1 ≈ 20 points, assuming SD 0.40, typical of v1's 0/5 and 5/5 cells.
- **K = 100:** about 4.6 and 15.5 points.
- The SDs are re-estimated from the dev-set pilot before T5. If the estimate implies an MDE above 8 points for PE2, K is raised within the pool or the gap is disclosed.
- **Runs per task:** the v1 within-task correlation was high (ICC ≈ 0.6). A second run adds about 25% information; a second task adds 100%. So r = 2: enough to measure run-to-run variance, which is Stemma's replication lesson. Extra budget buys tasks, not runs.

## 8. Dev-set and external-set reporting
- Dev-set results appear in a separately headed section, titled to say that stetdoc was developed against these tasks. They are never in the headline or in pooled numbers.
- The compare-fixture repair and the neutral accept-reject rubric are shown alongside the v1 grading.
- Adeu's tasks and outsider tasks are reported per source, each with its own disclosure.

## 9. Reporting

### 9.1 What is published
Published in a public repo or release, with secrets (tokens, project ids) scrubbed and the scrub list published:
- the protocol and tags;
- every transcript (raw stream-json);
- every output `.docx`, except CC BY-ND derivatives;
- reader outputs;
- per-criterion verdicts with every judge's reason;
- Word screenshots and logs, and calibration results;
- SDK and LibreOffice logs;
- the preflight logs;
- the schedule and seed;
- the infra-error log;
- the billing reconciliation;
- `DEVIATIONS.md`;
- the analysis code and a per-run CSV;
- competitor correspondence.

### 9.2 Allowed claims, pre-committed

| Outcome (per model) | Allowed wording |
|---|---|
| Better than all 9 on that model | "In a pre-registered benchmark of N held-out Harvey LAB editing tasks run with M, agents using stetdoc scored higher on [endpoint] than every other tool tested (difference, 95% CI)." "Best of the tools tested, on this benchmark, with M." |
| Better than some | Name each tool it beat and give the difference; say "no detectable difference" or "on par" for the others in the same sentence. |
| Equivalent | "On par with X (within ±margin)." |
| Inconclusive | "No difference detected; differences up to [CI bound] can't be ruled out." |
| Worse than X | "stetdoc scored lower than X on [endpoint] with M (difference, CI)", in the headline, with the same prominence as any win. |
| Validity | Only "Y% of files written with tool T triggered Word's repair prompt (Word build …)". SDK figures always carry the label "schema errors; Word may accept them". |
| Cost / speed | "Lower billed cost per task (ratio, CI)", on held-out tasks only, with the reconciliation ratio. |

**Never allowed:**
- "the best way for AI agents to edit Word documents";
- "competitors produce invalid files", unless the Word check shows it, and then only in the wording above;
- "statistically significant" without the Holm-adjusted p;
- any dev-set number without its disclosure;
- any comparison with Vespper's or Stemma's numbers beyond "same task pool, different harness and model".

The v1 report and live page are corrected first, as the skeptic listed (M9, §5 of that review).

## 10. Budget and timeline

**Per-run assumptions** (median per Harvey-sized run in v1's long tasks, all to be re-measured in the pilot):
- Haiku about $0.85.
- Opus about $3.8.
- Sonnet about $2.0, an estimate between Haiku and Opus, not measured.
- Gemini about $1.3 at the assumed rates, to be replaced by billed figures.
- Dev and Adeu runs about $0.3–0.4.
- Judges about $0.12 per judge per run.
- Wall time about 700 s per Claude run and about 1,500 s per Gemini run.

Agent spend gets a ×1.5 ceiling.

| Version | Grid | Agent runs | Expected spend | Ceiling | Run wall time | Calendar |
|---|---|---|---|---|---|---|
| **First pass** (if minimal is too expensive) | 60 tasks × 1 run × 10 arms, Sonnet only; dev and Adeu sets 1 run | 600 + 130 | ≈ $1.6k (agent $1.25k, judges $0.2k, pilot $0.15k) | $2.3k | ≈ 15 h at concurrency 8 | 3 weeks |
| **Minimal credible (recommended)** | 60 held-out × 2 runs × 10 arms, Sonnet and Gemini; stetdoc-no-hook on Sonnet (120); dev and Adeu × 2 runs | Sonnet 1,320 + 260; Gemini 1,200 + 260 | ≈ $5.6k (Sonnet $2.7k, Gemini $1.7k, judges $0.9k, pilot $0.3k); with Haiku instead of Gemini ≈ $4.8k | $8.5k | Sonnet ≈ 40 h; Gemini ≈ 6 days at concurrency 4 (quota-bound); Word check ≈ 20 h, overlapping | ≈ 4 weeks: wk 1 harness, readers, Word automation and calibration; wk 1–2 installs, preflight, dev pilot (author review runs in parallel, 14 days); wk 3 freeze and run; wk 4 grading, analysis, publication |
| **Strong** | ≈ 100 clean + 20 contaminated × 2 runs × 12 arms (10, no-hook, Vespper), Haiku, Sonnet and Gemini (+ Opus optional); outsider tasks; external human judge audit | ≈ 2,880 per model | ≈ $18k without Opus (agents ≈ $12k, judges ≈ $3k, Vespper ≈ $0.2k, annotator ≈ $1.5k, sets ≈ $1k); ≈ $29k with Opus | ×1.5 | ≈ 2–3 weeks of runs | 6–8 weeks |

**Spend watchdog:**
- Per arm × model, abort at 50% over the pilot-based estimate.
- When a limit is raised, it is raised for every arm of that model, and logged.
- No single-arm exceptions (unlike v1's Gemini adeu).

## 11. Known limits to state up front
- One machine, one date range, two agent harnesses. The results don't carry over to other harnesses, and Harvey's own harness is not used.
- Harvey rubrics judge legal content as much as document mechanics. PE1 isolates the mechanics.
- Every arm runs the latest release at T4. The comparison is a snapshot.
- The stetdoc team runs the benchmark. Mitigations: public freeze hashes, beacon selection, outside readers and judges, author review, and full publication. A third-party re-run from the published harness is invited.

---

**Inputs used:**
- the skeptic review (`…/ses_83ad7ce24abb4c1baff6-132.md`);
- `reports/benchmark-final.md`;
- the alternatives survey (`…/ses_42dc0b32cc42443697e2-80.md`);
- the harness digest (`…/ses_f1433b264dc44b6b9f40-48.md`);
- the Harvey digest (`…/ses_d28ab6ef098540039ae4-171.md`);
- vespper.com/blog/docx-mcps-harvey-lab and stemma.sh/docs/benchmarks.

**Verified:**
- Harvey structure, the edit labels for the 631 classified units, and the contamination file counts (helper, via git and grep).
- Codex is absent; Claude Code is 2.1.311.
- v1 harness facts, with file and line references (helper).

**Not verified:**
- The 1,379 unclassified Harvey units.
- Whether Harvey ships grading code.
- The exact Claude Code switch for tool-search deferral.
- Sonnet 5.5's per-run cost.
- Whether unlicensed Word for Mac shows the repair prompt; the calibration gate in §5.4 decides that.
