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
