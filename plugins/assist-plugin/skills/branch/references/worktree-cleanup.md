# Worktree Cleanup

The single procedure for removing finished git worktrees, deleting their merged branches, and clearing build caches. `/branch cleanup` and `/do` Step 7 both run this file. Nothing here uses `--force`, `-D`, `git clean`, or `rm -rf`.

## Modes

| Mode | Caller | Candidate worktrees |
|------|--------|---------------------|
| Sweep | `/branch cleanup` | Every linked worktree in `git worktree list` |
| Targeted | `/do` Step 7 | Only the exact worktree paths the plan's steps created (from the Agent `isolation: "worktree"` result or EnterWorktree). Never sweep the repository. |

`--dry-run` (either mode): list every action that would happen (removals, branch deletions, caches, ignored files) and change nothing. Read-only commands still run.

All commands run from the main worktree. In `/do`, call ExitWorktree with keep before starting, so the working directory is outside the worktrees being removed.

## Failure rules

- Steps 1 to 4 fail: stop, change nothing, report the failing step and its message.
- Step 5 fails for a worktree: skip that worktree (and keep its branch), record the message, continue with the next.
- Step 6 fails: report it and carry on; it never blocks.

## Procedure

### 1. Record disk space

```bash
df -h .
```

Save the output as "before". Repeat after step 6 as "after".

### 2. Identify the default branch

1. If `git symbolic-ref --quiet --short refs/remotes/origin/HEAD` resolves, use its value (for example `origin/main`) as `<default>`.
2. Else, if `git rev-parse --verify --quiet refs/heads/main` succeeds, use `main`.
3. Else, if `git rev-parse --verify --quiet refs/heads/master` succeeds, use `master`.
4. Else stop with "default branch unknown" and change nothing.

### 3. List worktrees

```bash
git worktree list --porcelain
```

Each entry has `worktree <path>`, `HEAD <sha>`, and either `branch refs/heads/<name>` or `detached`. A `locked` line marks a locked worktree. The first entry is the main worktree.

In targeted mode, keep only the entries whose path equals a path the plan created. Record any other requested path as skipped (`not a worktree`).

### 4. Check eligibility

Skip a worktree and record the reason when any check fails. Checks run in this order:

1. **Main or current.** The first entry is the main worktree (`main worktree`). Compare `realpath "$(git rev-parse --show-toplevel)"` with `realpath '<path>'` for each entry; a match is the current worktree (`current directory`).
2. **Unsafe name.** The path, and the branch name if any, must match `^[A-Za-z0-9._/-]+$`. Otherwise skip (`unsafe name`). Quote every placeholder in commands, for example `'<path>'`.
3. **Protected branch.** Skip when the branch is the default branch, `main`, `master`, or `develop` (`protected branch`). Never pass these to `git branch -d`.
4. **Locked.** A `locked` line in the porcelain entry means skip (`locked`).
5. **Clean.** `git -C '<path>' status --porcelain --untracked-files=all` must print nothing. Untracked files count as dirty (`dirty`).
6. **Merged.** One exit-code test must succeed:
   - Branch: `git merge-base --is-ancestor 'refs/heads/<branch>' <default>`
   - Detached HEAD: `git merge-base --is-ancestor '<sha>' <default>`

   Otherwise skip (`not merged`).

Squash-merged and rebase-merged PRs rewrite the commits, so their branches are not ancestors of the default branch and show as `not merged`. Report them as such. Deleting those branches is a manual decision for the user.

For each eligible worktree, list its ignored files so the user sees what leaves with it:

```bash
git -C '<path>' status --porcelain --ignored
```

Report the `!!` lines per worktree. Ignored files do not block removal.

### 5. Remove each eligible worktree

In order, for each eligible worktree:

1. If `<path>/go.mod` exists, note that Go is present.
2. If `<path>/Cargo.toml` exists and `CARGO_TARGET_DIR` is set outside `<path>`, record the directory and the command for the user to run (see the cache table). Do not run it.
3. Remove the worktree:
   ```bash
   git worktree remove '<path>'
   ```
   Never add `--force`. If git refuses, skip the worktree, record git's message, and keep its branch.
4. For a branch (not detached HEAD), delete it:
   ```bash
   git branch -d '<branch>'
   ```
   Never use `-D`. If `-d` refuses, report the message and keep the branch.

### 6. Check stale entries and clear caches

List stale worktree entries without changing anything:

```bash
git worktree prune --dry-run --verbose
```

Put its output under skipped items. The user decides whether to prune.

If any removed worktree had Go, or the task built Go code, run:

```bash
(cd "$HOME" && go clean -cache -testcache)
```

Running from `$HOME` keeps any repository `go.mod` toolchain line from applying. The module cache stays untouched.

| Ecosystem | Handling |
|-----------|----------|
| Go | Automatic, as above |
| Rust | Report-only. When `CARGO_TARGET_DIR` is outside the worktree, report the directory and the command `cargo clean` for the user to run |
| Gradle | Report-only. `./gradlew clean` runs repository code, so report the command |
| Node, Python, `target/`, `build/` inside the worktree | Removed with the worktree |

### 7. Report

Record `df -h .` again, then report:

- Removed worktrees (path, branch)
- Deleted branches
- Caches cleared
- Ignored files that were removed with each worktree
- Space freed (before vs after)
- Skipped items, each with its reason, plus the stale-entry output from step 6
- Report-only commands (Rust, Gradle), if relevant

With `--dry-run`, label every line "would remove", "would delete", or "would clear", include the ignored-file listing, and omit space freed.

## Guards

- Never remove the main worktree, the current worktree, or a protected branch.
- Never remove a dirty, locked, unmerged, or unsafely named worktree.
- In `/do`, never touch a worktree the plan did not create.
- Never use `git worktree remove --force`, `git branch -D`, `git clean`, or `rm -rf`.
- Never run `go clean` with the module-cache flag.
- Never run repository-defined or toolchain clean commands (`./gradlew clean`, `cargo clean`) automatically.
