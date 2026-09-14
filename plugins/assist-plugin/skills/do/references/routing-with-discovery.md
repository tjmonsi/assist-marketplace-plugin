# Routing with Discovery

How the `do` orchestrator discovers plugins/skills at runtime and how the ask agent fits into routing.

## Why discovery

The static [agent-registry.md](agent-registry.md) covers the 13 known agents. Discovery extends routing to:
- Skills installed by other plugins that aren't in the registry yet
- New agents added after this document was last updated
- Task-specific tools a subagent should know about, even if the orchestrator doesn't invoke them directly

Discovery is additive. It never removes or overrides the static registry — it only adds candidates the orchestrator should consider.

---

## Discovery mechanism

1. **Scan plugin directories.** Look for:
   - `plugins/*/skills/*/SKILL.md` (skill frontmatter: `name`, `description`, `argument-hint`)
   - `plugins/*/agents/*.md` (agent frontmatter: `name`, `description`, `tools`)
2. **Match description to task.** Compare the primary intent from Step 1 against each skill/agent `description` field. A match means the description's stated purpose overlaps with the task's core verb + object (e.g., task "generate a changelog" matches the `bump` skill's description).
3. **Rank candidates.** Prefer:
   - Exact match in the static registry (fastest path, no scanning needed)
   - Skill with narrower, more specific scope over a general-purpose one
   - Agent already used earlier in the same plan (avoids context switching)
4. **Surface to plan.** Any discovered skill/agent not in the static registry gets a note in the plan step: `**Discovered:** [name] — [why it matches]`.

Discovery happens once per `/do` invocation, not per subagent call, to avoid redundant scanning.

---

## How subagents can invoke discovered skills

A subagent doesn't need direct access to the orchestrator's discovery scan. Instead, the orchestrator passes a suggestion in the subagent's task prompt.

**Example — developer step suggests a skill:**

```
Task: Update the README after adding the new /export endpoint.

Suggested skill: technical-writing (plugins/assist-plugin/skills/technical-writing)
Reason: This skill is scoped to docs/readme generation and matches the task
better than free-form editing.
```

**Example — devops step suggests a skill:**

```
Task: Bump the package version and update the changelog after this release.

Suggested skill: bump (plugins/assist-plugin/skills/bump)
Reason: bump handles semantic versioning + changelog generation directly;
avoid duplicating that logic manually.
```

The subagent may invoke the suggested skill directly (if it has access) or follow the same procedure manually. The suggestion is advisory, not mandatory — the subagent still owns the final approach.

---

## Routing logic: question-answering vs. everything else

Discovery runs alongside the existing registry match, but question-answering intent is checked first because it short-circuits the rest of the routing table.

```
Task → /do
  ↓
Step 1: Classify primary intent
  ↓
Is the intent a QUESTION, LOOKUP, or RESEARCH task
(answer something, find documentation, explain how X works)
AND NOT an implementation/review/planning task?
  │
  ├─ YES → route to ask agent
  │         (Read, Grep, Glob, WebSearch, WebFetch — Sonnet)
  │         Skip agent-registry table entirely.
  │
  └─ NO  → continue with Step 2 (agent-registry.md table)
            + optional discovery scan for non-registry skills
```

### Examples

| Task | Intent | Route |
|------|--------|-------|
| "How does the auth middleware validate tokens?" | Question about existing code | ask |
| "Find the docs for the deploy pipeline" | Documentation lookup | ask |
| "What's the latest recommended way to do X in library Y?" | External research | ask |
| "Implement token refresh in the auth middleware" | Implementation | developer |
| "Research library Y and then implement it" | Multi-step: research + implement | ask (research) → developer (implement), sequenced |

For mixed tasks (research feeding into implementation), split into separate plan steps: ask first, developer second, using ask's output as context for developer.

---

## Constraints

- Discovery is read-only: it inspects frontmatter, it does not execute any skill/agent as part of the scan.
- Never route to a discovered skill/agent without listing it in the plan for user approval (Step 4 in [SKILL.md](../SKILL.md)).
- If discovery finds no better match than the static registry, use the static registry — don't introduce ambiguity for its own sake.
- ask agent routing still requires plan creation and approval like any other agent; it is not a bypass of Steps 3-4.
