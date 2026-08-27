# assist-plugin Marketplace Setup Plan

**Created:** 2026-08-27  
**Status:** PENDING_APPROVAL

## Overview

Transform this project into a token-optimized Claude marketplace plugin based on software-development plugin architecture. Full agent/skill coverage with optimized documentation and consolidated references.

---

## Phase 1: Foundation & Metadata

### Step 1.1: Create `.claude-plugin/plugin.json`
- **What:** Plugin metadata (name, version, author, repo)
- **Token optimization:** Minimal, essential fields only
- **Status:** pending

### Step 1.2: Create root `Claude.md`
- **What:** Plugin overview, quick-start, agent/skill index
- **Content:** 
  - 1-line description
  - Available agents/skills (link table, no inline docs)
  - How to use the `do` orchestrator
  - Where to find detailed specs
- **Token optimization:** High-level pointers only, detailed docs in `/docs`
- **Status:** pending

### Step 1.3: Create `docs/` folder structure
- **Files:**
  - `docs/SPECIFICATION.md` — Full plugin spec
  - `docs/TOKEN_OPTIMIZATION.md` — What's included/excluded and why
  - `docs/ARCHITECTURE.md` — Design decisions, agent/skill taxonomy
- **Status:** pending

---

## Phase 2: Agent Registry

### Step 2.1: Create core agents (7 agents)
- **directory:** `agents/`
- **Agents:**
  1. `developer.md` — Code writing, fixes, refactoring
  2. `reviewer.md` — Code review, security, quality checks
  3. `planner.md` — Architecture, design, planning
  4. `qa.md` — Testing, validation, acceptance
  5. `solutions-architect.md` — Feature spec, data flow, contracts
  6. `requirements-gatherer.md` — Elicitation, BRD/URD, FR+NFR
  7. `worker.md` — Generalist (multi-discipline fallback)
- **Token optimization:** Concise descriptions, responsibilities only (400 chars max per agent)
- **Status:** pending

### Step 2.2: Create DevOps/Specialized agents (5 agents)
- **directory:** `agents/`
- **Agents:**
  1. `devops.md` — CI/CD, infrastructure, deployment
  2. `researcher.md` — Web research, documentation audit
  3. `code-reviewer.md` — Code-specific review (alias: formal review)
  4. `general-purpose.md` — Catch-all for unmatched tasks
  5. `explore.md` — Fast read-only search (code location, pattern matching)
- **Token optimization:** Link to reference docs, no inline guidance
- **Status:** pending

---

## Phase 3: Skills

### Step 3.1: Create `do` skill (Replace `run`)
- **directory:** `skills/do/`
- **Files:**
  - `SKILL.md` — Orchestrator (simplified, 60-70% length of original `run` skill)
  - `metadata.json`
  - `references/` folder:
    - `agent-registry.md` — Agents + responsibilities (table)
    - `model-routing.md` — Model/effort assignment
    - `plan-format.md` — Plan file template
    - `review-protocol.md` — Review loop procedure
- **Token optimization:**
  - Remove redundant explanations (links instead of inline text)
  - Consolidate steps where possible
  - Use tables for comparison/reference data
  - Inline templates only (no separate files per template)
- **Status:** pending

### Step 3.2: Create `debug` skill (Replace `debug-code`)
- **directory:** `skills/debug/`
- **Files:**
  - `SKILL.md` — Streamlined debug workflow
  - `metadata.json`
  - `references/`:
    - `analyze.md` — RCA analysis steps
    - `fix.md` — Fix application steps
    - `review.md` — Fix verification steps
    - `rca-template.md` — RCA output template
- **Token optimization:** Remove verbose preamble, focus on subcommand routing
- **Status:** pending

### Step 3.3: Create supporting skills (4 skills)
- **directory:** `skills/`
- **Skills:**
  1. `commit/` — Git commit with conventional commits
  2. `branch/` — Branch creation/switching
  3. `map-project/` — Repository structure discovery
  4. `technical-writing/` — Docs/README generation
- **Token optimization:** Link to full software-development plugin if need arises; keep minimal versions here
- **Status:** pending

---

## Phase 4: References & Rules

### Step 4.1: Create consolidated references
- **directory:** `references/`
- **Files:**
  - `agent-registry.md` — Full agent index with responsibilities (extracted from agents/)
  - `model-routing.md` — Model assignment table (claude-opus/sonnet/haiku)
  - `plan-format.md` — Plan file structure template
  - `review-protocol.md` — Review loop workflow
- **Token optimization:** Data-heavy, minimal prose
- **Status:** pending

### Step 4.2: Create plugin rule
- **directory:** `rules/`
- **File:** `assist-plugin-rule.md` — Rules for agent behavior and constraints
- **Token optimization:** Link to agent docs; rules file focuses on governance only
- **Status:** pending

---

## Phase 5: Documentation

### Step 5.1: Create `docs/SPECIFICATION.md`
- **What:** Full plugin specification
- **Content:**
  - Feature list
  - Agent catalog + detailed responsibilities
  - Skill catalog + detailed workflows
  - Reference guide
- **Token optimization:** Detailed but concise; reuse descriptions from agent/skill files
- **Status:** pending

### Step 5.2: Create `docs/TOKEN_OPTIMIZATION.md`
- **What:** Clarify token optimization strategy
- **Content:**
  - **Included:** Orchestrator, 12 agents, 6 skills, consolidated references
  - **Excluded:**
    - Complex DevOps workflows (hooks, bkt-jira, cert-prep, context7)
    - Create-agent/create-skill skills (meta-workflows)
    - Bitbucket/Jira integration (use if needed as external plugin)
    - Verbose examples (reference only)
  - **Optimization techniques:**
    - Link-based structure (pointer docs, not inline)
    - Consolidated references (shared metadata, no duplication)
    - Terse agent descriptions (400 chars max)
    - Table-driven data (agent registry, model routing)
    - Reuse: Skills reference agent docs, agents reference model routing
  - **Trade-offs:** Smaller than software-development, but covers full dev lifecycle
- **Status:** pending

### Step 5.3: Create `docs/ARCHITECTURE.md`
- **What:** Design rationale and structure
- **Content:**
  - Plugin philosophy (orchestration + specialization)
  - Agent taxonomy (frontend, backend, cross-cutting)
  - Skill tree (what skills invoke which agents)
  - Reference data model (how agent registry, model routing, plans connect)
  - Token conservation strategies
- **Status:** pending

---

## Phase 6: Finalization

### Step 6.1: Create/update root README.md
- **What:** User-facing introduction
- **Content:** Quick start, feature highlights, getting started
- **Status:** pending

### Step 6.2: Git commit
- **What:** Initial commit with marketplace structure
- **Files included:** All above
- **Status:** pending

---

## Execution Order

1. **Sequential (blocked steps):**
   - Phase 1 → 2 → 3 → 4 (each phase depends on prior)
   
2. **Parallel (within phase):**
   - 2.1 & 2.2 (agents are independent)
   - 3.1, 3.2, 3.3 (skills are independent)
   - 4.1 & 4.2 (references and rules)
   - 5.1, 5.2, 5.3 (documentation)

---

## Success Criteria

✓ Plugin structure matches software-development pattern  
✓ `do` skill routes tasks correctly  
✓ `debug` skill provides RCA + fix workflow  
✓ 12 agents defined with clear responsibilities  
✓ All docs clarify what's included/excluded  
✓ Token count < 80% of software-development plugin  
✓ Git repo initialized with first commit  

---

## Key Decisions (User-Approved)

1. **Model routing:** Opus → orchestrator/reviewer; Sonnet → developers/planners; Haiku → simple tasks. Orchestrator ASKS user for model override before plan approval.
2. **Distribution:** Self-hosted (no marketplace registration).
3. **Governance:** Include security/OWASP checks + test coverage gates in rules.

## Updated Step 3.1: Create `do` skill (Enhanced)

- **New requirement:** Before Step 4 (approval), prompt user for model overrides per agent
- **Prompt template:**
  ```
  Plan includes:
  - X agents [Opus | Sonnet | Haiku] by default
  
  Override models? (y/n) [details format]
  ```
- **Update model-routing.md:** Include OWASP/security review gates
- **Update review-protocol.md:** Add security + coverage checks

## Updated Phase 6: Add Governance

### Step 6.3: Create rules/assist-plugin-rule.md
- **New governance rules:**
  - **Security:** Code changes trigger OWASP security review (top 10)
  - **Testing:** Test coverage gates (>70% for new code)
  - **Review:** Reviewer must sign off before merge
- **Token optimization:** Reference OWASP checklist externally (link, don't inline)

