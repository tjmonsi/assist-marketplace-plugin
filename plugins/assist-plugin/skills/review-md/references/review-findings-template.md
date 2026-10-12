# Review Findings Template

Output format for `/review-md`. Every finding uses the three-part structure: what's wrong, why it matters, what to change. List findings in the order checked (factual soundness, then consistency, then conciseness). Omit any category with no issues.

## Template

```markdown
# Review: <path/to/report.md>

## Factual Soundness

### <short label for finding 1>

<What's wrong: the specific claim and its location.>
<Why it matters: what breaks if the claim is wrong or unverifiable.>
<What to change: the concrete fix.>

## Consistency

### <short label>

...

## Conciseness

### <tell id>: <short label>

...
```

Label each conciseness finding with its family from [rules/writing-standard.md](../../../rules/writing-standard.md) (such as `hedge`) or its id from [structural-tells.md](../../deslop/references/structural-tells.md) (such as `echo-summary`).

If no issues exist in any category, write only: `No issues found in <path>.`

## Worked Examples

### hedge: unneeded hedge on a proven claim

**What's wrong:** Line 42 reads "It should be noted that the cache layer arguably causes the slowdown." The hedge adds no information beyond the claim itself.
**Why it matters:** Hedged claims read as unverified, undermining a finding that the evidence (line 38's profiler output) actually supports outright.
**What to change:** Cut to "The cache layer causes the slowdown."

### em-dash: clause joined with an em dash

**What's wrong:** Line 17 reads "The retry logic is broken — it never increments the backoff counter."
**Why it matters:** The em dash is a block-tier tell in `rules/writing-standard.md`; the prose gate may deny the write.
**What to change:** Use a colon: "The retry logic is broken: it never increments the backoff counter."

### Repeated Conclusion

**What's wrong:** The report states in the Summary ("Auth tokens never expire") and again in Root Cause ("The expiry check is missing, so tokens never expire") and again in Impact ("Because tokens don't expire, sessions stay valid forever").
**Why it matters:** Repeating one conclusion three times triples the token cost of the report without adding evidence, and makes it unclear which section holds the actual analysis.
**What to change:** State the conclusion once, in Root Cause. Summary should name the topic without restating the conclusion; Impact should add new information (e.g., how many active sessions are affected) instead of rephrasing the same sentence.

### binary-contrast: "This is X, not Y" framing

**What's wrong:** Line 55 reads "This is a coverage gap, not a logic bug."
**Why it matters:** Naming what something is not wastes a clause; the reader only needs what it is.
**What to change:** Cut to "Coverage is missing."

### stacked-hedge: three hedges on one claim

**What's wrong:** Line 61 reads "This might possibly indicate that the pool could be somewhat undersized."
**Why it matters:** Three hedges make the claim read as a guess, and the reader cannot tell how much doubt is real.
**What to change:** Keep one hedge: "The pool may be undersized."
