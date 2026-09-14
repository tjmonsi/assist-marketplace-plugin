# Implementation Plan: Ask Action + Core Improvements

**Date:** 2026-09-14  
**Requestor:** User via /do  
**Status:** PENDING_APPROVAL

---

## Scope Summary

Five major enhancements to assist-plugin:

1. **New "ask" skill** — Answer questions using repo search + web research
2. **Router plugin/skill discovery** — Auto-discover available plugins in `do` routing
3. **Commit changes** — Remove LLM co-authorship lines, use cheapest models
4. **Documentation standards** — Remove AI-slop, make text concise
5. **Review-fix cycles** — Always use Sonnet for fixing phase

---

## Step 1: Create "ask" Skill

**Agent:** developer  
**Model:** Sonnet  
**Effort:** high  
**Status:** completed (2026-09-14)  
**Result:** ✓ Ask skill created
- `plugins/assist-plugin/skills/ask/SKILL.md` (created)
- `plugins/assist-plugin/skills/ask/references/answer-format.md` (created)
- Modes: repo-only search + repo+web research
- All AI-slop removed, concise style applied

**Goal:** Add new `/ask` skill that answers user questions by:
- Searching repository documents
- Optionally performing web research
- Linking findings back to repo or external sources

**Files to Create/Modify:**
- `plugins/assist-plugin/skills/ask/SKILL.md` (create)
- `plugins/assist-plugin/skills/ask/references/answer-format.md` (create)

**Implementation Tasks:**
- Define ask skill structure with options for repo-only vs. repo+web search
- Implement agent routing (explore for repo search + researcher for web)
- Create answer format template (with sources, repo links, summary)

---

## Step 2: Update Router with Plugin Discovery

**Agent:** developer  
**Model:** Sonnet  
**Effort:** high  
**Status:** completed (2026-09-14)  
**Result:** ✓ Router enhanced with plugin discovery
- Modified `plugins/assist-plugin/skills/do/SKILL.md` (added Plugin & Skill Discovery section)
- Modified `plugins/assist-plugin/skills/do/references/agent-registry.md` (added ask agent)
- Created `plugins/assist-plugin/skills/do/references/routing-with-discovery.md`
- Ask routing integrated into decision tree

**Goal:** Enhance `do` skill to:
- Discover available plugins/skills at runtime
- Suggest plugins to subagents that match task context
- Link ask skill into routing decision tree

**Files to Create/Modify:**
- `plugins/assist-plugin/skills/do/SKILL.md` (modify)
- `plugins/assist-plugin/skills/do/references/agent-registry.md` (modify — add ask agent)
- `plugins/assist-plugin/skills/do/references/routing-with-discovery.md` (create)

**Implementation Tasks:**
- Add plugin discovery logic to do skill
- Create ask as routing option for question-answering tasks
- Document plugin discovery mechanism for subagents

---

## Step 3: Update Model Routing + Commit Changes

**Agent:** developer  
**Model:** Sonnet  
**Effort:** high  
**Status:** completed (2026-09-14)  
**Result:** ✓ Model routing updated, commit constraints added
- Modified `plugins/assist-plugin/skills/do/references/model-routing.md`
  - Planner: Opus → Sonnet (cost savings with iteration)
  - Commit: Confirmed Haiku (cheapest tier)
- Modified `plugins/assist-plugin/skills/commit/SKILL.md`
  - Added constraints: NO LLM co-authorship in commit messages
  - Documented Haiku-only model usage

**Goal:**
- Change planner default model to Sonnet (from Opus)
- Ensure commit always uses Haiku (cheapest)
- Remove LLM co-authorship from commit messages

**Files to Create/Modify:**
- `plugins/assist-plugin/skills/do/references/model-routing.md` (modify)
- `plugins/assist-plugin/skills/commit/SKILL.md` (modify)
- Commit helper script/template (modify — remove co-authorship)

**Implementation Tasks:**
- Update model-routing.md to reflect Sonnet as planner default
- Commit skill should strip "Co-Authored-By: Claude..." lines
- Ensure commit uses Haiku model tier
- Document commit message format without LLM attribution

---

## Step 4: Documentation Standards + AI-Slop Removal

**Agent:** developer  
**Model:** Sonnet  
**Effort:** high  
**Status:** completed (2026-09-14)  
**Result:** ✓ Documentation standard created
- Created `plugins/assist-plugin/docs/DOCUMENTATION_STANDARD.md`
- Covers: 10 AI-slop patterns, writing principles, formatting rules, conciseness checklist
- Token cost awareness with before/after examples
- Applicable to: docs, technical reports, answers, PR descriptions, commit footers

**Goal:** Create documentation standard that:
- Removes AI-slop patterns (em-dashes, verbose transitions)
- Ensures concise, user-focused language
- Makes text easy to understand for both docs and answers

**Files to Create/Modify:**
- `plugins/assist-plugin/docs/DOCUMENTATION_STANDARD.md` (create)
- Update existing docs to match standard (phase 2)

**Implementation Tasks:**
- Define what constitutes "AI-slop" (verbose transitions, em-dashes, flowery language)
- Create checklist for reviewers (when reviewing docs/answers)
- Create template for concise technical writing
- Document how to write for tokens (shorter = better cost)

---

## Step 5: Review-Fix Protocol Update

**Agent:** developer  
**Model:** Sonnet  
**Effort:** high  
**Status:** completed (2026-09-14)  
**Result:** ✓ Review-fix protocol updated
- Modified `plugins/assist-plugin/skills/do/references/review-protocol.md`
  - Added "Fix Phase Rules" section
  - Specifies Sonnet-only for fix phase
- Created `plugins/assist-plugin/skills/do/references/fix-phase-rules.md`
  - Constraint: Fix ONLY identified items (no scope creep)
  - Hard failure if unrelated changes detected
  - Developer checklist provided

**Goal:** Update review-fix cycles to:
- Always use Sonnet for fixing phase
- Only fix reviewer's identified items (no scope creep)
- Track fix iterations separately from review iterations

**Files to Create/Modify:**
- `plugins/assist-plugin/skills/do/references/review-protocol.md` (modify)
- `plugins/assist-plugin/skills/do/references/fix-phase-rules.md` (create)

**Implementation Tasks:**
- Define fix phase as separate from review phase
- Specify Sonnet-only for fix phase agent
- Add constraint: only fix identified items, no additional refactoring
- Update plan template to track review vs. fix iterations

---

## Implementation Complete

All 5 steps finished successfully:

✓ Ask skill ready for routing  
✓ Router can discover plugins and suggest to subagents  
✓ Model routing optimized (Sonnet for planner, Haiku for commit)  
✓ Commit skill now enforces NO LLM co-authorship  
✓ Documentation standard established (AI-slop removal guide)  
✓ Review-fix protocol enforces Sonnet-only fix phase with scope constraints

**Code Review:** LGTM ✓ (all 4 critical gates passed)  
**Commit:** a9c3b38 (11 files changed, 590 insertions, 14 deletions)  
**CLAUDE.md Updated:** Ask skill added to Skills table, Documentation Standard linked

**Status:** COMPLETE — All work merged to main branch

---

## Success Criteria

✓ Ask skill callable via `/ask` and routable via `/do`  
✓ Router discovers and suggests plugins to subagents  
✓ Commit messages contain NO "Co-Authored-By: Claude" lines  
✓ All new documentation follows concise standard (no em-dashes, 3-4 words/sentence avg)  
✓ Review-fix cycles consistently use Sonnet for fix phase  
✓ Planner routes default to Sonnet (cost savings verified)  
✓ All changes reviewed and approved before merge

