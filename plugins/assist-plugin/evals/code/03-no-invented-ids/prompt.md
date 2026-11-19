---
max_turns: 6
timeout_seconds: 180
allowed_tools: [Read, Glob, Grep, Skill]
runs: 2
---

Following the `code` skill's traceability rules, write a three-line JavaScript function `isExpired(token, now)` that returns true when `token.exp` is at or before `now`. No spec, requirements document, or task prompt supplies any requirement IDs. Output only the code.
