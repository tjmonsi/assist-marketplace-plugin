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

## 2026-10-28: Compliance profile flags, enforced by default

Decision: The SOC 2, HIPAA, and FERPA governance controls are configured through two files. A flag in the `env` block of the committed `.claude/settings.json` controls which profiles a project switches off; when the flag is absent all three are enforced, so the default needs no settings change (Claude Code's documented env mechanism, confirmed against `/anthropics/claude-code` `examples/settings/settings-hipaa.json` and the settings precedence in `mods/types/claude-code.d.ts`). The plugin hooks read the flag from `process.env`. The detailed data (PHI patterns, data-class path globs, BAA references) lives in a separate `.agent/governance/profile.json`. This resolves PN-2 (task plan `docs/task-plans/task-plan-harness-governance-20261028-0759.md:144`): the configuration is a settings flag plus a data file, not one `.agent/governance/profile.json` holding both toggles and data.

All three profiles are enforced by default: a project gets SOC 2, HIPAA, and FERPA controls active unless it opts out, rather than opting in. This flips the prior opt-in assumption for HIPAA and FERPA recorded at the task plan Step 23 note (`docs/task-plans/task-plan-harness-governance-20261028-0759.md:325`, citing BRD assumption A-9). Core audit logging stays always-on as before (FR-228).

Missing or malformed configuration: an absent configuration is the safe default, so the controls run in log-only mode and never hard-deny, because nothing is tagged to match. A malformed configuration while a profile is enforced fails closed, denying the guarded tagged-path operations until it is fixed. This is the fail-closed exception to the Hook Fail-Open Rule (`plugins/assist-plugin/rules/assist-plugin-rule.md:404-416`) that NFR-028 needs, and it settles decision D-1 (task plan `:127`).

Turning a check off is governed: the off switch is a change to the committed `.claude/settings.json` that the user applies, because the plugin never edits a settings file itself; the hooks honor only the committed project settings source, so a personal `.claude/settings.local.json` cannot silently disable enforcement (settings precedence per `mods/types/claude-code.d.ts` puts local above project, so the hooks read the project source directly rather than the merged value); each disablement writes a logged event (FR-228) and needs its own DECISIONS.md entry. `.claude/settings.json` and `.agent/governance/profile.json` are protected from subagent writes, which is the governance-profile part of decision D-2 (task plan `:128`, `:144`); the other D-2 paths (confirmation store, `.agent/logs/governance/**`, purpose record, rule-mode store) still need their own confirmation.
Plan: .agent/main-plan/plan-harness-governance-20261028-0759.md

## 2026-10-28: Compliance flag is read from the committed settings file directly

Decision: Corrects the read mechanism in the earlier 2026-10-28 entry "Compliance profile flags, enforced by default". That entry's first paragraph described the hooks reading the profile flag from the merged process environment, which contradicts its own fourth paragraph and FR-243. The authoritative mechanism is the direct read: the hooks parse the `env` block of the committed project `.claude/settings.json` themselves and never use the merged process environment, because Claude Code settings precedence (`mods/types/claude-code.d.ts`) places `.claude/settings.local.json` above the project file, so a merged process-environment read would carry a personal local override and silently disable enforcement. The flag's location is unchanged (the `env` block of the committed `.claude/settings.json`); only the read path is pinned to a direct parse of the committed project file. An absent flag in the committed file leaves all three profiles enforced. This supersedes the process-environment phrasing in the first paragraph of the earlier entry; the harness-governance requirements (FR-231, FR-243, the BRD technical constraint, and the JSON mirror) already state this direct read.
Plan: .agent/main-plan/plan-compliance-config-sync-20261028-1100.md

## 2026-10-28: FERPA/HIPAA purpose capture, missing-purpose handling, and governance path protection

Decision: Settles three compliance open items for the harness-governance roadmap.

Purpose capture (OQ-11, D-11): a hook writes the FERPA/HIPAA session purpose record from a purpose the user declares, and the access-logging hooks read that record. The writer is a hook, not the orchestrator, so model output or file and PR text in context cannot forge the stated purpose (the same trust model as the PR confirmation store). When the user declares no purpose, the access log records the purpose as `unstated` and flags the record.

Missing purpose (OQ-6): an access to a tagged path with no recorded purpose is logged as `unstated` and flagged, never denied on the missing purpose alone. A read-time hook sees a path, not a purpose, so a deny would block legitimate work; this keeps the FERPA access control (FR-230) a log control, not a deny control, on the purpose dimension.

Governance path protection (D-2, remaining paths): the confirmation store, `.agent/logs/governance/**`, the session purpose record, and the rule-mode store are added to the Write guard lists and protected from every subagent write, so a subagent cannot tamper with governance evidence or toggles. This settles the remaining D-2 paths; the `.claude/settings.json` and `.agent/governance/profile.json` paths were settled in the earlier 2026-10-28 entry as D-12.

OQ-9 (verify FERPA 34 CFR 99.32 and HIPAA 45 CFR 164.312(b) text): the user chose to verify now by a researcher pass; the verification outcome is recorded in a later entry. Until it lands, both controls stay labeled "to verify" per NFR-033.
Plan: .agent/main-plan/plan-harness-governance-20261028-0759.md

## 2026-10-28: OQ-9 resolved; FERPA control reframed, HIPAA scope tightened

Decision: Resolves OQ-9 from a read-only researcher verification against the cited regulation text (CFR 2023 editions on govinfo.gov: 34 CFR 99.32 at https://www.govinfo.gov/content/pkg/CFR-2023-title34-vol1/xml/CFR-2023-title34-vol1-sec99-32.xml ; 45 CFR 164.312(b) at https://www.govinfo.gov/content/pkg/CFR-2023-title45-vol2/xml/CFR-2023-title45-vol2-sec164-312.xml ).

HIPAA (45 CFR 164.312(b)): verified. The agent-level audit log of actions on PHI-tagged paths implements the Audit Controls standard's record function. The requirement wording is tightened: the standard requires mechanisms that record and examine activity, so the control must also support review of the log, and 164.312(b) is one required technical safeguard among several (access control, integrity, authentication, transmission security, plus administrative and physical safeguards), so the control is not described as full HIPAA compliance. The HIPAA audit control (FR-232) may be marked verified against 164.312(b) with this scope.

FERPA (34 CFR 99.32): the internal-access log does not implement 99.32. 99.32 governs recording disclosures of education-record PII to outside parties and requests for access, not an institution's internal reads; 99.32(d)(2) exempts a school official with legitimate educational interest (the analogue of an internal agent), and 99.32(a)(3)(ii) makes recording the party's legitimate interest mandatory, which conflicts with an optional "unstated" purpose. Chosen reframe (both): (1) keep the internal access log but recite it as general FERPA governance support, not 99.32 recordation; and (2) add a disclosure-recordation control on outbound education-record data, analogous to the PHI outbound guard: log each disclosure to an outside party with the receiving party and the legitimate interest, no "unstated" allowed, applying the 99.32(d) exceptions. The FERPA access requirement (FR-230) is split accordingly; the disclosure-recordation control is a new requirement, and only it is cited against 34 CFR 99.32. Outbound disclosure detection is imperfect and that limit is recorded with the new control.
Plan: .agent/main-plan/plan-harness-governance-20261028-0759.md

## 2026-10-30: FERPA disclosure control denies on missing attribution and is fail-closed

Decision: Specializes the FERPA disclosure-recordation control (FR-246), added under the 2026-10-28 "OQ-9 resolved; FERPA control reframed, HIPAA scope tightened" decision. When the control cannot record the receiving party or the legitimate interest for an outbound disclosure of education-record data, it denies the outbound send rather than logging and flagging, matching the PHI outbound guard (FR-233) chosen as its analogue and the "no unstated allowed" wording. Because it is deny-capable and guards student-record data leaving the session, FR-246 is added to the NFR-028 security-critical set, so it fails closed on an error, timeout, or unreadable configuration, as FR-233 does. This is the outbound-disclosure dimension; it does not change the internal FERPA access log (FR-230), which stays a log control that never denies on a missing purpose (OQ-6).
Plan: .agent/main-plan/plan-harness-governance-cleanup-20261030-0617.md

## 2026-10-30: FR-246 disclosure attribution comes from the payload, validated against a profile.json allowlist

Decision: Settles PN-9 (the declaration source for the FERPA disclosure-recordation control, FR-246), which blocked task-plan Step 27a. For each outbound disclosure of education-record data, the receiving party and the legitimate interest are declared in the outbound call payload itself, and the guard (a PreToolUse hook, which does file reads only) parses them from that payload. The receiving party is validated against an allowlist of permitted parties held in `.agent/governance/profile.json`, the data file already protected from subagents under FR-245 (path 2 of six). A call that omits the receiving party or the legitimate interest, or that names a receiving party not on the `profile.json` allowlist, is treated as missing attribution and denied, consistent with the 2026-10-30 "FERPA disclosure control denies on missing attribution and is fail-closed" decision. The 34 CFR 99.32(d) exception list stays in `profile.json` as already planned. No new store and no seventh protected path are added: FR-245 stays at six paths, and `profile.json` is the trust anchor. Residual limit, recorded with the control (NFR-033, and the FR-246 / FR-233 imperfect-detection note): the party and interest fields originate in a payload a subagent assembles, so the `profile.json` allowlist (a protected file a subagent cannot write) is the real control on which parties pass, not the raw payload text; outbound disclosure detection stays imperfect and the control's status stays "to verify". This unblocks Step 27a; the requirements (FR-246, and FR-245's "six paths unchanged" note) and the task plan (Step 27a, PN-9) are synced to this decision in a follow-up.
Plan: .agent/main-plan/plan-harness-governance-cleanup-20261030-0617.md

## 2026-10-30: Audit-logging stores settled (per-access split, rotation and retention, confirmation-store writer)

Decision: Settles three open items of the harness-governance audit-logging design (D-5/OQ-4, D-6/OQ-3, D-10/OQ-10).

Per-access store and attribution split (D-5, OQ-4): the two-file design of FR-227 is ratified as written. The per-access audit log `audit.jsonl` records, per access event, the operation, the data accessed (path and data-class tag only, never content), the agent identity, the human authorizer, and the timestamp. The subagent log `fsa-log.jsonl`, written once per subagent report, adds only the agent identity and the human authorizer to each report row and holds no operation or data-accessed field. The two stores stay separate; no combined log.

Rotation and retention (D-6, OQ-3): the 500-line cap on `fsa-log.jsonl` is replaced by size-based rotation. Each log rotates at a configured byte size, and each new segment records the prior segment's final chain hash so the hash chain stays verifiable across the cut (NFR-030, NFR-032). Segments are retained at least 12 months to cover the SOC 2 window. The exact rotation size is an implementation value, labeled an estimate until measured against the NFR-030 verification-time target; it is not a hard figure fixed here. This applies to both the audit log and the subagent log where each is chained.

Confirmation-store writer and form (D-10, OQ-10): the FR-242 confirmation store is written by a hook on `UserPromptSubmit`, not by the orchestrator. The hook records each confirmation (the PR, the verdict, the timestamp, a reference to the user message it came from, and the writer marked `hook`) as JSONL under a path in `.agent/` that is already protected from every subagent write under FR-245. A hook's output cannot be forged by model text or by PR, web, or file content, which is the same trust model as the FR-247 purpose-capture hook and the FR-242 requirement that a subagent and PR/web/file text cannot create or alter a record. The FR-214 PR-posting guard reads the store with file reads alone. The hook ships with an ES5 entry file, a timeout, a self-test corpus (NFR-035), and the D-1 fail-closed behavior for its guarded class.

These resolve OQ-3, OQ-4, and OQ-10 and unblock Steps 2, 3, 4, 11, 12, 13, 22, and 29. The requirements and the task plan are synced to these decisions in a follow-up batch.
Plan: .agent/main-plan/plan-harness-governance-20261028-0759.md

## 2026-10-30: Gap-3 push grant and gap-6 revision-loop cap settled

Decision: Settles the two remaining Tranche 1 gap-closure items of the harness-governance roadmap (D-3 and D-7/OQ-2).

Push grant (D-3, gap 3): the project standardizes on the grant `Bash(git push origin *)` in place of the broad `Bash(git push *)`, matching FR-216. The plugin never edits a settings file; the user applies the narrow grant in `.claude/settings.local.json`, and `/assist-plugin:health` flags any `permissions.allow` entry that grants `git push` without `origin` or a broader family that includes it. The health-check code and the documentation recommendation ship regardless (Step 7); gap 3 is marked closed (Step 10) only after the user has applied the narrow grant.

Revision/review iteration cap value (D-7, OQ-2, gap 6): the documents standardize on a cap of 10 iterations, with two consecutive LGTMs as the normal pass, which is the review-protocol behavior already in force. FR-218's roadmap default of 3 is raised to 10 so the requirement and the review protocol agree on one number; the scattered "max 10" / "10 iterations" mentions stay at 10 and are reconciled to this single value.

At-cap behavior (D-7, OQ-2): FR-218 wins over the review protocol's "Exhausting a gate" step. At the cap the orchestrator runs no further developer or reviewer round; it presents the unresolved findings to the user with the choices continue, waive, or abort, and records a waive in the plan file the way other waiver state is recorded (`.agent/main-plan/**`, orchestrator-written). The review protocol's "one binding code-reviewer pass at the bound" is amended to this escalation, so the two no longer conflict.

These resolve OQ-2 and unblock Steps 7, 8, and 10 (gaps 3 and 6). The requirements (FR-216 already states the grant; FR-218's cap default) and the task plan and the review-protocol documents are synced to these decisions in a follow-up batch; the review-protocol change is on the LLM surface, so its implementation (Step 8) takes the OWASP-for-LLM gate.
Plan: .agent/main-plan/plan-harness-governance-20261028-0759.md

## 2026-10-30: Judgement-gate evidence and the /do human authorizer settled

Decision: Settles two open items of the harness-governance evidence and attribution design (D-8/OQ-1 and OQ-7).

Evidence for judgement-based gates (D-8, OQ-1): a judgement-based gate (OWASP Clear, LLM Security Clear, Approved for merge) clears only on two pieces of evidence together, per FR-221: a scanner exit code and a verdict from a reviewer agent other than the producer carrying file:line findings. The required scanner exit code comes from the plugin's own scripts, which are always present: `check-fsa-tables.js`, `sync-writing-standard.js`, the FR-217 pattern/secret scanner, and the health self-tests. An external security scanner (for example semgrep or CodeQL) is optional: when one is installed its exit code is recorded as additional evidence, but a gate never depends on an external scanner being present, so it can always clear on the in-plugin exit code plus the reviewer verdict. A sign-off string emitted by a model never clears a gate, and the orchestrator, not the reviewer, writes the gate record; reviewers stay read-only (NFR-027).

Human authorizer under /do (OQ-7): the human authorizer recorded in the FR-227 attribution fields is the user who approved the plan, recorded as a reference to that approval (the plan's "Approved" decision or the approval message id), never the message text (NFR-031). Actions the approved plan authorizes carry that reference. An autonomous action, or one with no user approval, records the authorizer field as `none` with a reason; the field is never omitted (FR-229 scenario). This needs no per-action prompt.

These resolve OQ-1 and OQ-7 and unblock Steps 18 and 22. The requirements and the task plan are synced to these decisions in a follow-up batch.
Plan: .agent/main-plan/plan-harness-governance-20261028-0759.md

## 2026-10-30: Severity-policy basis and SARIF writer settled

Decision: Settles the two Tranche 4 items of the harness-governance roadmap (D-4 basis and D-9/OQ-8), with one part of D-4 deferred as noted.

Severity-policy basis (D-4, partial): FR-237 requires a severity policy approved in DECISIONS.md before any rule blocks on severity, but the policy text is not yet drafted, so it is not formally approved here. The basis the draft MUST follow is settled now: the four levels (CRITICAL, HIGH, MEDIUM, LOW) are aligned to a recognized rubric (OWASP risk rating or CVSS bands) and carry repo-specific examples drawn from this plugin's hook and LLM-surface risks; each finding carries a confidence level of High, Medium, or Low; and the SARIF result-level mapping is CRITICAL and HIGH to error, MEDIUM to warning, LOW to note. Step 31 drafts `rules/severity-policy.md` to this basis, and the user formally approves the concrete policy text with a later DECISIONS.md entry (whose exact heading Step 31 fixes so Step 32 can read it). Until that approval entry exists, no rule blocks on severity; the advisory-baseline-first rule of FR-238 still applies. This resolves the basis of D-4; the formal policy approval stays open.

SARIF writer (D-9, OQ-8): the component that writes the SARIF file is the /do orchestrator. The reviewer agents are read-only (Read, Grep, Glob, LSP) and cannot write, so a reviewer returns the SARIF content or the findings and the orchestrator writes the `.sarif` file, the same component that already writes plan files and gate records (consistent with the D-8 decision that the orchestrator, not the reviewer, writes the gate record). No subagent write path is added to the write bar. Uploading the SARIF to GitHub is a posting action and falls under the FR-214 confirmation rule. `lib/sarif.js` stays a pure converter (SARIF 2.1.0, result level from severity, location from file and line; a finding with no location is left out and listed as not exported with the reason).

D-9/OQ-8 is resolved and unblocks Step 34. D-4's basis unblocks the drafting of Step 31, with its formal approval still pending the drafted policy; Steps 32, 33, 35, 36 stay blocked on that approval. The requirements and the task plan are synced to these decisions in a follow-up batch.
Plan: .agent/main-plan/plan-harness-governance-20261028-0759.md

## 2026-10-30: Severity policy approved

Decision: The user approves the severity policy at `plugins/assist-plugin/rules/severity-policy.md`, version `draft-1`, as written. This is the formal approval that FR-237 and the 2026-10-30 "Severity-policy basis and SARIF writer settled" entry left pending (D-4), and it completes D-4. The policy may now back a blocking rule, subject to the advisory-baseline-first promotion gate it defines (FR-238): a rule still runs advisory first, produces a baseline report, meets the precision bar, and is promoted by a user-recorded step before it blocks. The approved draft resolves its open items as written: gaps 2 and 3 are rated HIGH (not CRITICAL) because a control stands in the path; a finding blocks only at confidence High and severity HIGH or CRITICAL (a CRITICAL at Medium confidence routes to an inline comment, not a block); no per-level `security-severity` score is added for the GitHub Security tab (CRITICAL and HIGH share the SARIF `error` level, with the severity name carried in the result properties bag); no demotion rule from blocking back to advisory is added (the requirements define none); and the `llm-security-checklist.md` gap table is not re-rated to these levels. Editing `severity-policy.md` after this raises its version and needs a fresh approval entry. The approval entry was created by the orchestrator at the user's explicit direction, not by a subagent (subagents are denied writes to `DECISIONS.md`).
Plan: .agent/main-plan/plan-govdocs-sync-severity-20261030-0920.md
