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
