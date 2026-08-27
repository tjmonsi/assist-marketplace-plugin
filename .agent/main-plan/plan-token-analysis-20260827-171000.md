# Token Analysis Plan: assist-plugin vs software-development

**Status:** Approved  
**Created:** 2026-08-27 17:10 UTC  
**Scope:** Comparative token analysis across 5+ scenarios  
**Model:** researcher (Sonnet)  

## Objective

Quantify token savings of assist-plugin compared to software-development plugin across real-world development scenarios. Provide concrete numbers showing efficiency gains from token optimization (link-based docs, consolidated references, table-driven data).

## Single Step

### Research & Analysis: Token Comparison Across Scenarios

**Status:** pending  
**Background:** yes (independent research task)  
**Model:** researcher (Sonnet)  
**Effort:** medium  

**Task:**

Analyze and compare token usage between:
1. **assist-plugin** (token-optimized, ~65% footprint)
2. **software-development** plugin (reference baseline)

Across at least 5 realistic scenarios, measuring:
- Initial plugin load tokens (agent/skill metadata)
- Task execution tokens (typical developer workflow)
- Documentation reference tokens
- Total session tokens

**Scenarios to analyze (minimum):**
1. `/do implement user authentication` — full workflow from planning to implementation
2. `/pr-review 123 --approve` — PR review with security checklist
3. `/debug analyze` — root cause analysis with iterative fixes
4. `/bump minor` — semantic versioning with changelog generation
5. `/do design the API schema` — solutions architecture task

Optional scenarios:
6. `/map-project` — repository discovery
7. Multi-step workflow combining debug + refactor

**Deliverables:**
- Per-scenario token count comparison table (assist vs software-dev)
- Percentages/absolute savings per scenario
- Key drivers of savings (which assist-plugin optimizations matter most)
- Methodology explanation (how tokens were counted)
- Cumulative savings across all 5 scenarios

**Context files to reference:**
- `plugins/assist-plugin/docs/TOKEN_OPTIMIZATION.md` — optimization strategy
- `plugins/assist-plugin/docs/ARCHITECTURE.md` — system design
- `plugins/assist-plugin/docs/SPECIFICATION.md` — agent/skill counts
- `plugins/assist-plugin/skills/do/references/model-routing.md` — model selection impacts
- Compare against: software-development plugin structure (known to be ~35-50KB vs assist-plugin's ~15-20KB documented savings)

---

## Acceptance Criteria

- [ ] 5+ scenarios analyzed with concrete token counts
- [ ] Comparison shows assist vs software-development baseline
- [ ] Savings quantified in absolute tokens and percentages
- [ ] Methodology documented (how tokens were estimated/counted)
- [ ] Key optimization drivers identified (docs as links, consolidated refs, table-driven data, model routing)
- [ ] Report is analyst-ready (can be used in documentation, marketing, or capability claims)

---

---

## Research Complete ✅

**Status:** COMPLETED  
**Completion time:** 2026-08-27 17:30 UTC  
**Methodology:** Actual file byte measurements (real plugin installations on disk)  
**Confidence:** High on measurements, medium on token/4-char conversion (±10-15%)

### Key Findings

**Primary metric (5 core scenarios):**
- Total tokens (assist): 21,289
- Total tokens (software-dev): 33,582
- **Weighted average savings: 36.6%**

**Per-scenario range:** −426% to +82% (negative = assist costs more but adds features)

**Optimization drivers (ranked):**
1. Missing domain-knowledge skill packs (~14.6KB per invocation)
2. Orchestrator trim (1.3K token/invocation)
3. Reference consolidation (smaller than documented)
4. Model routing (cost/latency, not token count)
5. Skill count reduction (menu tax only, ~0.5K/session)

**Documentation fixes needed before publishing:**
- TOKEN_OPTIMIZATION.md says "Skills (6)" — actually 8
- No explanation of scenarios where assist costs more (pr-review, bump)
- Model routing section conflates cost/latency with token count

### Deliverable ✅

**Published:** Analyst-ready token comparison report  
**URL:** https://claude.ai/code/artifact/f99b19d2-f7be-4578-8124-ddff6525adbd  

**Contents:**
- Ground-truth measurements from actual plugin installations (byte counts)
- All 7 scenarios with token counts and savings percentages
- Drivers ranked by measured impact (1. Missing skill packs, 2. Orchestrator trim, 3. Refs consolidation, 4. Model routing, 5. Skill count)
- Defensible claims vs. overstatements for marketing/documentation
- 3 specific documentation issues to fix before GitHub publication

**Key findings:**
- 36.6% average savings (5 primary scenarios)
- Range: −426% to +82% (negative = more capability)
- 83% static footprint reduction (whole-repo)
- Best use cases: implementation (64%), design (48–70%), minimal tasks (82%)
- Worst cases: PR review (−47% to −123%, but adds GitHub support) and bump (−426%, but adds changelog feature)
