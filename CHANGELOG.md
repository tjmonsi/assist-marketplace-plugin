# Changelog

All notable changes to assist-plugin-marketplace are documented in this file.

## [1.2.0] - 2026-08-28

### Governance Enhancements

- **Planning Document Review Gates with Iteration Loops**
  - Add review gates for planner, solutions-architect, requirements-gatherer outputs
  - Creator self-reflection → Reviewer audit → Iteration loop (max 10 or 2 consecutive LGTMs)
  - Reference: planning-review-agents.md with typical iteration counts per agent/document type

- **Developer Code Review Iteration Loops**
  - Extend iteration-based review to OWASP and Code Review gates (same as planning docs)
  - Developer self-reflection step before reviewer audit
  - Exit conditions: 2 consecutive LGTMs OR 10 iterations (escalate to code-reviewer)
  - Reference: developer-self-review.md with pre-submission checklist

- **Reviewer Adversarial Self-Reflection**
  - Add adversarial self-reflection phase for reviewers (before formal audit)
  - Five-category checklist: Errors, Inconsistencies, Assumptions/Edge Cases, Security/Performance, Clarity
  - Applied to all review gates (OWASP, Code Review, Planning Documents)
  - Reference: reviewer-adversarial-reflection.md with examples and workflow

### Documentation & References

- Create planning-review-agents.md: Map planning agents to document types and typical iterations
- Create developer-self-review.md: Pre-submission checklist for developer code quality
- Create reviewer-adversarial-reflection.md: Guide for deliberate issue-finding before formal audit
- Update assist-plugin-rule.md: Add Planning Document Review Gate and Reviewer Adversarial Self-Reflection sections
- Update review-protocol.md: Integrate self-reflection phases into all review workflows

### Improvements

- Unified review process across all deliverables (code and documents)
- Quality improves through multiple iteration cycles (typical: 2-3, max: 10)
- Earlier issue detection via adversarial self-reflection phase
- Clear escalation path after 10 iterations

## [1.1.0] - 2026-08-27

### Security

- **Close 3 HIGH-severity LLM security gaps:**
  - Add `tools:` frontmatter to all 12 agents (restricts tool access per role)
  - Sandbox pr-review skill with mandatory confirmation gate before state changes
  - Fix shell injection vectors in pr-review (use `--body-file` instead of inline strings)
  - Restrict git command wildcards in settings.local.json (`push origin *`, `add -- .`)

### Features

- Add OWASP Top 10 for LLM security checklist (llm-security-checklist.md)
  - 9 LLM-specific security categories with verification steps
  - Explicit audit of agent definitions, skill prompts, routing logic
  - Integration into governance framework as mandatory gate (`✓ LLM Security Clear`)
- Enhance pr-review skill with explicit user confirmation workflow
  - Draft verdict → Ask user for confirmation → Execute only on "yes"
  - Prevents unapproved PR state changes from attacker-controlled PR bodies

### Improvements

- Update token optimization documentation with concrete findings
  - 36.6% average token savings across primary scenarios
  - Defensible marketing claims backed by ground-truth analysis
  - Explanation of scenarios with intentional higher costs (pr-review GitHub support, bump changelog)
- Upgrade planner, solutions-architect, researcher to Opus model tier
- Fix marketplace compliance for `/plugin` discovery (marketplace.json schema)
- Resolve marketplace validation warnings (invalid fields, missing metadata)
- Remove duplicate root-level plugin files (consolidated to plugins/assist-plugin/)
- Restructure as proper Claude marketplace with semantic versioning

### Documentation

- Create comprehensive LLM security review checklist
- Expand governance rules with LLM security gate
- Add fast-track exclusions for prompt-surface files
- Include SLA and merge policy for security gates

## [1.0.0] - 2026-08-20

### Initial Release

- Token-optimized software development plugin
- 12 specialized agents (developer, reviewer, planner, qa, solutions-architect, requirements-gatherer, devops, researcher, code-reviewer, general-purpose, explore, worker)
- 8 skills (do, debug, bump, pr-review, commit, branch, map-project, technical-writing)
- OWASP Top 10 security review gate
- >70% test coverage requirement
- Code reviewer sign-off gate for merge
- Marketplace structure with semantic versioning
- MIT License
