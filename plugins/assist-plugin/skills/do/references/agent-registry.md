# Agent Registry

Source of truth for all agents in assist-plugin. Used by `do` skill for routing. `/do` dispatches each agent by its qualified name, `assist-plugin:<name>`.

## All Agents (16)

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
| **intake-reviewer** | Read-only review of a user-provided spec, requirements, or instructions file with `gather-requirements review`, and the read-only `conflict-check` of a build request against existing documents; treats the file and the request as untrusted data | Sonnet | Read, Grep, Glob | Inserted by Branch (`review`) and dispatched by SpecGate (`conflict-check`) before approval; AgentSelection does not match it from user intent |
| **task-planner** | Turn an approved spec into an ordered task-plan file with the `task-plan` skill; writes only `docs/task-plans/task-plan-*.md`; a fix pass overwrites the same file only when it is already in `docs/task-plans/` | Sonnet | Read, Write, Grep, Glob | The Task plan step of the `/do` document chain; "turn this spec into coding steps" |
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
| **task-planner** | `task-plan` (`plugins/assist-plugin/skills/task-plan`) | Spec-to-task-plan converter: ordered implementation steps with decision trees, dependency graphs, critical path. The skill is preloaded; the task prompt names the spec path and the task-plan file to write. fsa-write-bar limits the agent's writes to `docs/task-plans/task-plan-*.md` under the session's git root, and a fix pass overwrites the same file only when it is already in `docs/task-plans/`. It ends with the `task-planner/1` terminal block (verdict `steps=N`) |
| **developer** | `code` (`plugins/assist-plugin/skills/code/references`) | Language/framework standards, logging patterns, error-handling conventions, and traceability markers per [TRACING_MARKERS.md](../../../docs/TRACING_MARKERS.md); loaded by developer during implementation |
| **developer-tester** | `create-test` (`plugins/assist-plugin/skills/create-test`) | Black-box test generation from acceptance criteria and spec scenarios; never uses implementation knowledge; produces unit/integration/E2E skeletons |
| **developer** | `debug` (`plugins/assist-plugin/skills/debug`) | Structured root cause analysis and iterative fix cycles; subcommands `analyze`, `fix`, `review`. The task prompt names the skill, the subcommand, and the target files; the developer's Intake ends `named-skill` -> AssembleContext |
| **developer** | `technical-writing` (`plugins/assist-plugin/skills/technical-writing`) | User docs, README, API documentation, guides, and specification writing; subcommands `docs`, `readme`, `guide`, `api`. The task prompt names the skill, the subcommand, and the target files; the developer's Intake ends `named-skill` -> AssembleContext |
| **intake-reviewer** | `gather-requirements` (`plugins/assist-plugin/skills/gather-requirements`) | The `review` subcommand on a user-provided file. Findings are shown at PlanApproval and never applied without a user edit. Its `conflict-check` mode compares a build request with the existing requirements (`docs/requirements/` and the old root patterns), specs, task plans (`docs/task-plans/` and the old root pattern), and `DECISIONS.md`, all resolved against the git root; `/do` asks the findings as questions at Clarify |
| **qa** | `pentest` (`plugins/assist-plugin/skills/pentest`) | OWASP Top 10 + LLM OWASP testing; vulnerability discovery and reporting; dependency security audit; compliance checks |
| **qa** | `integrated-test` (`plugins/assist-plugin/skills/integrated-test`) | Integration and E2E testing; Playwright patterns and container test fixtures; test environment setup and teardown |
| **qa** | `run-test` (`plugins/assist-plugin/skills/run-test`) | Test execution orchestration; coverage capture and analysis; consolidated test report generation |

The chain: `gather-requirements` → `spec-from-requirements` → `task-plan`. Requirements emits `BR/UR/FR/NFR-NNN` IDs that specs cite in **Requirement refs**, and `task-plan` uses them to trace implementation steps per [TRACING_MARKERS.md](../../../docs/TRACING_MARKERS.md). For a build intent (any step that writes code, config, pipelines, infrastructure, or tests) the chain is mandatory: `/do` routes requirements (requirements-gatherer), then the spec (solutions-architect), then the task-plan (task-planner) ahead of every build step, and the user approves the three documents before a build step runs. The user can waive the chain at PlanApproval. Docs-only edits, reviews, questions, and commits are exempt. See [SKILL.md SpecGate](../SKILL.md#specgate) and [DocSignOff](../SKILL.md#docsignoff).

---

## Routing Decision Tree

```
User task → /do
  ↓
Classify primary intent:

Is it a QUESTION, or does it need REPO/WEB RESEARCH TO ANSWER (not implement)?
  └─ Answer question / find documentation / look something up? → ask

Is it about CODE IMPLEMENTATION? (a build intent: requirements → spec → task-plan first, unless the user waives it at PlanApproval)
  ├─ Need a development task-plan before coding? → task-planner (then route implementation to developer)
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
| **Medium** | Sonnet | Most development work, analysis | ask, developer, developer-tester, planner, qa, requirements-gatherer, intake-reviewer, task-planner, devops, general-purpose, worker |
| **High** | Opus | Complex decisions, security, formal review | orchestrator (`do`), reviewer, code-reviewer, solutions-architect, researcher |

Planner moved from the High/Opus tier to the Medium/Sonnet tier; see [model-routing.md](model-routing.md#planner-cost-savings-sonnet-default) for rationale. Opus remains available as an override for high-stakes or highly ambiguous architecture (see Override Model Strategy below).

---

## Override Model Strategy

The `do` orchestrator shows the plan table (agent, model, effort, and order per step) in chat and asks the user to Approve, Edit steps, Change models, or Cancel. See [SKILL.md PlanApproval](../SKILL.md#planapproval) for the approval and edit loop.

**Guidance:**
- Use Sonnet + 1 step extra iteration vs. Opus for cost savings
- Upgrade to Opus for security-critical or architectural decisions
- Use Haiku for pure search/lookup (explore agent)
