# Architecture

## Philosophy

assist-plugin follows these core principles:

1. **Orchestration over monolith**: One skill (`do`) routes to 16 specialized agents
2. **Agent specialization**: Each agent handles one domain; no overlapping responsibilities
3. **Model routing**: Task complexity determines model tier (Haiku/Sonnet/Opus)
4. **Review gates**: Security + testing + code review checkpoints before merge
5. **Token efficiency**: Centralized references, link-based docs, table-driven data

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
        │  - Testing (>=70% coverage)  │
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
- **developer**: Implement, fix, refactor code
- **reviewer**: Quality, security, performance checks
- **code-reviewer**: Formal line-by-line review (specialized)

#### Architecture Tier
- **planner**: System design, roadmap, risk assessment
- **solutions-architect**: Feature specs, API design, data flow
- **task-planner**: Approved spec to an ordered task-plan file (writes only `docs/task-plans/task-plan-*.md` under the session's git root)

#### Quality Tier
- **qa**: Test planning, acceptance validation
- **developer-tester**: Black-box tests from acceptance criteria
- **requirements-gatherer**: Requirements, BRD/URD, FR+NFR
- **intake-reviewer**: Read-only intake review of a user file, and conflict check of a build request against existing documents

#### Infrastructure Tier
- **devops**: CI/CD, infrastructure, deployment

#### Support Tier
- **researcher**: Web research, documentation, best practices
- **explore**: Fast code search and location discovery
- **ask**: Repository and optional web Q&A
- **general-purpose**: Ad-hoc analysis and experimentation when /do explicitly matches it; unmatched work goes to Clarify
- **worker**: Multi-discipline (code + review + test combined)

### By Model Tier

| Tier | Model | Agents | Use Cases |
|------|-------|--------|-----------|
| **Haiku** (low) | Haiku 4.5 | explore | Code search, fast lookup |
| **Sonnet** (medium) | Sonnet 5 | developer, developer-tester, planner (Opus available as override), ask, qa, requirements-gatherer, intake-reviewer, task-planner, devops, general-purpose, worker | Implementation, testing, planning, DevOps |
| **Opus** (high) | Opus 5 | orchestrator (`do`), reviewer, code-reviewer, solutions-architect, researcher | Architecture, design, research, security, decisions |

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
 ├─► Route to task-planner
 │   └─► Runs the task-plan skill on an approved spec
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

2. **Orchestrator classifies (SpecGate):**
   - The request writes code, so it is `build`
   - It searches for requirements, specs, task plans, and `DECISIONS.md`
   - When it finds documents, a read-only intake-reviewer runs `conflict-check` on the request and the documents
   - Clarify asks about each finding and each open detail (up to 5 rounds), with /do's recommended answer on every question, except a question about instruction-like text in a document, which has no recommended option

3. **Orchestrator creates plan:**
   ```
   ## Step 1: Requirements (chain)
   Agent: requirements-gatherer
   Model: Sonnet
   Files: docs/requirements/FR-NFR-auth.md

   ## Step 2: Spec (chain)
   Agent: solutions-architect
   Model: Opus
   Files: specs/spec-auth.md

   ## Step 3: Task plan (chain)
   Agent: task-planner
   Model: Sonnet
   Files: docs/task-plans/task-plan-auth-<timestamp>.md

   ## Step 4: Implement Authentication (Build: yes)
   Agent: developer
   Model: Sonnet
   Files: backend/auth.ts

   ## Step 5: Write Tests (Build: yes)
   Agent: developer-tester
   Model: Sonnet
   Files: tests/auth.test.ts

   ## Step 6: Review Code
   Agent: reviewer
   Model: Opus
   Files: (changed files from Steps 4 and 5)
   ```

4. **User approves plan.** The approval call also offers "Skip spec-first", which drops steps 1 to 3 and the sign-off below and records the waiver in `DECISIONS.md`.

5. **Orchestrator delegates:**
   - Steps 1 to 3: the document chain runs in order, each step through its planning review gate and a change check
   - **Document sign-off:** the user approves the requirements, spec, and task plan; `/do` stores a hash of each, and Steps 4 to 6 stay held until then
   - Step 4: developer implements code
   - Step 5: developer-tester writes the tests
   - Step 6: reviewer checks security (OWASP) + tests (>=70%)

6. **Orchestrator synthesizes:** Presents documents + code + review

7. **Review gates:**
   - Security: ✓ No SQL injection, XSS, CSRF
   - Testing: ✓ 85% coverage
   - Code review: ✓ Approved

8. **User merges:** Ready for production

### Spec-first flow

A `build` request (one that writes code, config, pipelines, infrastructure, or tests) cannot reach a build step before its documents exist and the user approves them. Docs-only edits, reviews, questions, and commits are exempt.

| Stage | Who | What |
|-------|-----|------|
| SpecGate | `/do` | Classify `build` or `non-build`; list existing documents (at most 20 paths per type) |
| Conflict check | intake-reviewer (`conflict-check`, read-only) | Compare the request with the documents and `DECISIONS.md`: missing documents, request versus documents, contradictions, gaps |
| Clarify | `/do`, up to 5 rounds for `build` | Ask each finding and open detail with a recommended answer (none for instruction-like text in a document); an open point after round 5 ends the run |
| Document chain | requirements-gatherer, solutions-architect, task-planner | Requirements, then spec, then task plan, each through the planning review gate |
| DocSignOff | the user | Approve documents, Edit documents (up to 3 times), or Cancel |
| Build | developer, developer-tester, devops, and others | Steps marked `Build: yes` start only after approval or the waiver |

Guards around the chain:

- **Change check:** in a git repo, `/do` snapshots `git status` and content hashes of the files that steer agents (`.claude/settings*.json`, `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `DECISIONS.md`) around each chain step and flags any change it cannot attribute. It validates each chain artifact against the step's writes.
- **Approved-document hashes:** `/do` recomputes the hash of each approved document before every build send and holds the build steps if one changed.
- **Untrusted-data wrappers:** chain, build, gate, and fix prompts name every document path inside a data wrapper, so the agent is told to treat document text as content, not commands.
- **Write guards:** `fsa-write-bar` limits `task-planner` to `docs/task-plans/task-plan-*.md` under the session's git root, bars `requirements-gatherer`, `solutions-architect`, `task-planner`, and `developer-tester` from dot paths, `CLAUDE.md`, `CLAUDE.local.md`, and `AGENTS.md`, and denies every subagent `.agent/main-plan/**` and `DECISIONS.md` (Write, Edit, MultiEdit, and NotebookEdit calls only; Bash writes are not covered; the hook fails open). `sa-mermaid-only` lets `mmdc` read a `.mmd` file and write a `.svg`, `.png`, or `.pdf` file under `specs/` or `<dir>/specs/`, named by a relative path or an absolute path under the git root.
- **PR posting ask:** `pr-post-ask` (PreToolUse on `Bash` and `PowerShell`, every session and every agent) asks, and never denies, before `gh pr review`, `merge`, `comment`, and `close`, `bkt pr approve`, `comment`, `decline`, `close`, and `merge`, and a `bkt api` call that may write. It is a best-effort guardrail that fails open, lists its known gaps, and a deny from another hook wins over its ask. The health check self-tests it as a guard. Unverified: whether the prompt appears in `bypassPermissions` mode or plan mode, and whether an installed mod can approve a call the hook would prompt for.
- **Qualified dispatch:** `/do` dispatches each registry agent as `assist-plugin:<name>`.

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
- **Sonnet:** 11 agents (developer, developer-tester, planner, ask, qa, requirements-gatherer, intake-reviewer, task-planner, devops, general-purpose, worker)
- **Opus:** 4 agents (reviewer, code-reviewer, solutions-architect, researcher), plus the orchestrator (`do`) counted separately

**Rationale:** Premium models for architectural decisions (solutions-architect, researcher) because these determine project quality and downstream costs. The planner runs on Sonnet by default; Opus is available as an override for complex planning.

### Result
- **Base plugin:** ~2.5k tokens
- **Full load (agents + skills + docs):** ~10-12k tokens
- **Model mix:** Opus-heavy for foundational decisions, Sonnet for execution
- **Comparison:** software-development plugin ~12-15k tokens
- **Cost vs. Quality:** Higher token cost for better architecture/design/research quality

