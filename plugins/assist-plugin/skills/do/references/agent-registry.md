# Agent Registry

Source of truth for all agents in assist-plugin. Used by `do` skill for routing.

## All Agents (13)

| Agent | Responsibilities | Default Model | Tools | Primary Intent Match |
|-------|------------------|----------------|-------|----------------------|
| **ask** | Answer questions using repo search + web research | Sonnet | Read, Grep, Glob, WebSearch, WebFetch | "answer my question", "research this in repo", "find documentation" |
| **developer** | Write/fix/refactor code; implement features; apply approved fixes | Sonnet | Read, Edit, Write, Grep, Glob, Bash, LSP | "implement X", "fix bug in Y", "refactor Z" |
| **reviewer** | Code review for bugs/security/quality; OWASP checks; approve/revise | Opus | Read, Grep, Glob, Bash, LSP | "review this PR", "check for security", "OWASP compliance" |
| **planner** | Architecture design; roadmap; dependency analysis; risk assessment | Sonnet | Read, Write, Edit, Grep, Glob, Bash | "design architecture", "create roadmap", "how should we structure" |
| **qa** | Test planning; manual/automated test design; acceptance validation; coverage | Sonnet | Read, Write, Edit, Grep, Glob, Bash, LSP | "create test plan", "write automated tests", "validate acceptance" |
| **solutions-architect** | API/schema design; data flows; error handling; specs | Opus | Read, Write, Edit, Grep, Glob, Bash | "design API", "what should schema be", "data flow for X" |
| **requirements-gatherer** | Requirements elicitation; BRD/URD; FR+NFR; acceptance criteria | Sonnet | Read, Write, Edit, Grep, Glob, Bash | "gather requirements", "create BRD", "define acceptance criteria" |
| **devops** | CI/CD pipelines; infrastructure (Terraform/Docker); deployment; monitoring | Sonnet | Read, Write, Edit, Grep, Glob, Bash | "set up CI/CD", "create Terraform", "deploy X" |
| **researcher** | Web research; documentation audit; best practices; competitive analysis | Opus | WebSearch, WebFetch, Read, Write | "research X library", "best practices for Y", "compare solutions" |
| **code-reviewer** | Formal line-by-line review; critical sign-off; architectural evaluation | Opus | Read, Grep, Glob, Bash, LSP | "formal review", "critical change approval", "senior review needed" |
| **explore** | Code search; find definitions; grep symbols; locate callers | Haiku | Read, Grep, Glob | "find where X defined", "who calls this", "search for pattern" |
| **general-purpose** | Catch-all for unmatched tasks; ad-hoc analysis; experimentation | Sonnet | All (except Artifact) | "what's the best approach", "help me understand X" |
| **worker** | Multi-discipline: code + test + review combined for small features | Sonnet | All (except Artifact) | "implement and test", "quick fix with tests", "add logging to X" |

---

## Agent-Specific Skills

Skills the orchestrator should name in the task prompt when it routes to these agents.

| Agent | Skill | What it provides |
|-------|-------|------------------|
| **requirements-gatherer** | `gather-requirements` (`plugins/assist-plugin/skills/gather-requirements`) | Elicitation methodology, BRD/URD/FR-NFR templates, quality checklist, `BR/UR/FR/NFR-NNN` IDs, GIVEN/WHEN/THEN acceptance criteria, JSON output |
| **solutions-architect** | `spec-from-requirements` (`plugins/assist-plugin/skills/spec-from-requirements`) | Classify-first spec templates (Architecture, API endpoint, Frontend action, Functionality, UI/UX design, General), Requirement/Scenario format, ADDED/MODIFIED/REMOVED delta mode, OpenAPI and JSON output, cloud patterns |

The two chain: `gather-requirements` emits the `BR/UR/FR/NFR-NNN` IDs that every `spec-from-requirements` spec cites in its **Requirement refs** field, and that code comments cite per [TRACING_MARKERS.md](../../../docs/TRACING_MARKERS.md). Route requirements work before spec work when both appear in one task.

---

## Routing Decision Tree

```
User task → /do
  ↓
Classify primary intent:

Is it a QUESTION, or does it need REPO/WEB RESEARCH TO ANSWER (not implement)?
  └─ Answer question / find documentation / look something up? → ask

Is it about CODE IMPLEMENTATION?
  ├─ Large feature? → developer + qa + reviewer (split)
  ├─ Small feature? → worker (end-to-end)
  ├─ Quick fix? → developer
  └─ Refactor? → developer

Is it about CODE REVIEW?
  ├─ Formal approval? → code-reviewer
  ├─ Standard review? → reviewer
  └─ Just check? → reviewer

Is it about ARCHITECTURE/DESIGN?
  ├─ System design? → planner
  ├─ API/schema design? → solutions-architect
  └─ Feature spec? → solutions-architect

Is it about REQUIREMENTS?
  └─ Gather/document? → requirements-gatherer

Is it about TESTING?
  ├─ Test plan? → qa
  ├─ Automated tests? → qa
  └─ Acceptance? → qa

Is it about INFRASTRUCTURE/DEVOPS?
  └─ CI/CD/deployment/monitoring? → devops

Is it about RESEARCH/DISCOVERY?
  ├─ Technical research? → researcher
  ├─ Find code location? → explore
  └─ Learn best practices? → researcher

Is it about MULTI-DISCIPLINE or SMALL TASKS?
  ├─ Code + test + review combined? → worker
  └─ Unmatched/ad-hoc? → general-purpose

No clear match?
  └─ general-purpose (fallback)
```

---

## Model Tier Guidance

| Tier | Model | When to Use | Agents |
|------|-------|-----------|--------|
| **Low** | Haiku | Simple operations, pure search | explore |
| **Medium** | Sonnet | Most development work, analysis | ask, developer, planner, qa, solutions-architect, requirements-gatherer, devops, researcher, general-purpose, worker |
| **High** | Opus | Complex decisions, security, formal review | orchestrator (`do`), reviewer, code-reviewer |

Planner moved from the High/Opus tier to the Medium/Sonnet tier — see [model-routing.md](model-routing.md#planner-cost-savings-sonnet-default) for rationale. Opus remains available as an override for high-stakes or highly ambiguous architecture (see Override Model Strategy below).

---

## Override Model Strategy

Before plan approval, the `do` orchestrator ASKS user:

```
Plan includes these agents:
- developer [Sonnet]
- reviewer [Opus]
- qa [Sonnet]

Override models? (y/n)
For each agent: [agent] = [model]
```

**Guidance:**
- Use Sonnet + 1 step extra iteration vs. Opus for cost savings
- Upgrade to Opus for security-critical or architectural decisions
- Use Haiku for pure search/lookup (explore agent)
