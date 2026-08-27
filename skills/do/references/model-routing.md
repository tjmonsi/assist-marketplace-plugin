# Model Routing

Decision table for assigning Claude models to agents in the `do` orchestrator.

## Model Tier Assignment

| Agent | Default Model | Can Override | Conditions |
|-------|---------------|--------------|-----------|
| **orchestrator** (`do` skill) | Opus | No | Always use Opus for orchestration |
| **developer** | Sonnet | Yes | Use Opus if architectural decisions needed |
| **reviewer** | Opus | No | Always Opus (security/quality gate) |
| **planner** | Sonnet | Yes | Upgrade to Opus for complex architecture |
| **qa** | Sonnet | Yes | Upgrade for critical test planning |
| **solutions-architect** | Sonnet | Yes | Upgrade to Opus for complex APIs |
| **requirements-gatherer** | Sonnet | No | Sonnet sufficient for most requirements |
| **devops** | Sonnet | Yes | Upgrade to Opus for complex infrastructure |
| **researcher** | Sonnet | No | Sonnet + web search is sufficient |
| **code-reviewer** | Opus | No | Always use Opus for critical sign-off |
| **explore** | Haiku | No | Always Haiku (pure search, no reasoning) |
| **general-purpose** | Sonnet | Yes | Upgrade based on task complexity |
| **worker** | Sonnet | Yes | Upgrade for complex cross-cutting work |

---

## Cost vs. Quality Trade-Off

### Low Cost (Haiku)
- Minimal reasoning needed
- **Agent:** explore only
- **Use case:** Code search, finding locations

### Medium Cost (Sonnet) — Default
- 80% of development tasks
- Complex enough to need reasoning, but not critical
- **Agents:** developer, planner, qa, solutions-architect, requirements-gatherer, devops, researcher, general-purpose, worker
- **Strategy:** Iterate + refine if first pass incomplete

### High Cost (Opus) — Gate-Keepers
- Security, quality, and approval decisions
- Complex architectural choices
- **Agents:** orchestrator, reviewer, code-reviewer
- **Strategy:** Use once per task (gate-keepers)

---

## Effort Level Assignment

| Agent | Effort | Reason |
|-------|--------|--------|
| orchestrator (`do`) | xhigh | Plan creation, routing, synthesis |
| developer | high | Implementation, testing, debugging |
| reviewer | xhigh | Security + code quality (critical) |
| planner | high | Architecture, roadmap, risk analysis |
| qa | high | Test design, coverage, validation |
| solutions-architect | high | API/schema design, complex specs |
| requirements-gatherer | medium | Requirements elicitation |
| devops | high | Infrastructure, deployment, monitoring |
| researcher | medium | Research, documentation, best practices |
| code-reviewer | xhigh | Formal review, sign-off authority |
| explore | low | Pure search, no complex reasoning |
| general-purpose | medium | Ad-hoc, experimentation |
| worker | high | Multi-discipline, end-to-end delivery |

---

## Override Decision Matrix

When should you override the default model?

### ✓ YES, Upgrade to Opus
- **developer:** Complex architectural decisions in code
- **planner:** System redesign with multiple trade-offs
- **qa:** Performance or security testing strategy
- **solutions-architect:** Mission-critical API design
- **devops:** Distributed system infrastructure
- **general-purpose:** Complex problem-solving needed

### ✗ NO, Keep Default
- **reviewer:** Always Opus (non-negotiable)
- **code-reviewer:** Always Opus (non-negotiable)
- **explore:** Always Haiku (non-negotiable)
- **researcher:** Sonnet + web search sufficient
- **requirements-gatherer:** Sonnet captures requirements well
- **orchestrator:** Always Opus (non-negotiable)

### Guidance
- Cost optimization: Sonnet + iterate beats one Opus pass for 80% of tasks
- Risk-critical work: Pay for Opus (security, architecture, approval)
- Time-sensitive: Use Opus for faster first-pass accuracy
- Exploratory: Start Sonnet, upgrade if needed

