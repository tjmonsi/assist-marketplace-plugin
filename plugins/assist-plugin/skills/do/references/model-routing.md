# Model Routing

Decision table for assigning Claude models to agents in the `do` orchestrator.

## Model Tier Assignment

| Agent | Default Model | Can Override | Conditions |
|-------|---------------|--------------|-----------|
| **orchestrator** (`do` skill) | Opus | No | Always use Opus for orchestration |
| **developer** | Sonnet | Yes | Can downgrade to Haiku for trivial changes |
| **reviewer** | Opus | No | Always Opus (security/quality gate) |
| **planner** | Opus | Yes | Can downgrade to Sonnet if architecture is straightforward |
| **qa** | Sonnet | Yes | Can upgrade to Opus for critical test planning |
| **solutions-architect** | Opus | Yes | Can downgrade to Sonnet for simple specs |
| **requirements-gatherer** | Sonnet | No | Sonnet sufficient for most requirements |
| **devops** | Sonnet | Yes | Can upgrade to Opus for complex infrastructure |
| **researcher** | Opus | No | Opus + web search for comprehensive research |
| **code-reviewer** | Opus | No | Always use Opus for critical sign-off |
| **explore** | Haiku | No | Always Haiku (pure search, no reasoning) |
| **general-purpose** | Sonnet | Yes | Can upgrade based on task complexity |
| **worker** | Sonnet | Yes | Can upgrade for complex cross-cutting work |

---

## Cost vs. Quality Trade-Off

### Low Cost (Haiku)
- Minimal reasoning needed
- **Agent:** explore only
- **Use case:** Code search, finding locations

### Medium Cost (Sonnet) — Core Development
- Implementation, testing, requirements, DevOps
- Good reasoning + cost efficiency balance
- **Agents:** developer, qa, requirements-gatherer, devops, general-purpose, worker
- **Strategy:** Iterate + refine if first pass incomplete

### High Cost (Opus) — Decisions & Architecture
- Architecture, design, quality gates, research, approval
- Critical decisions that determine project direction
- **Agents:** orchestrator, reviewer, code-reviewer, planner, solutions-architect, researcher
- **Strategy:** Premium quality for foundational decisions

---

## Effort Level Assignment

| Agent | Effort | Reason |
|-------|--------|--------|
| orchestrator (`do`) | xhigh | Plan creation, routing, synthesis |
| developer | high | Implementation, testing, debugging |
| reviewer | xhigh | Security + code quality (critical) |
| planner | xhigh | Architecture, roadmap, risk analysis (Opus tier) |
| qa | high | Test design, coverage, validation |
| solutions-architect | xhigh | API/schema design, complex specs (Opus tier) |
| requirements-gatherer | medium | Requirements elicitation |
| devops | high | Infrastructure, deployment, monitoring |
| researcher | xhigh | Research, documentation, best practices (Opus tier) |
| code-reviewer | xhigh | Formal review, sign-off authority |
| explore | low | Pure search, no complex reasoning |
| general-purpose | medium | Ad-hoc, experimentation |
| worker | high | Multi-discipline, end-to-end delivery |

---

## Override Decision Matrix

When should you override the default model?

### ✓ YES, Can Downgrade to Sonnet
- **planner:** Straightforward architecture (no complex trade-offs)
- **solutions-architect:** Simple, well-defined specifications
- **developer:** Complex architectural decisions benefit from Opus, but Sonnet + iteration works
- **qa:** Non-critical testing strategy
- **devops:** Standard infrastructure setup
- **general-purpose:** Simple problems, Sonnet sufficient

### ✗ NO, Keep Default (Non-Negotiable)
- **orchestrator:** Always Opus (non-negotiable)
- **reviewer:** Always Opus (non-negotiable)
- **code-reviewer:** Always Opus (non-negotiable)
- **explore:** Always Haiku (non-negotiable)
- **researcher:** Now Opus by default (comprehensive research quality)
- **requirements-gatherer:** Sonnet by default (straightforward elicitation)

### Guidance
- Cost optimization: Sonnet + iterate beats one Opus pass for 80% of tasks
- Risk-critical work: Pay for Opus (security, architecture, approval)
- Time-sensitive: Use Opus for faster first-pass accuracy
- Exploratory: Start Sonnet, upgrade if needed

