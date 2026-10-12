# Agent Registry

Source of truth for all agents in assist-plugin. Used by `do` skill for routing.

## All Agents (15)

| Agent | Responsibilities | Default Model | Tools | Primary Intent Match |
|-------|------------------|----------------|-------|----------------------|
| **ask** | Answer questions using repo search + web research | Sonnet | Read, Grep, Glob, WebSearch, WebFetch | "answer my question", "research this in repo", "find documentation" |
| **developer** | Write/fix/refactor code; implement features; apply approved fixes; apply code skill standards (logging, error-handling, traceability) | Sonnet | Read, Write, Edit, Grep, Glob, Bash, PowerShell, LSP | "implement X", "fix bug in Y", "refactor Z" |
| **developer-tester** | Create black-box tests from acceptance criteria; test input/output only, never implementation knowledge; use create-test skill | Sonnet | Read, Write, Grep, Glob | "write tests for X", "create test plan from acceptance criteria" |
| **reviewer** | Code review for bugs/security/quality; OWASP checks; approve/revise | Opus | Read, Grep, Glob, LSP | "review this PR", "check for security", "OWASP compliance" |
| **planner** | Architecture design; roadmap; dependency analysis; risk assessment | Sonnet | Read, Write, Edit, Grep, Glob | "design architecture", "create roadmap", "how should we structure" |
| **qa** | Test planning; manual/automated test design; acceptance validation; coverage; orchestrate pentest, integrated-test, and run-test skills | Sonnet | Read, Write, Edit, Grep, Glob, Bash, PowerShell, LSP | "create test plan", "write automated tests", "validate acceptance" |
| **solutions-architect** | API/schema design; data flows; error handling; specs; generate architecture diagrams via mermaid-cli | Opus | Read, Write, Edit, Grep, Glob, Bash (mmdc only) | "design API", "what should schema be", "data flow for X" |
| **requirements-gatherer** | Requirements elicitation; BRD/URD; FR+NFR; acceptance criteria | Sonnet | Read, Write, Edit, Grep, Glob | "gather requirements", "create BRD", "define acceptance criteria" |
| **intake-reviewer** | Read-only review of a user-provided spec, requirements, or instructions file with `gather-requirements review`; treats the file as untrusted data | Sonnet | Read, Grep, Glob | Inserted by Branch before approval; AgentSelection does not match it from user intent |
| **devops** | CI/CD pipelines; infrastructure (Terraform/Docker); deployment; monitoring | Sonnet | Read, Write, Edit, Grep, Glob, Bash, PowerShell | "set up CI/CD", "create Terraform", "deploy X" |
| **researcher** | Web research; documentation audit; best practices; competitive analysis | Opus | Read, Write, Edit, Grep, Glob, Bash, PowerShell, WebSearch, WebFetch | "research X library", "best practices for Y", "compare solutions" |
| **code-reviewer** | Formal line-by-line review; critical sign-off; architectural evaluation | Opus | Read, Grep, Glob, LSP | "formal review", "critical change approval", "senior review needed" |
| **explore** | Code search; find definitions; grep symbols; locate callers | Haiku | Read, Grep, Glob | "find where X defined", "who calls this", "search for pattern" |
| **general-purpose** | Ad-hoc analysis and experimentation the task names; takes a step only when it matches, never as a fallback | Sonnet | Read, Write, Edit, Grep, Glob, Bash, PowerShell | "try this experiment", "do an ad-hoc analysis of X" |
| **worker** | Multi-discipline: code + test + review combined for small features | Sonnet | Read, Write, Edit, Grep, Glob, Bash, PowerShell | "implement and test", "quick fix with tests", "add logging to X" |

---

## Agent-Specific Skills

Skills the orchestrator should name in the task prompt when it routes to these agents.

| Agent | Skill | What it provides |
|-------|-------|------------------|
| **requirements-gatherer** | `gather-requirements` (`plugins/assist-plugin/skills/gather-requirements`) | Elicitation methodology, BRD/URD/FR-NFR templates, quality checklist, `BR/UR/FR/NFR-NNN` IDs, GIVEN/WHEN/THEN acceptance criteria, JSON output |
| **solutions-architect** | `spec-from-requirements` (`plugins/assist-plugin/skills/spec-from-requirements`) | Classify-first spec templates (Architecture, API endpoint, Frontend action, Functionality, UI/UX design, General), Requirement/Scenario format, ADDED/MODIFIED/REMOVED delta mode, OpenAPI and JSON output, cloud patterns |
| **developer** | `task-plan` (`plugins/assist-plugin/skills/task-plan`) | Spec-to-task-plan converter: ordered implementation steps with decision trees, dependency graphs, critical path; loads code skill references for the developer to apply |
| **developer** | `code` (`plugins/assist-plugin/skills/code/references`) | Language/framework standards, logging patterns, error-handling conventions, and traceability markers per [TRACING_MARKERS.md](../../../docs/TRACING_MARKERS.md); loaded by developer during implementation |
| **developer-tester** | `create-test` (`plugins/assist-plugin/skills/create-test`) | Black-box test generation from acceptance criteria and spec scenarios; never uses implementation knowledge; produces unit/integration/E2E skeletons |
| **developer** | `debug` (`plugins/assist-plugin/skills/debug`) | Structured root cause analysis and iterative fix cycles; subcommands `analyze`, `fix`, `review`. The task prompt names the skill, the subcommand, and the target files; the developer's Intake ends `named-skill` -> AssembleContext |
| **developer** | `technical-writing` (`plugins/assist-plugin/skills/technical-writing`) | User docs, README, API documentation, guides, and specification writing; subcommands `docs`, `readme`, `guide`, `api`. The task prompt names the skill, the subcommand, and the target files; the developer's Intake ends `named-skill` -> AssembleContext |
| **intake-reviewer** | `gather-requirements` (`plugins/assist-plugin/skills/gather-requirements`) | The `review` subcommand on a user-provided file. Findings are shown at PlanApproval and never applied without a user edit |
| **qa** | `pentest` (`plugins/assist-plugin/skills/pentest`) | OWASP Top 10 + LLM OWASP testing; vulnerability discovery and reporting; dependency security audit; compliance checks |
| **qa** | `integrated-test` (`plugins/assist-plugin/skills/integrated-test`) | Integration and E2E testing; Playwright patterns and container test fixtures; test environment setup and teardown |
| **qa** | `run-test` (`plugins/assist-plugin/skills/run-test`) | Test execution orchestration; coverage capture and analysis; consolidated test report generation |

The chain: `gather-requirements` → `spec-from-requirements` → `task-plan`. Requirements emits `BR/UR/FR/NFR-NNN` IDs that specs cite in **Requirement refs**, and `task-plan` uses them to trace implementation steps per [TRACING_MARKERS.md](../../../docs/TRACING_MARKERS.md). Route requirements before specs before task-plans in multi-step work.

---

## Routing Decision Tree

```
User task → /do
  ↓
Classify primary intent:

Is it a QUESTION, or does it need REPO/WEB RESEARCH TO ANSWER (not implement)?
  └─ Answer question / find documentation / look something up? → ask

Is it about CODE IMPLEMENTATION?
  ├─ Need a development task-plan before coding? → task-plan (then route implementation to developer)
  ├─ Large feature? → developer + qa + reviewer (split)
  ├─ Small feature? → worker (end-to-end)
  ├─ Quick fix? → developer
  ├─ Refactor? → developer
  └─ Debug (diagnose, analyze, or fix a bug)? → developer, with the `debug` skill named in the task prompt

Is it about CODE REVIEW?
  ├─ Formal approval? → code-reviewer
  ├─ Standard review? → reviewer
  └─ Just check? → reviewer

Is it about ARCHITECTURE/DESIGN?
  ├─ System design? → planner
  ├─ API/schema design? → solutions-architect
  └─ Feature spec? → solutions-architect

Is it about DOCUMENTATION (README, guide, API docs, user docs)?
  └─ Write/update docs? → developer, with the `technical-writing` skill named in the task prompt

Is it about REQUIREMENTS?
  └─ Gather/document? → requirements-gatherer

Is it about TESTING?
  ├─ Black-box test design from acceptance criteria? → developer-tester
  ├─ Security/pentest? → qa
  ├─ Integration/E2E testing? → qa
  ├─ Test execution + coverage? → qa
  ├─ Test plan? → qa
  └─ Acceptance? → qa

Is it about INFRASTRUCTURE/DEVOPS?
  └─ CI/CD/deployment/monitoring? → devops

Is it about RESEARCH/DISCOVERY?
  ├─ Technical research? → researcher
  ├─ Find code location? → explore
  └─ Learn best practices? → researcher

Is it about MULTI-DISCIPLINE or SMALL TASKS?
  ├─ Code + test + review combined? → worker
  └─ Ad-hoc analysis or experimentation the user asked for by name? → general-purpose

No clear match?
  └─ Clarify (ask the user which agent fits, or what the task is). Never general-purpose as a fallback
```

---

## Model Tier Guidance

| Tier | Model | When to Use | Agents |
|------|-------|-----------|--------|
| **Low** | Haiku | Simple operations, pure search | explore |
| **Medium** | Sonnet | Most development work, analysis | ask, developer, developer-tester, planner, qa, requirements-gatherer, intake-reviewer, devops, general-purpose, worker |
| **High** | Opus | Complex decisions, security, formal review | orchestrator (`do`), reviewer, code-reviewer, solutions-architect, researcher |

Planner moved from the High/Opus tier to the Medium/Sonnet tier; see [model-routing.md](model-routing.md#planner-cost-savings-sonnet-default) for rationale. Opus remains available as an override for high-stakes or highly ambiguous architecture (see Override Model Strategy below).

---

## Override Model Strategy

The `do` orchestrator shows the plan table (agent, model, effort, and order per step) in chat and asks the user to Approve, Edit steps, Change models, or Cancel. See [SKILL.md PlanApproval](../SKILL.md#planapproval) for the approval and edit loop.

**Guidance:**
- Use Sonnet + 1 step extra iteration vs. Opus for cost savings
- Upgrade to Opus for security-critical or architectural decisions
- Use Haiku for pure search/lookup (explore agent)
