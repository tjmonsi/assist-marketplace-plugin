# Pseudo-code Gate

Specs describe what the system does and how it is designed. They do not contain source code. Pseudo-code is allowed only under one of two conditions.

## The two conditions

| Condition | Requirement | Marking | Status effect |
|---|---|---|---|
| **User-requested** | The user explicitly asks for pseudo-code in their prompt | Include as-is; no marker needed | No effect; Status follows the normal flow |
| **Agent-suggested** | A well-known algorithm, pattern, or technique clearly achieves the spec's goal and prose alone would be ambiguous | Must be marked `<!-- SUGGESTED: review before approval -->` immediately above the block | Status stays `Draft` until the user reviews and approves the pseudo-code |

Anything else is out. If neither condition holds, express the logic as numbered algorithmic steps or as Scenarios instead.

## Marking format

````markdown
<!-- SUGGESTED: review before approval -->

```
function reconcile(localRecords, remoteRecords):
    index = groupBy(remoteRecords, r -> r.externalId)
    for record in localRecords:
        match = index[record.externalId]
        if match is null:            -> queue for creation
        else if match.version > record.version -> queue for update
        else                         -> skip
    return { creations, updates, skipped }
```
````

The marker stays in the file after approval; it records that this block was agent-proposed rather than user-specified. Remove it only when the user asks for the block to be treated as a requirement.

## Rules

1. **Never substitute pseudo-code for a Scenario.** A block of pseudo-code is not testable by a QA agent. The Requirement and its GIVEN/WHEN/THEN Scenarios come first; pseudo-code clarifies, it does not replace.
2. **Never include real source code**, including imports, framework calls, SQL, or Terraform, no matter how short. Name the approach instead.
3. **Keep it language-neutral.** No type annotations, no library names, no syntax that ties the design to one runtime.
4. **One block per Requirement at most.** If a spec needs several, the design is being written as an implementation; stop and split the feature.
5. **Status gate is hard.** An agent-suggested block leaves the spec at `Draft`. `review` mode reports an unapproved suggested block in a spec marked `Approved` or `Implemented` as a CRITICAL finding.
6. **Record the approval.** When the user approves, note it in the spec's change log or metadata (`Status: Approved`, with the date) so the gate's outcome is visible later.
