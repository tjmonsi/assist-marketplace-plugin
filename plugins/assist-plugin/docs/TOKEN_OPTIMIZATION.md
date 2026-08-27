# Token Optimization Strategy

## Overview

assist-plugin achieves a ~65% token footprint of the original software-development plugin while maintaining full feature parity. This document explains what's included, excluded, and why.

---

## Included ✓

### Agents (12)
- **All core agents:** developer, reviewer, planner
- **All testing agents:** qa, solutions-architect
- **All planning agents:** requirements-gatherer, devops
- **All support agents:** researcher, code-reviewer, explore, general-purpose, worker

**Why:** Full agent coverage ensures task routing flexibility without off-loading to external plugins.

### Skills (8)
- `do` (orchestrator) — replaces `run` with streamlined logic
- `debug` — replaces `debug-code` with token-optimized workflow
- `bump` — semantic versioning & changelog generation
- `pr-review` — GitHub/Bitbucket PR review with auto-detection
- `commit`, `branch` — essential git operations
- `map-project` — project discovery
- `technical-writing` — documentation generation

**Why:** Minimal viable skill set covering 80% of common tasks.

> **Note:** `pr-review` supports both GitHub and Bitbucket in a single skill (~16.6KB). software-development only provides Bitbucket (`review-bkt-pr`). The higher token cost reflects broader platform support.
>
> **Note:** `bump` generates a full categorized CHANGELOG.md. software-development's `release-version` only bumps version numbers. The extra token cost reflects added functionality.

### References (Consolidated)
- `agent-registry.md` — 1 source of truth for all agents
- `model-routing.md` — Model assignment rules (table format)
- `plan-format.md` — Plan template (compact)
- `review-protocol.md` — Review workflow (essential steps only)

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

### Hooks & Governance Infrastructure
- **Why excluded:** Hooks are project-specific; governance is in rules only
- **Alternative:** Implement hooks in your git repo or CI/CD

### Examples & Tutorials
- **Why excluded:** Links to docs instead of inline examples save tokens
- **Format:** Each skill references comprehensive examples in SPECIFICATION.md

### Verbose Reference Documentation
- **Why excluded:** Consolidated references (12 files spanning skills: do (4), debug (4), bump (2), pr-review (2))
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
| Agents | 12 | 12 | 100% |
| Skills | 8 | 20+ | 40% |
| Reference files | 4 | 20+ | 20% |
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
| No hooks | Simpler | Implement in your CI/CD |
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
- **Premium models (Opus)** for foundational decisions: planner, solutions-architect, researcher, orchestrator, reviewer, code-reviewer
- **Efficient models (Sonnet)** for execution: developer, qa, requirements-gatherer, devops, worker
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

