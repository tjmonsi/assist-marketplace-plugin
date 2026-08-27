# Security Gaps Fix + LLM Governance Integration

**Status:** Approved  
**Created:** 2026-08-27 18:03 UTC  
**Scope:** Fix 3 HIGH-severity LLM security gaps, then integrate governance  
**Model:** developer (Sonnet)

## Objective

Fix security vulnerabilities discovered by LLM security checklist (Task 1 output), then integrate the checklist into governance rules.

---

## Tasks

### Task 1: Add `tools:` Frontmatter to Agent Files

**Status:** completed  
**Done:** 2026-08-27 18:10 — All 12 agents have `tools:` frontmatter per role restrictions  
**Background:** yes  
**Model:** developer (Sonnet)  
**Effort:** medium  

**Goal:** Add `tools:` field to all 12 agent files to restrict tool access per agent role.

**Context files:**
- `plugins/assist-plugin/agents/*.md` (all 12 agent files)
- `plugins/assist-plugin/skills/do/references/agent-registry.md` (source of truth for tool access)

**Task prompt:**
Add `tools:` frontmatter field to each agent file. Frontmatter format:
```yaml
---
name: agent-name
description: ...
type: ...
model: ...
effort: ...
tools: [list of tools]
---
```

Tool restrictions per agent-registry.md:
- **reviewer, code-reviewer:** Read, Grep, Glob only (no Write/Edit/Bash)
- **explore:** Read, Grep, Glob only (no Write/Edit/Bash)
- **developer, worker:** All tools
- **planner, requirements-gatherer, solutions-architect:** Read, Write, Edit, Grep, Glob only (no Bash)
- **qa, devops, researcher:** All tools (but researcher scopes WebSearch/WebFetch)
- **general-purpose:** All tools

**Acceptance:** All 12 agents have `tools:` field matching their declared restrictions.

---

### Task 2: Sandbox `pr-review` Skill

**Status:** completed  
**Done:** 2026-08-27 18:15 — pr-review requires confirmation gate before state change; injection vectors fixed  
**Background:** yes  
**Model:** developer (Sonnet)  
**Effort:** medium  

**Goal:** Require explicit user confirmation before submitting PR approval/changes-requested.

**Context files:**
- `plugins/assist-plugin/skills/pr-review/SKILL.md`
- `plugins/assist-plugin/skills/pr-review/references/review-workflow.md`

**Task prompt:**
Modify `pr-review` SKILL.md to add a confirmation gate:
1. Reviewer agent fetches PR and drafts verdict (unchanged)
2. Model outputs draft verdict to user for review
3. User explicitly confirms: "yes, approve this PR" or rejects
4. Only after confirmation does the skill execute `gh pr review <n> --approve`

Also update review-workflow.md to remove direct shell interpolation of model text into `--body` and `--message` flags. If the skill must compose comments, escape/validate model output or use separate files.

**Acceptance:** pr-review requires explicit user confirmation before submitting; model-composed text is not directly interpolated into shell commands.

---

### Task 3: Restrict Git Wildcards in settings.local.json

**Status:** completed  
**Done:** 2026-08-27 18:14 — Git push/add wildcards restricted to origin and current dir  
**Background:** yes  
**Model:** developer (Sonnet)  
**Effort:** low  

**Goal:** Change git permission wildcards to specific remotes/branches.

**Context files:**
- `plugins/assist-plugin/.claude/settings.local.json`

**Changes:**
- Change `Bash(git push *)` → `Bash(git push origin *)`
- Change `Bash(git add *)` → `Bash(git add -A)` or `Bash(git add -- .)`  (scoped, not wildcard)
- Keep `Bash(git *)` for other git operations

**Rationale:** Prevents pushing to arbitrary remotes; scopes `git add` to current dir only.

**Acceptance:** Git permissions narrowed to safe patterns; no `git push <arbitrary-remote>` possible without prompt.

---

### Task 4: Integrate LLM Checklist into Governance Rules

**Status:** completed  
**Done:** 2026-08-27 18:20 — LLM security gate integrated into assist-plugin-rule.md  
**Background:** no  
**Model:** developer (Sonnet)  
**Effort:** low  

**Goal:** Add LLM security review gate to `assist-plugin-rule.md`.

**Context files:**
- `plugins/assist-plugin/rules/llm-security-checklist.md` (created by Task 1 agent)
- `plugins/assist-plugin/rules/assist-plugin-rule.md` (existing governance)

**Changes:**
1. Add new section "LLM Security Review Gate" after existing OWASP checklist
2. Reference the llm-security-checklist.md file
3. Require `✓ LLM Security Clear` signature (created by agent) before merge
4. Trigger when: changes to `agents/`, `skills/`, `rules/`, `CLAUDE.md`, `.claude/settings*.json`
5. Enforcer: `reviewer` or `code-reviewer` agent

**Acceptance:** assist-plugin-rule.md updated; LLM security gate integrated and ready to block merges.

---

## Execution Plan

Sequential (Tasks 1-3 independent; Task 4 depends on Tasks 1-3 completion):
1. Task 1: Add `tools:` to agents (background)
2. Task 2: Sandbox pr-review (background)
3. Task 3: Restrict git wildcards (background)
4. Collect results and review
5. Task 4: Integrate governance (foreground)
6. Commit all changes

**Estimated total time:** 45-60 minutes

---

## Acceptance Criteria

- [ ] All 12 agents have `tools:` frontmatter matching agent-registry
- [ ] pr-review requires user confirmation before executing approve/changes-requested
- [ ] Git permissions: `push origin *` (not `*`), `add` scoped (not wildcard)
- [ ] LLM security gate integrated into assist-plugin-rule.md
- [ ] All changes committed with security-focused message
- [ ] `claude plugin validate --strict` passes

---
