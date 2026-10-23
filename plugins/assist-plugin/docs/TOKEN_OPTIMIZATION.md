# Token Optimization Strategy

## Overview

assist-plugin achieves a ~65% token footprint of the original software-development plugin while maintaining full feature parity. This document explains what's included, excluded, and why.

---

## Included ✓

### Agents (16)
- **All core agents:** developer, developer-tester, reviewer, planner
- **All testing agents:** qa, solutions-architect
- **All planning agents:** requirements-gatherer, task-planner, devops
- **All support agents:** ask, researcher, code-reviewer, intake-reviewer, explore, general-purpose, worker

**Why:** Full agent coverage ensures task routing flexibility without off-loading to external plugins.

### Skills (22)
- `do` (orchestrator): replaces `run` with leaner logic
- `debug`: replaces `debug-code` with token-optimized workflow
- `bump`: semantic versioning & changelog generation
- `pr-review`: GitHub/Bitbucket PR review with auto-detection
- `commit`, `branch`: essential git operations
- `map-project`: project discovery
- `technical-writing`: documentation generation
- `ask`, `gather-requirements`, `spec-from-requirements`, `task-plan`, `review-md`, `create-test`: user-invocable Q&A, requirements, spec, planning, review, and test skills
- `health`, `deslop`: hook health report and AI-writing-tell removal
- `clarify`, `voice-script`: explain unclear points from the current discussion, and write paste-ready text-to-speech scripts
- `code`, `pentest`, `integrated-test`, `run-test`: internal skills loaded by developer and qa

**Why:** Minimal viable skill set covering 80% of common tasks.

> **Note:** `pr-review` supports both GitHub and Bitbucket in a single skill (~10KB). software-development only provides Bitbucket (`review-bkt-pr`). The higher token cost reflects broader platform support.
>
> **Note:** `bump` generates a full categorized CHANGELOG.md. software-development's `release-version` only bumps version numbers. The extra token cost reflects added functionality.

### References (Consolidated)
- `agent-registry.md`: 1 source of truth for all agents
- `model-routing.md`: Model assignment rules (table format)
- `plan-format.md`: Plan template (compact)
- `review-protocol.md`: Review workflow (essential steps only)
- `developer-self-review.md`, `fix-phase-rules.md`, `fsa-template.md`, `planning-review-agents.md`, `reviewer-adversarial-reflection.md`, `routing-with-discovery.md`: `do` state-machine, review, and routing rules

**Why:** Centralized references eliminate duplication and reduce lookup time.

### Governance Rules
- Security (OWASP top 10)
- Testing (coverage gates)
- Review (sign-off requirements)

**Why:** Core governance without specialized compliance rules.

---

## Excluded ✗

### Complex DevOps/Integration Skills
- **Why excluded:** DevOps workflows are project-specific; this plugin stays generic
- **Skills:** bkt-pr, bkt-jira, cert-prep, context7, branch-to-jira
- **Alternative:** Reference software-development plugin for these or use self-hosted deployments

### Meta-Skills (Skill/Agent Creation)
- **Why excluded:** create-agent, create-skill expand plugin scope unnecessarily
- **Alternative:** Edit SKILL.md directly for custom skills

### Project-Specific Hooks & CI Infrastructure
- **Why excluded:** Git hooks, CI pipelines, and project-specific automation belong to each project; governance is in rules
- **Included instead:** Small fail-open hooks in `hooks/`: 11 scripts registered as 16 commands in `hooks/hooks.json`. `sa-mermaid-only.js` restricts the solutions-architect agent's Bash to mermaid-cli (`mmdc`), reading a `.mmd` file and writing a `.svg`, `.png`, or `.pdf` file under `specs/` or `<dir>/specs/`. `doc-cli-guard.js` denies output/endpoint flags, endpoint overrides, shell metacharacters, and config subcommands for `firecrawl` and `ctx7`. `pr-post-ask.js` asks, and never denies, before a `gh` or `bkt` command that posts to, merges, or closes a pull request. `injection-filter.js` rewrites prompt-injection sentences in untrusted tool results. `prose-gate.js` denies a prose write only when it adds a block-tier writing tell, and `prose-advisor.js` adds an advisory note after the write. `commit-attribution-guard.js` denies a `git commit`, `git merge`, `gh pr create`, or `gh pr edit` command whose message or body carries AI attribution. `fsa-write-bar.js` keeps `developer-tester` to test paths and `developer` out of them, limits `task-planner` to `docs/task-plans/task-plan-*.md` under the session's git root, bars `developer-tester`, `task-planner`, `requirements-gatherer`, and `solutions-architect` from dot paths, `CLAUDE.md`, `CLAUDE.local.md`, and `AGENTS.md`, and denies every subagent `.agent/main-plan/**` and `DECISIONS.md`. `fsa-log.js` checks each subagent's terminal block against its `## States` table and logs it (warn mode, never blocks). `health-check.js` self-tests the guards and filters at session start. `writing-context.js` injects the compact writing standard (`rules/writing-standard-compact.md`, 1,195 characters, about 300 tokens) at session start and after /clear or compaction, and once per subagent. The prose hooks add about 80 to 110 ms per write and no model tokens unless a tell is found. All are guardrails (fail-open if `node` is missing), not security boundaries
- **Output style:** `assist-plugin:terse` is opt-in and is not applied to subagents
- **Alternative:** Implement other hooks in your git repo or CI/CD

### Examples & Tutorials
- **Why excluded:** Links to docs instead of inline examples save tokens
- **Format:** Each skill references comprehensive examples in SPECIFICATION.md

### Verbose Reference Documentation
- **Why excluded:** Consolidated references (18 files spanning skills: do (10), debug (4), bump (2), pr-review (2))
- **Original approach:** Separate reference file per agent/skill + examples
- **This approach:** Table-driven data + link-based structure

---

## Token Conservation Techniques

### 1. Link-Based Documentation
**Before (token cost: HIGH):**
```
## Agent: developer
Responsibilities:
- Implement features from specs
- Bug fixes from approved RCAs
...extensive inline explanation...
```

**After (token cost: LOW):**
```
See [SPECIFICATION.md](SPECIFICATION.md) for detailed agent descriptions.
```

### 2. Consolidated Agent Registry
**Before:** Each agent file + agent index (duplication)  
**After:** Single `agent-registry.md` sourced by all tools (1 read)

### 3. Table-Driven Data
**Before (prose):**
```
The developer agent handles code writing, fixing, and refactoring. 
It uses Sonnet model by default. Its tools are Read, Edit, Write, etc.
```

**After (table):**
```
| Agent | Purpose | Model | Tools |
|-------|---------|-------|-------|
| developer | Write, fix, refactor | Sonnet | Read, Edit, Write, ... |
```

### 4. Concise Agent Descriptions
- **Limit:** 400 chars per agent (vs. 1000+ in original)
- **Focus:** What agent does, not how to use it
- **Detail:** Deferred to SPECIFICATION.md

### 5. Reuse & Cross-Referencing
- **Skills reference agents:** No re-definition, just link
- **Agents reference model routing:** 1 source of truth for model assignment
- **Documentation references code:** Less duplication

### 6. Compact Plan Format
- **Removed:** Verbose step numbering
- **Kept:** Essential fields only (Goal, Relevant Files, Status)
- **Format:** Markdown table for status tracking

---

## Scope Comparison

| Aspect | assist-plugin | software-development | Ratio |
|--------|---------------|----------------------|-------|
| Agents | 16 | 12 | 133% |
| Skills | 22 | 20+ | ~110% |
| Reference files | 10 | 20+ | 50% |
| Documentation | 3 pages | 50+ pages | 6% |
| **Plugin size** | ~2.5k | ~4.0k | **62%** |
| **Model mix** | Opus-heavy (quality) | Mixed | Higher token cost |
| **Total execution tokens** | ~10-12k | ~12-15k | ~80% |

---

## Trade-Offs

| Decision | Benefit | Cost |
|----------|---------|------|
| No DevOps skills | Smaller, focused | Use external plugin for bkt-jira |
| No meta-skills | Reduced scope | Manual skill creation (rare need) |
| Six PreToolUse hooks only | Guardrails for `mmdc`, `firecrawl`, `ctx7`, commit attribution, prose, and FSA write scope without project-specific hooks; needs Node | Implement other hooks in your CI/CD |
| Spec-first for build requests | Requirements, spec, and task plan exist and are approved before any build step | Three document steps, their review gates, and a sign-off per build request; the user can pick Skip spec-first at plan approval |
| Link-based docs | ~30% token saving on docs | Need to read external docs |
| Compact format | Faster parsing | Less verbose explanations |
| **Opus for architecture** | Better quality decisions | Higher token cost per task |
| **Sonnet for execution** | Cost-effective implementation | May iterate more on fixes |

---

## Future Extensions

To add capabilities without bloating token count:

1. **Add skill:** Create `skills/new-skill/SKILL.md` + minimal references
2. **Add agent:** Add row to `agent-registry.md`, link from `Claude.md`
3. **Add reference:** New `.md` file in `references/` (links only, no duplication)

**Principle:** Each new addition should aim for <50 tokens per feature.

---

## Model Tier Strategy (Updated)

**Architecture-First Approach:**
- **Premium models (Opus)** for foundational decisions: solutions-architect, researcher, orchestrator, reviewer, code-reviewer
- **Efficient models (Sonnet)** for execution: developer, developer-tester, planner (Opus available as override), intake-reviewer, ask, qa, requirements-gatherer, devops, general-purpose, worker
- **Fast models (Haiku)** for pure search: explore

**Why this costs more but saves overall:**
- Better architecture prevents rework (saved tokens from fewer iterations)
- Good specs reduce implementation time (Sonnet can execute faster)
- Research quality reduces dependency issues (fewer emergency fixes)
- Security review quality prevents vulnerabilities (less forensic debugging)

**Cost comparison:**
- Naive approach: All Sonnet (cheaper initially, more iterations/fixes = more tokens total)
- This approach: Opus for decisions, Sonnet for work (higher per-task cost, lower total lifecycle cost)

## Verification

To measure token efficiency:
1. Track tokens per task and compare iteration count
2. Compare total project cost (architecture quality affects maintenance burden)
3. Override models per-task using the `do` orchestrator to optimize for cost vs. quality trade-off

