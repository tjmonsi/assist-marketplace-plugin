# Symlink guards

`/do` guards each write it makes under `<root>/.agent/` against a symlink. Quote `<root>` and `<plan path>` as the Quoting rule says; `<plan path>` is the plan file's absolute path under `<root>/.agent/main-plan/`. Each guard is one Bash command on its own, run just before the write.

Plan-file guard, before every plan-file Write or Edit (Branch; a `resume` at Ingest; PlanApproval; Preflight; Dispatch; DocSignOff; Cleanup; and a terminal Status):

```bash
test ! -L '<root>/.agent' && test ! -L '<root>/.agent/main-plan' && test ! -L '<plan path>'
```

`/do` edits the plan file in place and never runs `rm -f` on it.

Snapshot guard, only when the session has no scratchpad directory, so snapshots go to `'<root>/.agent/change-check/'`:

```bash
test ! -L '<root>/.agent' && test ! -L '<root>/.agent/change-check'
```

The command that then writes a snapshot file starts its `&&` chain with `rm -f --` of that file, so a planted link at the target is never followed. Snapshots in the scratchpad get no guard: they sit outside `<root>/.agent`.

`test ! -L` on a path that does not exist exits 0, so a first write into a missing folder proceeds and the folder is created as before; the guards add no `mkdir`. A non-zero exit means a symlink, because `test` has no other failure for these operands. A folder swapped for a symlink after the guard and before the write is not caught, and fsa-write-bar resolves no symlinks, so a symlinked alias of a protected path escapes its `Bash` judge as well.

On a non-zero exit:

- `/do` writes nothing, writes no Status to any plan file, and ends in `Error(policy-rejection)` at the state that tried the write. The reply alone names the symlinked path and the state.
- In Dispatch, `/do` sends no new dispatch and no SendMessage, names the steps still running in the reply, and ends. Their results are not recorded, because the plan file cannot be written safely.
- A terminal Status write that the plan-file guard blocks is reported as `Error(policy-rejection)` in place of the terminal it was about to write, with no Status written. That covers `Complete`, `Partial`, and `Paused` from Cleanup, `Cancelled` from the PlanApproval cancel and the Preflight stop, and an `Error` of another class, the `Error(plan-invalid)` rows included.
- A non-zero plan-file or snapshot guard exit takes this outcome ahead of every other outcome of the state, `resume` at Ingest and the terminal choices at Cleanup included.
- Only the plan-file and snapshot guards raise this Error. A symlink found by the PR-file guard fails only the PR step (see pr-review-flow.md), and one found by the Cleanup sweep or the removal after a post changes no terminal.
