---
max_turns: 6
timeout_seconds: 180
allowed_tools: [Read, Glob, Grep, Skill]
runs: 2
---

I need a structured root cause analysis of a bug. A Node API handler crashes with `TypeError: Cannot read properties of undefined (reading 'id')`. The handler is:

```js
function getUserId(req) {
  return req.session.user.id;
}
```

It crashes for anonymous visitors, who have a session but no logged-in user. Diagnose the bug and report the root cause. Do not change any code.
