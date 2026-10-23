# Decisions

## 2026-10-12: Prose hooks skip docs/tts

Decision: prose-gate and prose-advisor skip files whose normalized path, relative to the project root, starts with `docs/tts/`, so voice scripts may use em dashes for pauses. Every other path stays gated.
Plan: .agent/main-plan/plan-voice-script-20261012.md

## 2026-10-12: voice-script output format

Decision: `/voice-script` writes a `.md` file to `docs/tts/` with a header (model, voice, length, delivery direction, model settings) and one fenced block holding exactly the text to paste.
Plan: .agent/main-plan/plan-voice-script-20261012.md

## 2026-10-12: voice-script tag catalog

Decision: paralinguistic tags come from one dated reference file per TTS model with source URLs, plus a run-time WebFetch of OpenRouter's model list, treated as untrusted data, that flags new or removed TTS models.
Plan: .agent/main-plan/plan-voice-script-20261012.md

## 2026-10-12: clarify skill scope and log

Decision: `/clarify` explains Claude's unclear output and asks the user about points only the user can settle; it logs each clarification to `.agent/clarify/clarify-YYYYMMDD.md` (append-only, one file per day) and never writes `/do` plan files or `DECISIONS.md`.
Plan: .agent/main-plan/plan-clarify-skill-20261012.md

## 2026-10-12: clarify tool grants

Decision: `/clarify` pre-approves Write and Edit only for `.agent/clarify/**` and the single command `date +%Y-%m-%dT%H:%M`; every other write prompts, and Claude does not start the skill on its own for ambiguous requests.
Plan: .agent/main-plan/plan-clarify-skill-20261012.md

## 2026-10-12: voice-script tool grants

Decision: `/voice-script` pre-approves writes only for `docs/tts/voice-*.md` (scripts are named `voice-<slug>-YYYYMMDD-HHmm.md`) and the single command `date +%Y%m%d-%H%M`; every other write prompts.
Plan: .agent/main-plan/plan-voice-script-20261012.md

## 2026-10-12: No AI attribution in commits or PRs

Decision: commits and PR bodies never carry a Co-Authored-By trailer or other attribution line for an AI tool (human co-authors stay allowed). A PreToolUse guard on Bash and PowerShell denies git and gh commands that add one, the skills and plugin rules state the rule, and `/assist-plugin:health` reports when Claude Code's `attribution.commit` or `attribution.pr` is not empty.
Plan: .agent/main-plan/plan-no-ai-coauthor-20261012.md

## 2026-10-12: Scoped write grants for document skills

Decision: gather-requirements, technical-writing, and spec-from-requirements pre-approve Edit only for their documented output paths (keeping CLAUDE.md, AGENTS.md, and `.claude/` out where the layout allows); every other write prompts. DECISIONS.md is committed with the project.
Plan: .agent/main-plan/plan-release-1-10-0-20261012.md

## 2026-10-13: Spec-first /do for build requests

Decision: `/do` requires requirements, a spec, and a task plan before any step that writes code, config, pipelines, infrastructure, or tests; docs-only edits, reviews, questions, and commits are exempt. A read-only intake-reviewer conflict check compares the request against existing documents and `DECISIONS.md`; Clarify asks about every gap and contradiction (up to 5 rounds, each question showing a recommended answer and the assumption /do would otherwise make; a point open after round 5 stops the plan). The user signs off on the finished documents in the same run before build steps start. PlanApproval offers a "Skip spec-first" waiver, recorded in `DECISIONS.md`.
Plan: .agent/main-plan/plan-spec-first-do-20261013.md

## 2026-10-13: task-planner agent and plan-file write guard

Decision: the spec-first Task plan step runs on a dedicated `task-planner` agent with only Read, Write, Grep, and Glob, and fsa-write-bar limits its writes to `task-plan-*.md`; the developer no longer runs task-plan. fsa-write-bar denies every assist-plugin subagent Write, Edit, MultiEdit, and NotebookEdit on `.agent/main-plan/**` and `DECISIONS.md`, so only the orchestrator records plans, sign-off, waivers, and decisions.
Plan: .agent/main-plan/plan-spec-first-do-20261013.md

## 2026-10-13: Protected-path guard covers every subagent

Decision: fsa-write-bar denies Write, Edit, MultiEdit, and NotebookEdit on `.agent/main-plan/**` and `DECISIONS.md` for every subagent (any non-empty agent_type, including other plugins' agents). Assist-plugin agents other than developer are also barred from hidden paths, CLAUDE.md, CLAUDE.local.md, and AGENTS.md. sa-mermaid-only limits mmdc to `.mmd` input and `.svg`, `.png`, or `.pdf` output under `specs/`. /do dispatches registry agents by their qualified `assist-plugin:<name>`.
Plan: .agent/main-plan/plan-spec-first-do-20261013.md

## 2026-10-13: Narrow the hidden-path bar to pre-sign-off chain agents

Decision: corrects the previous entry. The hidden-path and auto-loaded-file bar (dot paths, CLAUDE.md, CLAUDE.local.md, AGENTS.md) applies to requirements-gatherer, solutions-architect, task-planner, and developer-tester, the agents that read untrusted documents before sign-off or write only tests. devops, worker, qa, general-purpose, and developer keep dot-path writes because CI and config files (`.github/`, `.gitlab-ci.yml`) are their work.
Plan: .agent/main-plan/plan-spec-first-do-20261013.md

## 2026-10-14: assist-plugin follows its own spec-first rule

Decision: this repo keeps requirements (`BRD-*.md`, `URD-*.md`, `FR-NFR-*.md`) and task plans (`task-plan-*.md`) at the repo root and specs under `specs/`, where /do's SpecGate looks. The requirements and specs cover the whole plugin; task plans cover work still to do. `plugins/assist-plugin/CHANGELOG.md` becomes a pointer to the root `CHANGELOG.md`, which is the only release log.
Plan: .agent/main-plan/plan-commit-and-followups-20261014-1204.md

## 2026-10-14: Write guard lists live in rules/assist-plugin-rule.md

Decision: the protected paths, auto-loaded file names, and the task-planner glob that fsa-write-bar enforces are listed in one `## Write guard lists` section of `plugins/assist-plugin/rules/assist-plugin-rule.md`, one table per list with the exact code string in backticks; `agents/task-planner.md` carries a one-row Write scope table for its glob. `check-fsa-tables.js --check` compares these tables with `hooks/lib/fsa-paths.js`, and the markdown wins.
Plan: .agent/main-plan/plan-commit-and-followups-20261014-1204.md

## 2026-10-16: docs/tts exemption covers the project root and the session directory

Decision: refines the 2026-10-12 entry. prose-gate and prose-advisor exempt `docs/tts/` under the project root (`CLAUDE_PROJECT_DIR`, else the git root found by walking up for `.git`, else the hook cwd) and also under the session's working directory when that directory is inside the project, so worktree and subdirectory sessions keep working and `/voice-script` keeps saving under the session directory.
Plan: .agent/main-plan/plan-commit-and-followups-20261014-1204.md

## 2026-10-16: Requirements in docs/requirements/, task plans in docs/task-plans/

Decision: corrects the location part of the 2026-10-14 "assist-plugin follows its own spec-first rule" entry. gather-requirements writes BRD, URD, and FR-NFR documents to `docs/requirements/`, and task-plan writes task plans to `docs/task-plans/`; specs stay in `specs/`. In an older project that keeps these files at the repo root, /do records their location in DECISIONS.md and leaves them there unless the user asks to move them; SpecGate searches the new folders plus any location DECISIONS.md records. This repo's requirements move to `docs/requirements/`.
Plan: .agent/main-plan/plan-commit-and-followups-20261014-1204.md

## 2026-10-16: Legacy root documents and the requirements JSON

Decision: task-planner writes only `docs/task-plans/task-plan-*.md`; root-level task plans in older projects stay where they are and are still read, and a rework of one writes a new file in `docs/task-plans/`. `requirements-<slug>.json` goes to `docs/requirements/`. SpecGate also searches the old root patterns (`./BRD-*.md`, `./URD-*.md`, `./FR-NFR-*.md`, `./requirements-*.json`, `./task-plan-*.md`); on a hit with no DECISIONS.md record, /do records the location after the user approves the plan and keeps the files in place.
Plan: .agent/main-plan/plan-commit-and-followups-20261014-1204.md

## 2026-10-16: Legacy location records are notes, not search input

Decision: when /do finds an older project's requirements or task plans at the repo root, it appends a plain DECISIONS.md entry saying the project keeps them there, so they are not moved unless the user asks. SpecGate finds them through its fixed root patterns and never parses paths out of DECISIONS.md. This replaces the proposed `Location:` line form.
Plan: .agent/main-plan/plan-commit-and-followups-20261014-1204.md

## 2026-10-16: docs/requirements/ and docs/task-plans/ resolve against the session's git root

Decision: `docs/requirements/` and `docs/task-plans/` resolve against the git root of the session's working directory (a worktree uses its own root), falling back to the working directory outside a git repository. SpecGate searches there, gather-requirements and task-plan write there, and fsa-write-bar judges task-planner's `docs/task-plans/task-plan-*.md` against that root. A session started in a subdirectory gets a write prompt, because the skills' `./` grants are relative to the working directory.
Plan: .agent/main-plan/plan-commit-and-followups-20261014-1204.md

## 2026-10-16: 1.11.1 design points for root notes, change check, and grants

Decision: /do reads only the headings of DECISIONS.md, at plan approval just before it appends a "kept at the repository root" note, to skip a duplicate; SpecGate still reads none of the files it lists, and heading text is untrusted. The change check takes its snapshots and steering-file hashes (`.claude/settings*.json`, `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `DECISIONS.md`) against the session's git root. gather-requirements keeps its grant scoped to `docs/requirements/`, so an in-place update of a legacy root-level requirements file asks the user first. When a hook input has no usable working directory, fsa-write-bar lets task-planner write only a plain relative `docs/task-plans/task-plan-*.md` and denies absolute, `~`, drive-relative, and `..` targets.
Plan: .agent/main-plan/plan-commit-and-followups-20261014-1204.md

## 2026-10-16: 1.11.1 documents signed off; tests folder and latency method

Decision: the requirements in `docs/requirements/`, the specs in `specs/`, and the task plan `docs/task-plans/task-plan-followups-1-11-1-20261016-070112.md` are approved for the 1.11.1 build. The repo gains a root-level `tests/` folder of plain `node` tests written by developer-tester and run by qa. NFR-008 is measured as the median of 20 runs of each per-write hook on the named 2 KB inputs, against a 110 ms limit. The 31 open points about 4803a0d behavior (OPEN-1 to OPEN-7, OP-1 and OP-3 to OP-14, OP-B1 to OP-B5 and OP-B7 to OP-B12) are deferred as follow-up requests.
Plan: .agent/main-plan/plan-commit-and-followups-20261014-1204.md

## 2026-10-16: OWASP for LLM gate is a named /do gate covering skills/**

Decision: /do runs the OWASP for LLM review as its own named gate on reviewer or code-reviewer, triggered by changes to `agents/`, any file under `skills/**` (including `metadata.json` and nested reference files), `rules/`, `hooks/`, or `CLAUDE.md`.
Plan: .agent/main-plan/plan-apply-deferred-decisions-20261016-1130.md

## 2026-10-16: Specs resolve against the session's git root

Decision: extends the 2026-10-16 git-root entry to `specs/`. The /do Spec chain step writes and names `<root>/specs/...`, so specs, requirements, and task plans share one root in a subdirectory session.
Plan: .agent/main-plan/plan-apply-deferred-decisions-20261016-1130.md

## 2026-10-16: /do PR review relays a draft, then a separate step submits

Decision: under /do, the read-only reviewer drafts the PR verdict and ends NeedsInput; /do relays it to the user, and a separately approved step by an agent with Bash submits it through /pr-review.
Plan: .agent/main-plan/plan-apply-deferred-decisions-20261016-1130.md

## 2026-10-16: /bump --path naming and pointer changelogs

Decision: `/bump --path <dir>` commits `chore: bump <dir> to X.Y.Z` and tags `<dir-with-slashes-as-dashes>-vX.Y.Z`. When the target CHANGELOG is a pointer to another changelog, /bump writes the release entry into the file it points to. `--no-commit` creates no tag.
Plan: .agent/main-plan/plan-apply-deferred-decisions-20261016-1130.md

## 2026-10-16: skills metadata.json mirrors SKILL.md frontmatter

Decision: each `skills/*/metadata.json` is a mirror of its SKILL.md frontmatter fields, specified by a requirement, covered by the LLM gate, and checked by tests.
Plan: .agent/main-plan/plan-apply-deferred-decisions-20261016-1130.md

## 2026-10-16: A non-plugin --agent main session is a main session

Decision: refines the 2026-10-13 protected-path entry. fsa-write-bar treats a call with an `agent_type` but no `agent_id` (a main session started with `--agent`) as the main session, so /do running under a custom main agent can still write `DECISIONS.md` and `.agent/main-plan/**`. Subagents (an `agent_id` present) stay denied.
Plan: .agent/main-plan/plan-apply-deferred-decisions-20261016-1130.md

## 2026-10-16: Documentation CLI guard and injection filter cover PowerShell and launchers

Decision: doc-cli-guard and the injection filter judge PowerShell commands as well as Bash (the filter includes `Invoke-WebRequest` and `Invoke-RestMethod`), recognize Windows program names (either path separator, `.exe` suffix), and treat package runners (`npx`, `bunx`, `pnpm dlx`, `node <path>`) as wrappers, stripping `@version`.
Plan: .agent/main-plan/plan-apply-deferred-decisions-20261016-1130.md

## 2026-10-16: /commit runs on Haiku through frontmatter

Decision: the commit skill sets `model: haiku` in its frontmatter, if Claude Code skill frontmatter supports the field; otherwise the user decides again.
Plan: .agent/main-plan/plan-apply-deferred-decisions-20261016-1130.md

## 2026-10-16: The main conversation submits a /do PR review; mmdc reaches root specs

Decision: refines the earlier 2026-10-16 PR review entry: after the user confirms the relayed draft, the /do main conversation submits the review with /pr-review; no subagent posts to the PR host. sa-mermaid-only also accepts absolute `-i` and `-o` paths under `<git root>/specs/`, found by walking up for `.git`, so diagram rendering works in a subdirectory session. The named OWASP for LLM gate uses the Security gate's iteration bound and binding final code-reviewer pass.
Plan: .agent/main-plan/plan-apply-deferred-decisions-20261016-1130.md

## 2026-10-16: /do PR review draft arrives in a Done block; more package runners

Decision: refines the two earlier 2026-10-16 PR review entries: the reviewer ends Done with its approved or returned verdict and the draft in its report, since its States table has no NeedsInput exit; /do shows the draft, and the main conversation submits after the user confirms. The package-runner wrappers also include `npm exec`, `pnpx`, `yarn dlx`, and `bun x`.
Plan: .agent/main-plan/plan-apply-deferred-decisions-20261016-1130.md

## 2026-10-16: LLM gate trigger, branch grant, mmdc root paths, and PR flags

Decision: the named OWASP for LLM gate keeps `.claude/settings*.json` in its trigger. The branch skill's `Bash(git:*)` grant is an accepted NFR-013 exception. sa-mermaid-only accepts absolute paths only under `<git root>/specs/`, walking up from the hook input's cwd, and denies absolute paths when no `.git` is found. In a /do PR review the main conversation fetches the PR and passes it to the reviewer as untrusted data; on confirmation, `approved` maps to `--approve`, `returned` to `--changes-requested`, and the user may choose `--comment` instead. In "answer N, block M" citations each answered question is its own answer N.
Plan: .agent/main-plan/plan-apply-deferred-decisions-20261016-1130.md

## 2026-10-16: Read-only program grants are scoped; Bitbucket returned reviews comment

Decision: under NFR-013, a Bash grant for a fixed program that only reads (such as `df`, `realpath`, `govulncheck`) counts as scoped with no subcommand. On Bitbucket, a `returned` PR review verdict posts a comment with the findings and leaves the PR open; `/pr-review` no longer maps `--changes-requested` to `bkt pr decline`, and declining stays a manual choice.
Plan: .agent/main-plan/plan-apply-deferred-decisions-20261016-1130.md

## 2026-10-16: LLM gate path anchor, metadata source, PowerShell aliases, writing-context self-test

Decision: the OWASP for LLM gate matches `agents/`, `skills/`, `rules/`, `hooks/`, and `CLAUDE.md` at the repository root, under any `plugins/<name>/`, and under `.claude/`; an application folder such as `src/hooks/` does not trigger it. SKILL.md frontmatter is the source for each `metadata.json`; the debug skill gains `effort: high` to match its metadata. The injection filter treats the PowerShell aliases `iwr` and `irm` as `Invoke-WebRequest` and `Invoke-RestMethod`, and matches PowerShell cmdlets, variables, and Windows program names without regard to case; Bash matching stays as built. A failed writing-context self-test is reported and never disables writing-context.
Plan: .agent/main-plan/plan-apply-deferred-decisions-20261016-1130.md

## 2026-10-16: Auto-loaded files join the LLM gate; mmdc reaches subproject specs

Decision: the OWASP for LLM gate also triggers on any `CLAUDE.md`, `CLAUDE.local.md`, or `AGENTS.md` at any depth, since Claude Code loads them into the model's context. Refines the earlier mmdc entries: sa-mermaid-only also accepts absolute paths under `<git root>/<dir>/specs/`, with the same segment rules, so diagrams render where the Spec step writes in a multi-project repository.
Plan: .agent/main-plan/plan-apply-deferred-decisions-20261016-1130.md

## 2026-10-16: One confirmation covers a /do PR review submission

Decision: in a /do PR review, the user's yes to /do's prompt for a draft is the /pr-review confirmation for that identical draft text in the same main-conversation turn, and /pr-review submits it without re-drafting or asking again. Any other pre-supplied /pr-review flag still asks before a state-changing command.
Plan: .agent/main-plan/plan-apply-deferred-decisions-20261016-1130.md

## 2026-10-16: /do fetches PRs by redirect and posts with gh or bkt

Decision: refines the earlier 2026-10-16 PR review entries. /do fetches a PR by running `gh` or `bkt` through Bash with output redirected into `.agent/pr-review/pr-<N>.diff` (capped at 200 KB, with any cut recorded), so the untrusted PR text never enters /do's context; only the reviewer reads it. After the user confirms the draft, /do posts it with `gh pr review --approve`, `--request-changes`, or `--comment`, or `bkt pr approve` or `bkt pr comment`, passing the draft through a body file with a non-prose extension. /do does not call /pr-review for this, so the one-confirmation exception for /pr-review is withdrawn; /pr-review always confirms on its own. This is the one delivery action /do performs itself.
Plan: .agent/main-plan/plan-apply-deferred-decisions-20261016-1130.md

## 2026-10-16: doc-cli-guard judges every chained command; PowerShell assignment forms

Decision: doc-cli-guard splits a command at `;`, `&&`, `||`, `|`, and newlines and judges each part, as the injection filter does. The injection filter skips a leading `$name =` or `$env:NAME =` assignment and an opening `(` or `$(` before reading the PowerShell program word. When /bump stops on an unclear CHANGELOG, it asks the user to write in place, name another target that passes the same checks, or skip the changelog, and continues the same run with the answer.
Plan: .agent/main-plan/plan-apply-deferred-decisions-20261016-1130.md

## 2026-10-16: Shell operators stay denied in documentation CLIs; Bitbucket approvals; test DSNs

Decision: refines the chained-command entry: doc-cli-guard still denies any shell metacharacter in a whole command when any part runs `ctx7` or `firecrawl`; per-part judging adds checks and removes none. On Bitbucket, an approved /do PR review runs `bkt pr approve` and then `bkt pr comment` with the draft under the one confirmation; a failed comment is reported and the approval stands. Skill reference examples build database URLs from variables, so no literal credential remains.
Plan: .agent/main-plan/plan-apply-deferred-decisions-20261016-1130.md

## 2026-10-16: doc-cli-guard is best-effort with a listed set of known gaps

Decision: doc-cli-guard stays a best-effort string-matching guard; Claude Code's permission prompts remain the primary control. 1.12.0 adds `exec`, `sudo`, and `eval` as wrappers and closes the PowerShell assignment-before-hidden-name form; program words from variables, brace expansion, globs, and programs that run other programs (`xargs`, `find -exec`, `watch`) are listed as known gaps. A bypass form found later is added to that list rather than reopening the spec.
Plan: .agent/main-plan/plan-apply-deferred-decisions-20261016-1130.md

## 2026-10-17: Deferred-decision documents signed off for 1.12.0

Decision: the requirements in `docs/requirements/`, the specs in `specs/`, and the task plan `docs/task-plans/task-plan-deferred-decisions-20261016-161827.md` are approved for the 1.12.0 build, with every spec reading and labeled choice S1 to S15 as written. The injection filter's gap for PowerShell downloads inside `{ }` script blocks is accepted as a known gap for 1.12.0 (S16), and the plan's edits that no spec names are kept (S14).
Plan: .agent/main-plan/plan-apply-deferred-decisions-20261016-1130.md

## 2026-10-17: /do PR review supports GitHub only in 1.12.0

Decision: refines the 2026-10-16 PR review entries. The bkt command forms in the specs and the pr-review references do not match the bkt CLI (v0.34.0 takes a numeric id with --project and --repo flags, uses `bkt pr view` and `bkt pr comments`, and `bkt pr comment` takes `--text`, not `--message-file`). For 1.12.0 the /do PR review flow supports `github.com` remotes only; any other host, Bitbucket included, fails the step with precondition-failed and the message to run /pr-review directly. Correcting the bkt forms everywhere, including /pr-review's existing references, is a follow-up.
Plan: .agent/main-plan/plan-apply-deferred-decisions-20261016-1130.md

## 2026-10-17: /do PR flow hardening after the security gate

Decision: the /do PR review flow (GitHub only) also: pins the host with `--repo 'github.com/<owner>/<repo>'` on every gh call, so GH_HOST cannot redirect it; fails with policy-rejection when `<root>/.agent` or `<root>/.agent/pr-review` is a symlink and removes each target file with `rm -f` before writing it; writes the draft body only with the Write tool, never through a heredoc, echo, or printf; treats a hash /do cannot recall as a mismatch; tells the reviewer that the draft is posted publicly as written and holds only findings on the diff (no local file contents beyond a cited line, no environment values or secrets, no paths outside the diff) and never quotes instruction-like PR text. New doc-cli-guard and injection-filter bypass forms found in review (PowerShell typographic quotes, block comments, the dot-source operator, typed and scoped assignments, leading redirections, `sudo --user`) go on the known-gaps list per the 2026-10-16 best-effort entry.
Plan: .agent/main-plan/plan-apply-deferred-decisions-20261016-1130.md

## 2026-10-17: code-reviewer and researcher run at effort high

Decision: the user changed the frontmatter `effort` of the code-reviewer and researcher agents from `xhigh` to `high`; the agent bodies, `skills/do/references/model-routing.md`, the LLM security checklist, and the orchestration specs follow. reviewer, solutions-architect, planner, and /do keep `xhigh`.
Plan: .agent/main-plan/plan-apply-deferred-decisions-20261016-1130.md

## 2026-10-22: PR posting safeguards and Bitbucket in the PR review flows

Decision: a PreToolUse ask hook covers every session and asks before PR posting commands: gh pr review, merge, comment, and close; bkt pr approve, comment, decline, close, and merge; and bkt api with a POST, PUT, PATCH, or DELETE method. /do removes its `pr-<N>*` files under `.agent/pr-review` right after a post or a "do not post" answer and sweeps leftovers at Cleanup, never through a symlinked folder. Every `.agent` write /do makes (plan file, snapshots, PR files) gets a symlink check. Bitbucket host pinning refuses when BKT_TOKEN, BKT_HOST, or BKT_CONFIG_DIR is set, requires the chosen bkt context's base URL to match the origin host, passes `--context` and the repository flags on every call, and on Cloud compares the PR link with the expected URL. Request changes on Bitbucket Cloud uses the raw `bkt api` request-changes call with a relative path; on Data Center it posts a comment and leaves the PR open. `/bump --path` accepts only a relative path (or an absolute path inside the git root) matching `^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$`, with no `..` or leading-dash segment, naming an existing directory inside the repository; any other value stops before any change.
Plan: .agent/main-plan/plan-post-1-12-0-followups-20261017-0406.md

## 2026-10-22: Bitbucket request-changes order, hook rejection, and stricter checks

Decision: refines the earlier 2026-10-22 entry. On Bitbucket Cloud a returned verdict posts the findings as a comment first and then makes the request-changes call; when the comment fails, no request-changes call is made. Rejecting the ask-hook prompt after a /do confirmation leaves the step completed with the post recorded as declined, no retry, and the PR files removed; when only the second prompt of a Bitbucket approve-then-comment pair is rejected, the approval is recorded as posted and the comment as declined. `/bump --path` also rejects a segment made only of dots and is normalized before validation. Cleanup matches `pr-<N>.*` and `pr-<N>-*` only. The ask hook also asks on a `bkt api` call with a body flag and no method, until the bkt default method is confirmed. Requirements: FR-143, FR-195, FR-206, FR-208, FR-209 (docs/requirements/FR-NFR-assist-plugin.md, section 9 open points 3, 5, 6, 7, 9).
Plan: .agent/main-plan/plan-post-1-12-0-followups-20261017-0406.md

## 2026-10-22: Each Bitbucket post is its own command; a rejected prompt stops the pair

Decision: each bkt post (approve, comment, the Cloud request-changes call) runs as its own Bash command with its own ask-hook prompt. Rejecting the first prompt of a pair runs no second command and records both as declined. On Cloud, an allowed comment followed by a rejected request-changes prompt records the comment as posted and the request as declined. The step is completed and the PR files are removed, as for a "do not post" answer.
Plan: .agent/main-plan/plan-post-1-12-0-followups-20261017-0406.md

## 2026-10-22: bkt api repository flags and unknown options

Decision: a `bkt api` call names the repository through its relative path; repository flags are added only if a build-time read of the bkt source shows `bkt api` accepts them (reading of FR-203). The PR posting ask hook also asks on any `bkt api` option it does not recognize, beyond the FR-206 list; asking adds prompts only and never blocks.
Plan: .agent/main-plan/plan-post-1-12-0-followups-20261017-0406.md

## 2026-10-22: Follow-up build scope, supersession, and timing method

Decision: the 2026-10-22 entries at lines 223-241 replace the GitHub-only limit of the /do PR review flow (lines 208-211) and, for Bitbucket Cloud, the comment-only request-changes rule (lines 163-166). The build of `docs/task-plans/task-plan-post-1-12-0-followups-20261022-143806.md` reuses that gated task plan, pauses for the user before the 1.13.0 hand release and again before the commit, creates no tag, and pushes nothing. The spec bodies and the FR-206 wording are folded after qa in the same run. The NFR-008 and NFR-025 timing method is confirmed: the median of 20 runs on a fixed input, with a 110 ms limit (a SHOULD; a median over it is a finding).
Plan: .agent/main-plan/plan-build-post-1-12-0-followups-20261022-1612.md

## 2026-10-22: Follow-up documents signed off; step 1 research results applied

Decision: the requirements v1.3 (`docs/requirements/`), the 2026-10-22 spec deltas and `specs/spec-hooks-pr-post-ask.md`, and `docs/task-plans/task-plan-post-1-12-0-followups-20261022-143806.md` with its labeled choices S1 to S14 are approved for the build. Step 1 confirmed from the bkt v0.34.0 source that `bkt api` sends GET with no method and no body and POST with a body, that `--method` (short `-X`) is the method option, that `bkt api` takes no repository flags (the spec stands), and that the `bkt --version` pattern holds. The two `--jq` filters (context lookup and PR-by-branch lookup) use the form that always prints a JSON array (`[]?` iteration inside an outer array), and "exactly one" means an array of length 1; the spec fold updates the spec text to match. The /pr-review and /do declined outcome is built on the documented separation of a rejected prompt from a command failure; the real rejection text is recorded by manual row 2. The ask hook's known-gap text also lists bypassPermissions mode, plan mode, and installed mods as unverified.
Plan: .agent/main-plan/plan-build-post-1-12-0-followups-20261022-1612.md

## 2026-10-22: /bump tag names and pr-post-ask gaps found in review

Decision: `/bump --path` also rejects a segment that starts with `.` or contains `..`, because such a value gives an invalid git tag name; the run stops before any file, commit, or tag changes (narrows FR-209 and FR-139; the fold updates the requirement and spec). The `pr-post-ask` hook closes three bypass forms found in the security review: it judges the text inside `$(...)` and backticks (as the whole command or an assignment value) as its own command, asks when the `pr`, verb, or `bkt` subcommand word holds `$` or a backtick, and skips redirection words between the program and the verb. It lists as known gaps the shared-parser forms doc-cli-guard already lists (brace expansion, globs in the program word, `<<` read as a heredoc in arithmetic, a long sudo option with a separate value) and the forms `$"..."` and `$'\x..'` quoting, `stdbuf --output`, argv wrappers outside the wrapper list (for example setsid, doas, ionice), shell aliases, and renamed or linked binaries. Every known-gap list (the hook spec, FR-206, /health, CLAUDE.md, Claude.md, README, ARCHITECTURE) is kept equal.
Plan: .agent/main-plan/plan-build-post-1-12-0-followups-20261022-1612.md

## 2026-10-22: pr-post-ask is a best-effort guard

Decision: the `pr-post-ask` hook is a best-effort string-matching guard, like doc-cli-guard (2026-10-16 entry); Claude Code's permission prompts and the skills' own confirmation remain the primary control. One last in-file change closes the cheap forms: a quote-aware scan of every `$(...)` and backtick span in an assignment value or program word, an ask (not a pass) when the substitution depth limit is reached, and the run-time-expansion test on option values before the verb. The remaining forms found in review (redirections the shared lexer splits such as `2>&1`, `&>`, `>|`, and `< <(...)`; PowerShell `@(...)` arrays and script blocks in the verb position; a PowerShell comment that hides an opening parenthesis) are listed as known gaps, and a bypass form found later is added to every gap list without reopening the spec. The shared lexer is not changed in this release.
Plan: .agent/main-plan/plan-build-post-1-12-0-followups-20261022-1612.md

## 2026-10-22: PR file cleanup by name, and pre-release fixes

Decision: the PR file cleanup uses no glob patterns. /do removes the five PR files of PR `<N>` by exact name with `rm -f --`, after the symlink guard; /pr-review first checks that the run folder path starts with the `mktemp` template prefix, removes its known files by name, then removes the folder with `rmdir`. Both forms work in bash and zsh, and an executed test runs them under zsh when zsh is installed. On Bitbucket, the body-hash check runs as its own command before `bkt pr approve`, so a changed body file stops the post before the approval. CLAUDE.md, Claude.md, and ARCHITECTURE.md say "whether an installed mod can approve", and both link-check notes say `--jq` prints strings JSON-quoted. Corrections recorded with this entry: the `/bump` R6 check is `test -d` with no `--` (bash's `test` rejects `--`); "exactly one" for the context lookup in the 2026-10-22 research entry means exactly one element that meets the Match rule, not an array of length 1, since the filter lists every configured context.
Plan: .agent/main-plan/plan-build-post-1-12-0-followups-20261022-1612.md

## 2026-10-22: Where the pr-post-ask gap list lives

Decision: clarifies the 2026-10-22 entry on pr-post-ask gaps. The full known-gap list is kept equal in five places: the hook's header comment, the hook spec's Requirement 9, FR-206, the /health overview, and README.md. CLAUDE.md, plugins/assist-plugin/Claude.md, and docs/ARCHITECTURE.md carry a short pointer that the hook is best-effort with known gaps, plus the unverified items, and do not repeat the list.
Plan: .agent/main-plan/plan-build-post-1-12-0-followups-20261022-1612.md

## 2026-10-23: Voice scripts carry no em dashes

Decision: /voice-script writes no em dash (U+2014) in script text, so its files pass other tools' prose gates (the AtticAI kit's banned-phrase-gate included) without a change to those tools. Pause marks follow each model file: a spaced hyphen where the file says the model handles a dash, else ASCII `...`, commas, or line breaks. An em dash in a user's draft is replaced with the allowed pause mark and the header notes count the swaps; curly quotes in a draft are straightened with a header note. prose-gate and prose-advisor drop the `docs/tts/` skip, so voice scripts are gated like any prose file; this supersedes the 2026-10-12 entry on prose hooks skipping `docs/tts/` and the 2026-10-16 refinement of its roots. `docs/tts/` stays the save folder.
Plan: .agent/main-plan/plan-voice-script-no-em-dash-20261023-0554.md

## 2026-10-23: Voice script pause marks and draft tells

Decision: refines the 2026-10-23 entry on voice scripts without em dashes, after it was found that both assist-plugin's prose hooks and the AtticAI kit's banned-phrase-gate skip fenced blocks, so the kit denies an em dash only in a voice script's header or notes. Full scope kept: no U+2014 anywhere in a saved voice script. The skill enforces it in the fenced script blocks, which stay exempt from the prose hooks under FR-105; prose-gate enforces it in the header and notes. User text the skill copies into the header (title, delivery direction) is normalized the same way as a draft. Pause marks are only those the chosen model file lists: listed pause tags stay allowed (FR-162); Gemini 3.8 TTS uses the double hyphen its file lists; a model whose file lists no dash, Chatterbox-Turbo included, falls back to marks its file permits (no line breaks on Chatterbox-Turbo); a model outside the catalog gets commas and periods only. In a draft, only em dashes (and U+2015) and curly quotes are swapped; other block-tier tells are kept, because the fenced text is exempt, and flagged in the header notes.
Plan: .agent/main-plan/plan-voice-script-no-em-dash-20261023-0554.md

## 2026-10-23: Voice script curly quotes, header dashes, and save retry

Decision: refines the two 2026-10-23 voice-script entries. A saved voice script holds no U+2014, U+2015, or curly quote anywhere, whatever the source of the text (topic, draft, or header). In header prose (title, delivery direction) an em dash becomes a comma or period, never a line break or double hyphen; a voice id or clip path the user types that holds U+2014 is refused and asked again. A model file that names only ordinary punctuation permits commas and periods only, as for a model outside the catalog; ElevenLabs v2 uses a spaced hyphen, its listed hyphen used as a dash. Kept draft tells are flagged in the header notes by tell family and draft line, without repeating their text. When prose-gate denies the save because of header text, the skill fixes the flagged text and retries once on the same path; a second deny prints the script in chat as before.
Plan: .agent/main-plan/plan-voice-script-no-em-dash-20261023-0554.md

## 2026-10-23: Voice script typed values and tag-model pause marks

Decision: refines the 2026-10-23 voice-script entries. A voice id, clip path, or model id the user types is recorded as typed and is refused and asked again when it holds U+2014, U+2015, or a curly quote. Model files that pair pause tags with punctuation guidance (xAI Grok, Fish Audio S2, MiniMax Speech 2.8, Gemini 3.1 TTS Preview) keep their listed tags, and their punctuation pause marks are limited to commas and periods; MiniMax also keeps its listed newline.
Plan: .agent/main-plan/plan-voice-script-no-em-dash-20261023-0554.md
