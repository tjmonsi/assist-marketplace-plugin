# Governance Enhancement: OWASP Top 10 for LLM Review

**Status:** Approved  
**Created:** 2026-08-27 18:00 UTC  
**Scope:** Add LLM-specific security review standards to assist-plugin governance  
**Model:** reviewer (Opus) for design, developer (Sonnet) for implementation

## Objective

Enhance `rules/assist-plugin-rule.md` governance framework to include OWASP Top 10 for LLM security review in addition to existing OWASP Top 10 (code/application security).

**Applicability:** Assist-plugin uses LLM models (Claude Haiku/Sonnet/Opus) for agent orchestration and skill execution, so LLM-specific security review is required.

---

## Tasks

### Task 1: Design LLM Security Review Standards

**Status:** pending  
**Background:** yes  
**Model:** code-reviewer (Opus)  
**Effort:** medium  

**Goal:** Define what LLM-specific OWASP Top 10 categories apply to assist-plugin and how to review for them.

**Context files:**
- `plugins/assist-plugin/rules/assist-plugin-rule.md` (current governance)
- `plugins/assist-plugin/CLAUDE.md` (plugin overview with agent/skill definitions)
- `plugins/assist-plugin/docs/SPECIFICATION.md` (agent/skill specifications)

**Task prompt:** 
Define OWASP Top 10 for LLM security checklist for assist-plugin review. Categorize which items apply (e.g., prompt injection, insecure output handling, training data poisoning, etc.). Focus on assist-plugin's risk surface: agent orchestration, skill definitions, user prompt routing. Deliverable: markdown checklist with categories, specific risks, and verification steps for code review gates.

**Acceptance:** Clear checklist with 5-10 LLM-specific security categories applicable to plugin review.

---

### Task 2: Integrate LLM Security into Governance Rules

**Status:** pending  
**Background:** no  
**Model:** developer (Sonnet)  
**Effort:** low  

**Goal:** Add LLM security section to `rules/assist-plugin-rule.md` governance gates.

**Context files:**
- Output from Task 1 (LLM security checklist)
- `plugins/assist-plugin/rules/assist-plugin-rule.md` (current governance)

**Changes:**
1. Add new section: "LLM Security Review (OWASP Top 10)" after existing OWASP checklist
2. Reference LLM checklist items
3. Require sign-off on LLM risks before merge (alongside code review)
4. Link to verification steps from Task 1

**Acceptance:** Rules file updated, LLM review gate integrated with existing code review gate.

---

## Execution Plan

Sequential (Task 2 depends on Task 1 output):
1. Task 1: Code-reviewer designs LLM security checklist (background)
2. Collect result and review
3. Task 2: Developer integrates into governance rules (foreground)
4. Commit changes

**Estimated total time:** 20-30 minutes

---

## Acceptance Criteria

- [ ] LLM-specific OWASP Top 10 checklist created
- [ ] Checklist integrated into governance rules
- [ ] LLM security review required before merge (gate enforced)
- [ ] Commit pushed to remote

---
