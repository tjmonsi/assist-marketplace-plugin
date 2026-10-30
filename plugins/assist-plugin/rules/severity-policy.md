# Severity Policy: assist-plugin

**Purpose:** Define CRITICAL, HIGH, MEDIUM, and LOW for this repo, a per-finding confidence level, the SARIF level mapping, and the rule that decides when a finding blocks.

**Status:** DRAFT, pending the user's D-4 approval. No rule blocks on severity while this status reads DRAFT or the approval entry below does not exist. Traces to FR-237, FR-238, FR-239, FR-240, FR-241 (`docs/requirements/FR-NFR-harness-governance.md`) and NFR-033, NFR-034. Basis settled in `DECISIONS.md` under "2026-10-30: Severity-policy basis and SARIF writer settled".

**Policy version:** draft-1

**Approval entry (exact heading):** The user approves this policy by adding an entry to `DECISIONS.md` whose heading line is exactly

```
## <YYYY-MM-DD>: Severity policy approved
```

where `<YYYY-MM-DD>` is the approval date (for example `## 2026-11-02: Severity policy approved`). A check treats the policy as approved only when `DECISIONS.md` holds a line matching `^## [0-9]{4}-[0-9]{2}-[0-9]{2}: Severity policy approved$` and the entry body names `plugins/assist-plugin/rules/severity-policy.md` and the policy version it approves (`draft-1` above). Editing this file after approval raises the version; the old approval then no longer covers it. Approval amendments the user wants (any choice in "Choices and trade-offs") go into the entry body or into a new draft version before the entry is written. Subagents are denied writes to `DECISIONS.md` (`CLAUDE.md`, fsa-write-bar), so only the user or the orchestrator can create the entry.

**Scope of this file:** Because this file sits under `rules/`, a change to it is on the LLM surface and needs the OWASP for LLM gate (`llm-security-checklist.md:11`).

## Rubric

Severity comes from the OWASP risk rating method: rate likelihood and impact each as LOW, MEDIUM, or HIGH, then read the overall severity from the likelihood-by-impact matrix (directional: OWASP Risk Rating Methodology, not re-verified for this draft). Where a finding has a CVSS base score (for example a dependency advisory), cross-check it against the CVSS qualitative bands: Low 0.1 to 3.9, Medium 4.0 to 6.9, High 7.0 to 8.9, Critical 9.0 to 10.0 (directional: FIRST CVSS specification, not re-verified for this draft). When the two disagree, the higher level stands until a reviewer records why the lower one is right.

Repo-specific rating inputs:

- **Likelihood** rises when attacker-controlled text (PR bodies, web pages, tool output, files) reaches a session that holds write, Bash, or posting ability; falls when a second control (a hook, the read-only `reviewer`, a user prompt) sits in the path.
- **Impact** rises with the asset reached: a governance store (`DECISIONS.md`, `.agent/main-plan/**`, the confirmation store of FR-242, the rule-mode store), a posted PR verdict, a credential, a pushed commit. It falls for style, wording, and traceability drift.
- A fail-open guard (all hooks fail open, `CLAUDE.md` Hooks section) is a defect only when the guard is the sole control for an asset rated HIGH impact. A fail-open advisory hook is by design and is not a finding.

## Levels

### CRITICAL

- **Rubric alignment:** OWASP overall risk Critical (HIGH likelihood, HIGH impact); CVSS 9.0 to 10.0.
- **Threshold:** Exploitable now with no extra precondition, and the result is an unconfirmed external action, a forged governance record, or a leaked credential.
- **Examples:**
  - A deny-bearing PR-posting guard (the FR-214 deny for `gh pr review` and `bkt pr approve` or `decline`) that fails open when its confirmation lookup errors, so a verdict posts with no recorded user confirmation.
  - A prompt-injection path from attacker-controlled PR or web text into a governance store the gates trust (the confirmation store of FR-242, `.agent/governance/profile.json`, the rule-mode store), so a subagent forges a confirmation or flips a rule to advisory.
  - A real credential committed and pushed to a remote the user did not name.

### HIGH

- **Rubric alignment:** OWASP overall risk High (HIGH on one axis, MEDIUM on the other); CVSS 7.0 to 8.9.
- **Threshold:** A realistic attack or failure path exists, one control stands in the way, and the asset is a governance store, a posted verdict, or a secret.
- **Examples:**
  - Attacker PR text reaches a `/pr-review` session that can run posting commands, with only the best-effort `pr-post-ask` hook between the text and the post (`llm-security-checklist.md:326`).
  - `git add .` in `commit` combined with pre-approved `Bash(git add *)` and `Bash(git push *)` wildcards (`llm-security-checklist.md:327`).
  - Generated code that writes user input into a shell command or SQL string without escaping (FR-220 target class).

### MEDIUM

- **Rubric alignment:** OWASP overall risk Medium; CVSS 4.0 to 6.9.
- **Threshold:** The weakness needs a second failure or a user mistake before harm occurs, or the harm is bounded to cost, noise, or a recoverable file.
- **Examples:**
  - A governance gate that passes on a model-emitted string, and a write bar that does not cover Bash writes (`llm-security-checklist.md:328`).
  - A revision loop with no iteration cap (`llm-security-checklist.md:330`).
  - No confirmation gate on writes to auto-loaded `CLAUDE.md` or `rules/` files (`llm-security-checklist.md:331`).

### LOW

- **Rubric alignment:** OWASP overall risk Low (or Note); CVSS 0.1 to 3.9.
- **Threshold:** Hygiene, drift, or hardening with no direct path to a protected asset.
- **Examples:**
  - A missing or stale traceability marker on code that implements a requirement (`docs/TRACING_MARKERS.md`).
  - `gh`, `bkt`, or `git` invoked without a presence check, and bare `Bash` granted where a scoped command family would do (`llm-security-checklist.md:332` and `:333`).
  - An advisory-tier prose tell in a doc, which `prose-advisor` already reports without blocking.

The existing gap table in `llm-security-checklist.md:323` uses High, Medium, and Low labels. This draft does not re-rate those rows. The user decides in the approval entry whether the table adopts this policy's levels.

## Confidence

Every finding carries one confidence level, set by the reviewer from its evidence. Confidence describes how sure the reviewer is that the finding is real, and is separate from severity.

| Confidence | Assign when |
|------------|-------------|
| High | The finding cites file and line and one of: a reproduced trigger, an in-plugin scanner hit (for example the FR-217 scanner, `check-fsa-tables.js`, a health self-test), or a read of the exact code path with no unverified assumption |
| Medium | The finding cites file and line and a plausible path, but one step rests on an assumption the reviewer did not verify |
| Low | A pattern or heuristic match only, no traced path, or evidence the reviewer could not read |

A finding with no file and line is Low confidence at most, and SARIF leaves it out (see below). A reviewer never raises confidence on a model-emitted claim alone; a sign-off string clears nothing (`DECISIONS.md`, D-8 entry).

## Routing

The `routing` field of FR-240 follows from severity and confidence. Routing in the right-hand column of the first row applies only to a rule whose mode is blocking; a rule in advisory mode routes that row as `inline-comment`.

| Severity | Confidence | Routing |
|----------|------------|---------|
| CRITICAL or HIGH | High | `block-merge` (blocking rule) or `inline-comment` (advisory rule) |
| CRITICAL or HIGH | Medium or Low | `inline-comment` |
| MEDIUM | High or Medium | `inline-comment` |
| MEDIUM | Low | `log-only` |
| LOW | any | `log-only` |

Only the first row blocks (FR-239). Every other finding routes as advisory.

## SARIF level mapping

| Severity | SARIF result level |
|----------|--------------------|
| CRITICAL | `error` |
| HIGH | `error` |
| MEDIUM | `warning` |
| LOW | `note` |

- The document is SARIF 2.1.0 (estimate, FR-241); location comes from file and line. A finding with no location stays out of SARIF and the report lists it as not exported with the reason.
- The `/do` orchestrator writes the `.sarif` file from the reviewer's findings; reviewers are read-only (`DECISIONS.md`, D-9 entry). `lib/sarif.js` converts and does not write.
- Severity name and confidence travel in each result's `properties` bag (proposal; the SARIF property bag allows extra fields, directional) so the CRITICAL and HIGH distinction survives the shared `error` level.
- Uploading a SARIF file to GitHub is a posting action and falls under the FR-214 confirmation rule.

## Advisory baseline first, then blocking

1. **Advisory first (FR-238).** Every new check that can block starts in advisory mode: it records every finding and blocks nothing, whatever the severity.
2. **Baseline window.** The window lasts 14 days or 20 reviews, whichever is later (estimate, BRD A-5). It ends with a baseline report holding finding counts per severity and confidence, and precision.
3. **Precision.** The user labels each advisory finding true or false (PN-3 in the task plan); precision is true findings over labelled findings. Promotion needs precision of at least 90% (estimate, BRD A-6; NFR-034).
4. **Promotion gate.** A rule moves to blocking only when all hold: the approval entry exists for the current policy version; a baseline report exists; precision meets the bar; the user records the promotion. A promote step refuses with the missing-policy reason, the missing-baseline reason, or the precision value.
5. **Blocking rule (FR-239).** In a blocking rule, a finding blocks only at confidence High and severity HIGH or CRITICAL.
6. **Out of scope here.** Guards that already deny on their own rules (prose-gate, fsa-write-bar, commit-attribution-guard, doc-cli-guard) do not route by severity and are unchanged by this policy.

## Choices and trade-offs

Each choice below is the draft's position. The user approves it as written or amends it before recording the approval entry.

### (a) Rubric source: OWASP risk rating as primary, CVSS bands as cross-check

Alternatives: CVSS only; a custom repo scale only.

- OWASP risk rating (chosen)
  - Pro: rates likelihood and impact, which fits non-CVE findings such as a fail-open guard or an injection path.
  - Pro: the repo already uses OWASP Top 10 and OWASP for LLM (`llm-security-checklist.md:19`), so reviewers share the vocabulary.
  - Con: the likelihood and impact inputs are judgement calls, so two reviewers can differ by one level.
  - Con: its matrix has a bottom "Note" tier that this policy folds into LOW (directional).
- CVSS only
  - Pro: numeric, reproducible bands from a published vector.
  - Pro: dependency advisories arrive already scored.
  - Con: built for software vulnerabilities; it fits prompt-surface and governance findings poorly (no clean vector for "agent text reaches a store").
  - Con: scoring each finding adds reviewer effort and tokens (estimate, not measured).
- Custom repo scale only
  - Pro: tuned exactly to this plugin's assets.
  - Con: no outside anchor, so the user must defend every threshold alone.
  - Con: drifts without an external reference, and the settled basis asks for a recognized rubric.
- Chosen mix: the "higher level stands" tie-break is simple but leans toward over-rating; the cost is more HIGH findings in the baseline, which the 90% precision bar then exposes.

### (b) Level thresholds and examples

- Thresholds tied to the asset reached and the number of controls in the path (chosen)
  - Pro: a reviewer can place a finding by asking which asset and which control, not by scoring a formula.
  - Pro: examples cite existing audit rows (`llm-security-checklist.md:326` to `:333`), so the user can check them against rows already accepted.
  - Con: the CRITICAL examples are forward-looking (the FR-214 deny and the stores of FR-242 and FR-245 are planned, not shipped), so they rest on the requirements, not on running code.
  - Con: placing gap 2 and gap 3 at HIGH and not CRITICAL reflects the existing `pr-post-ask` control and the user-visible `git push`; a stricter user may want them CRITICAL.
- Treating a fail-open guard as a defect only when it is the sole control for a HIGH-impact asset
  - Pro: stops every fail-open hook from becoming a finding, which the design requires (`CLAUDE.md`, Hooks section).
  - Con: needs the reviewer to judge "sole control", which is another judgement call.
- Traceability drift at LOW
  - Pro: keeps marker gaps from blocking merges.
  - Con: a marker gap on a Must requirement can hide an untested control; the user may want that at MEDIUM.

### (c) Confidence scheme: High, Medium, Low, set by evidence type

- Evidence-based levels (chosen)
  - Pro: ties High to something checkable (a reproduction, a scanner hit, a read path), so it matches the D-8 rule that a model-emitted string clears nothing.
  - Pro: three levels are easy to apply and map to the FR-239 routing without a threshold number.
  - Con: High confidence depends on the in-plugin scanners existing; until they do, few findings reach High and little blocks (an acceptable early effect, and a reason promotion waits for a baseline).
  - Con: the line between Medium and High ("no unverified assumption") is still a reviewer judgement.
- Alternative: numeric score (0 to 100)
  - Pro: finer routing and sortable output.
  - Con: false precision for a reviewer that is a model; the numbers would be unreliable (directional).
- Alternative: derive confidence from the producing tool only
  - Pro: no reviewer judgement.
  - Con: a manual review finding would have no confidence; a scanner hit can still be a false positive.

### (d) SARIF mapping: CRITICAL and HIGH to error, MEDIUM to warning, LOW to note

- The settled mapping (chosen)
  - Pro: uses the three SARIF levels that carry meaning, and the mapping is one table a converter can test.
  - Pro: keeps the blocking tier (CRITICAL, HIGH) and the `error` level aligned.
  - Con: CRITICAL and HIGH share `error`, so the GitHub Security tab may not separate them; GitHub reads a rule-level `security-severity` property for that display (directional, not verified). The `properties` bag in this draft carries the severity name, but the tab may ignore it.
  - Con: `error` reaches the tab for a HIGH finding of Medium confidence that does not block merge, so the tab and the merge gate can disagree.
- Alternative: map by routing, not severity (block-merge to error)
  - Pro: the tab matches the merge gate.
  - Con: contradicts the settled mapping and FR-241, which derives level from severity.
- Alternative: add a `security-severity` score per CRITICAL/HIGH/MEDIUM/LOW
  - Pro: separates CRITICAL from HIGH in the tab (directional).
  - Con: needs numeric values that this policy does not define; left for the user to request.

### (e) Advisory-vs-blocking promotion rule and baseline window

- Advisory first, 14 days or 20 reviews whichever is later, precision at least 90%, user records promotion (chosen)
  - Pro: no rule blocks before it shows its false-positive rate, which limits alert fatigue (vendor blogs, directional).
  - Pro: "whichever is later" protects a low-traffic repo from promotion on too few reviews.
  - Pro: a user-recorded promotion keeps a person in the loop for any new block.
  - Con: all three numbers are estimates (BRD A-5, A-6); the right window and bar are unknown until a real baseline exists.
  - Con: precision needs the user to label findings (PN-3), which costs the user time and could stall promotion.
  - Con: on a solo repo, 20 reviews may take much longer than 14 days, so the rule stays advisory for weeks (estimate).
- Blocking limited to confidence High and severity HIGH or CRITICAL (FR-239)
  - Pro: blocks only on the findings most worth stopping a merge.
  - Con: a CRITICAL finding at Medium confidence does not block and relies on a human reading the inline comment; the user may want CRITICAL to block at Medium confidence.
- Alternative: shorter or count-only window
  - Pro: reaches blocking sooner.
  - Con: a small sample gives a noisy precision figure.
- Alternative: no precision bar, user judgement only
  - Pro: less overhead.
  - Con: contradicts NFR-034 and removes the measurable gate.

### (f) Approval binding: exact heading plus policy version

- Dated heading `## <YYYY-MM-DD>: Severity policy approved`, body names file and version (chosen)
  - Pro: a fixed pattern a check can match without reading prose, and the date matches the existing `DECISIONS.md` heading style.
  - Pro: the version in the body means a later edit to this file needs a fresh approval.
  - Con: a check that matches the heading cannot confirm the user, not a subagent, wrote it; it relies on the write bar's denial of `DECISIONS.md` to subagents, which does not cover Bash writes (`llm-security-checklist.md:328`).
  - Con: the date changes per approval, so the check must match the pattern, not a literal string.
- Alternative: a fixed undated heading
  - Pro: simplest literal match.
  - Con: breaks the dated convention of the file and hides when approval happened.
- Alternative: a flag file such as `.agent/governance/severity-approved`
  - Pro: easy to read in code.
  - Con: a second approval record to protect; the settled basis puts approval in `DECISIONS.md`.

## Open items for the user

- Whether the `llm-security-checklist.md` gap table adopts these levels (see Levels).
- Whether CRITICAL should block at Medium confidence (see (e)).
- Whether to add a `security-severity` score for the Security tab (see (d)).
- Whether the baseline gets a demotion rule (blocking back to advisory on a precision drop). The requirements define none (FR-238, NFR-034), so this draft adds none.
