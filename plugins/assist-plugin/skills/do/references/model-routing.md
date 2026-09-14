# Model Routing

Decision table for assigning Claude models to agents in the `do` orchestrator.

## Model Tier Assignment

| Agent | Default Model | Can Override | Conditions |
|-------|---------------|--------------|-----------|
| **orchestrator** (`do` skill) | Opus | No | Always use Opus for orchestration |
| **developer** | Sonnet | Yes | Can downgrade to Haiku for trivial changes |
| **reviewer** | Opus | No | Always Opus (security/quality gate) |
| **planner** | Sonnet | Yes | Can upgrade to Opus for high-stakes or highly ambiguous architecture |
| **qa** | Sonnet | Yes | Can upgrade to Opus for critical test planning |
| **solutions-architect** | Opus | Yes | Can downgrade to Sonnet for simple specs |
| **requirements-gatherer** | Sonnet | No | Sonnet sufficient for most requirements |
| **devops** | Sonnet | Yes | Can upgrade to Opus for complex infrastructure |
| **researcher** | Opus | No | Opus + web search for comprehensive research |
| **code-reviewer** | Opus | No | Always use Opus for critical sign-off |
| **explore** | Haiku | No | Always Haiku (pure search, no reasoning) |
| **commit** | Haiku | No | Always Haiku (mechanical formatting, no reasoning) |
| **general-purpose** | Sonnet | Yes | Can upgrade based on task complexity |
| **worker** | Sonnet | Yes | Can upgrade for complex cross-cutting work |

---

## Cost vs. Quality Trade-Off

### Low Cost (Haiku)
- Minimal reasoning needed
- **Agents:** explore, commit
- **Use case:** Code search, finding locations, mechanical commit formatting

### Medium Cost (Sonnet) — Core Development
- Implementation, testing, requirements, DevOps, planning
- Good reasoning + cost efficiency balance
- **Agents:** developer, qa, requirements-gatherer, devops, general-purpose, worker, planner
- **Strategy:** Iterate + refine if first pass incomplete

### High Cost (Opus) — Decisions & Architecture
- Design, quality gates, research, approval
- Critical decisions that determine project direction
- **Agents:** orchestrator, reviewer, code-reviewer, solutions-architect, researcher
- **Strategy:** Premium quality for foundational decisions
- **Note:** planner no longer defaults here — see Planner Cost Savings below

---

## Effort Level Assignment

| Agent | Effort | Reason |
|-------|--------|--------|
| orchestrator (`do`) | xhigh | Plan creation, routing, synthesis |
| developer | high | Implementation, testing, debugging |
| reviewer | xhigh | Security + code quality (critical) |
| planner | xhigh | Architecture, roadmap, risk analysis (Sonnet tier + iteration) |
| commit | low | Message formatting, staging (no reasoning) |
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
- **solutions-architect:** Simple, well-defined specifications
- **developer:** Complex architectural decisions benefit from Opus, but Sonnet + iteration works
- **qa:** Non-critical testing strategy
- **devops:** Standard infrastructure setup
- **general-purpose:** Simple problems, Sonnet sufficient

### ↑ YES, Can Upgrade to Opus
- **planner:** High-stakes or highly ambiguous architecture where a wrong first pass is costly
- **qa:** Critical test planning
- **devops:** Complex infrastructure
- **solutions-architect:** Default is already Opus; stays there for complex specs

### ✗ NO, Keep Default (Non-Negotiable)
- **orchestrator:** Always Opus (non-negotiable)
- **reviewer:** Always Opus (non-negotiable)
- **code-reviewer:** Always Opus (non-negotiable)
- **explore:** Always Haiku (non-negotiable)
- **commit:** Always Haiku (non-negotiable — mechanical formatting only)
- **researcher:** Always Opus (comprehensive research quality)
- **requirements-gatherer:** Sonnet by default (straightforward elicitation)

### Guidance
- Cost optimization: Sonnet + iterate beats one Opus pass for 80% of tasks
- Risk-critical work: Pay for Opus (security, architecture, approval)
- Time-sensitive: Use Opus for faster first-pass accuracy
- Exploratory: Start Sonnet, upgrade if needed

---

### Planner Cost Savings (Sonnet default)

The planner now defaults to Sonnet instead of Opus.

**Why:**
- Architecture planning is iterative by nature — plans get reviewed and revised before execution starts, regardless of model.
- Sonnet + a review/fix loop reaches the same plan quality as a single Opus pass, at a fraction of the cost.
- Opus pricing is roughly 5x Sonnet's for input tokens. Planning documents are typically large (10K-30K tokens of repo context), so the per-plan savings are substantial.
- Opus remains available as an override for genuinely high-stakes or ambiguous architecture (see Override Decision Matrix).

**Example:** A 20K-token planning pass costs approximately $0.06 on Sonnet vs. $0.30 on Opus. With one review/fix iteration (Sonnet), total cost is still well under a single Opus pass.

### Cost Savings vs. Token Context

The 3-tier routing strategy (Haiku/Sonnet/Opus) optimizes **cost and latency**, not token footprint:

- **Token context is identical**: Haiku reads the same instruction context as Opus. Routing only changes which model processes it.
- **Cost difference is significant**: 
  - Haiku: ~$0.08 per 1M input tokens
  - Opus: ~$15 per 1M input tokens
  - For a 10K-token task: Haiku = $0.0008, Opus = $0.15
- **Latency also improves**: Smaller models typically return responses faster than Opus.

**Example:** Routing the `explore` agent (pure search, no reasoning) to Haiku saves ~$0.10 per typical call vs. routing to Opus, while reading identical documentation/agent context.

For per-scenario token measurements and optimization strategy, see [../../../docs/TOKEN_OPTIMIZATION.md](../../../docs/TOKEN_OPTIMIZATION.md).

