# Architecture

## Philosophy

assist-plugin follows these core principles:

1. **Orchestration over monolith** — One skill (`do`) routes to 12 specialized agents
2. **Agent specialization** — Each agent handles one domain; no overlapping responsibilities
3. **Model routing** — Task complexity determines model tier (Haiku/Sonnet/Opus)
4. **Review gates** — Security + testing + code review checkpoints before merge
5. **Token efficiency** — Centralized references, link-based docs, table-driven data

---

## System Architecture

```
┌─────────────────────────────────────────────┐
│         User Input / CLI (`/do`)            │
└────────────────┬────────────────────────────┘
                 │
        ┌────────▼────────┐
        │  Orchestrator   │
        │   (do skill)    │
        │  - Classify     │
        │  - Route        │
        │  - Plan         │
        │  - Delegate     │
        │  - Synthesize   │
        └────────┬────────┘
                 │
    ┌────────────┼────────────┬─────────────┬──────────────┐
    │            │            │             │              │
    ▼            ▼            ▼             ▼              ▼
┌────────┐  ┌──────────┐  ┌────────┐  ┌─────────┐  ┌──────────────┐
│Developer│  │Reviewer  │  │Planner │  │QA Agent │  │Requirements  │
│  Agent  │  │  Agent   │  │ Agent  │  │         │  │   Gatherer   │
└────────┘  └──────────┘  └────────┘  └─────────┘  └──────────────┘
    │            │            │             │              │
    └────────────┼────────────┴─────────────┴──────────────┘
                 │
        ┌────────▼────────────────────┐
        │   Review Gate               │
        │  - Security (OWASP)         │
        │  - Testing (>70% coverage)  │
        │  - Code Review (sign-off)   │
        └────────┬────────────────────┘
                 │
        ┌────────▼────────────────────┐
        │   Merge / Synthesize        │
        │   Results                   │
        └─────────────────────────────┘
```

---

## Agent Taxonomy

### By Responsibility

#### Development Tier
- **developer** — Implement, fix, refactor code
- **reviewer** — Quality, security, performance checks
- **code-reviewer** — Formal line-by-line review (specialized)

#### Architecture Tier
- **planner** — System design, roadmap, risk assessment
- **solutions-architect** — Feature specs, API design, data flow

#### Quality Tier
- **qa** — Test planning, acceptance validation
- **requirements-gatherer** — Requirements, BRD/URD, FR+NFR

#### Infrastructure Tier
- **devops** — CI/CD, infrastructure, deployment

#### Support Tier
- **researcher** — Web research, documentation, best practices
- **explore** — Fast code search and location discovery
- **general-purpose** — Catch-all for unmatched tasks
- **worker** — Multi-discipline (code + review + test combined)

### By Model Tier

| Tier | Model | Agents | Use Cases |
|------|-------|--------|-----------|
| **Haiku** (low) | Haiku 4.5 | explore | Code search, fast lookup |
| **Sonnet** (medium) | Sonnet 5 | developer, qa, requirements-gatherer, devops, general-purpose, worker | Implementation, testing, DevOps |
| **Opus** (high) | Opus 5 | orchestrator (`do`), reviewer, code-reviewer, planner, solutions-architect, researcher | Architecture, design, research, security, decisions |

---

## Skill Tree

```
/do (Orchestrator)
 ├─► Route to developer
 │   └─► Use /debug [analyze|fix|review] for bugs
 ├─► Route to reviewer
 │   └─► Use review-protocol (built-in)
 ├─► Route to planner
 │   └─► Use /map-project for discovery
 ├─► Route to solutions-architect
 │   └─► Use /technical-writing [docs] for specs
 ├─► Route to qa
 │   └─► Use /technical-writing [docs] for test plans
 ├─► Route to requirements-gatherer
 │   └─► Use /technical-writing [docs] for BRD
 ├─► Route to devops
 │   └─► Use /commit for deployment tracking
 ├─► Route to researcher
 │   └─► Use /map-project for stack discovery
 ├─► Route to others
 │   └─► Agent-specific workflows
 └─► Report Quality Gate (all report-producing steps)
     └─► /review-md checks the drafted report before it reaches the user
```

---

## Data Flow: Task → Agent → Delivery

### Example: "Implement user authentication"

1. **User:** `/do implement user authentication in backend`

2. **Orchestrator classifies:**
   - Primary intent: Code implementation
   - Scope: Feature (not quick fix)
   - Output: Code files + tests
   - Agent: developer
   - Model: Sonnet (default)

3. **Orchestrator creates plan:**
   ```
   ## Step 1: Design API Schema
   Agent: solutions-architect
   Model: Sonnet
   Files: docs/api.md
   
   ## Step 2: Implement Authentication
   Agent: developer
   Model: Sonnet
   Files: backend/auth.ts, tests/auth.test.ts
   
   ## Step 3: Review Code
   Agent: reviewer
   Model: Opus
   Files: (changed files from Step 2)
   ```

4. **User approves plan**

5. **Orchestrator delegates:**
   - Step 1: solutions-architect designs API
   - Step 2: developer implements code
   - Step 3: reviewer checks security (OWASP) + tests (>70%)

6. **Orchestrator synthesizes:** Presents design + code + review

7. **Review gates:**
   - Security: ✓ No SQL injection, XSS, CSRF
   - Testing: ✓ 85% coverage
   - Code review: ✓ Approved

8. **User merges:** Ready for production

---

## Reference Data Model

### agent-registry.md
- **Source of truth:** All agent metadata
- **Format:** Table (name, purpose, model, tools, responsibilities)
- **Used by:** `do` skill for routing, Claude.md for index

### model-routing.md
- **Source of truth:** Model assignment rules
- **Format:** Table (agent, default model, conditions for override)
- **Used by:** `do` skill for model selection

### plan-format.md
- **Source of truth:** Plan file structure
- **Format:** Markdown template
- **Used by:** `do` skill when creating plans

### review-protocol.md
- **Source of truth:** Review workflow
- **Format:** Procedural steps + gates
- **Used by:** `reviewer` agent and orchestrator

---

## Extension Points

### Add a New Skill
1. Create `skills/new-skill/SKILL.md`
2. Create `skills/new-skill/metadata.json`
3. Add references in `skills/new-skill/references/`
4. Update `Claude.md` skills table
5. Update plan/orchestrator if skill changes routing logic

### Add a New Agent
1. Create `agents/new-agent.md`
2. Add row to `agent-registry.md`
3. Update `model-routing.md` if applicable
4. Update `Claude.md` agents table

### Add a Governance Rule
1. Edit `rules/assist-plugin-rule.md`
2. Update review-protocol if it affects review gates
3. Update SPECIFICATION.md if user-facing

---

## Token Efficiency

### Key Design Decisions

1. **Avoid re-definition:** All agent descriptions defined once in agent-registry.md
2. **Link, don't duplicate:** Skills link to SPECIFICATION.md for detailed workflows
3. **Tables for static data:** Model routing, agent index, skill mapping (compact)
4. **Prose only for logic:** `do` skill procedure, review gates (essential flow)
5. **Consolidate references:** 4 key files vs. 20+ in original plugin

### Model Tier Optimization

**Updated distribution (Opus-prioritized for decisions):**
- **Haiku:** 1 agent (search only)
- **Sonnet:** 6 agents (implementation, testing, DevOps, requirements)
- **Opus:** 7 agents (orchestration, architecture, design, research, security, review)

**Rationale:** Premium models for architectural decisions (planner, solutions-architect, researcher) because these determine project quality and downstream costs.

### Result
- **Base plugin:** ~2.5k tokens
- **Full load (agents + skills + docs):** ~10-12k tokens
- **Model mix:** Opus-heavy for foundational decisions, Sonnet for execution
- **Comparison:** software-development plugin ~12-15k tokens
- **Cost vs. Quality:** Higher token cost for better architecture/design/research quality

