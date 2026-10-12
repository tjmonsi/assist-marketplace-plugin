---
name: branch
description: >-
  Manage git branches. Create feature/bugfix/release branches with standard naming,
  switch branches with stash support, list all branches, clean up merged
  worktrees and their branches, and clear the Go build cache.
effort: low
allowed-tools:
  - Bash(git:*)
  - Bash(df:*)
  - Bash(go clean:*)
  - Bash(realpath:*)
argument-hint: "[create | switch | list | cleanup] [branch-name | --dry-run]"
---

# Branch

Manage git branches with standard naming conventions and stash support.

## Commands

### Create

```
/branch create feature/user-auth
/branch create bugfix/null-pointer
/branch create release/1.0.0
```

**Naming conventions:**
- Features: `feature/description`
- Bug fixes: `bugfix/description`
- Releases: `release/version`
- Hotfixes: `hotfix/description`

### Switch

```
/branch switch feature/user-auth
```

**With stash:** Automatically stash uncommitted changes when switching if needed

### List

```
/branch list
```

Shows all local and remote branches.

### Cleanup

```
/branch cleanup
/branch cleanup --dry-run
```

Sweeps every linked worktree, including detached-HEAD worktrees, removes the finished ones, deletes their merged branches, and clears the Go build cache. A worktree is removed only when its branch (or detached commit) is an ancestor of the default branch, its status is clean (untracked files count), and it is unlocked. The main worktree, the current worktree, and the default, `main`, `master`, and `develop` branches are never touched. Squash-merged and rebase-merged branches show as `not merged` and are kept. Ignored files in each worktree are listed in the dry-run and the report. Rust and Gradle clean commands are reported, not run. `--dry-run` lists what would happen and changes nothing.

Full procedure: [references/worktree-cleanup.md](references/worktree-cleanup.md)

## Workflow

1. Create a branch for your work: `/branch create feature/x`
2. Work on the branch
3. Commit changes: `/commit`
4. Switch back to main: `/branch switch main`
5. Create pull request

## Constraints

- Branch names must follow conventions
- Cannot delete main or develop branches
- Remote branches tracked automatically
- Cleanup never uses `git worktree remove --force`, `git branch -D`, `git clean`, or `rm -rf`

## Report Writing Standard

- Put the answer or the most important finding first. No preamble, no restating the question, no closing recap.
- Let content set the length. Report a clean check in one line.
- Give each finding three parts: what happened, why it matters, what to do next.
- State each conclusion once. Open every paragraph with new information.
- Use active voice; put the important subject before the verb.
- Use plain words ("use" for "utilize"). Cut hedges, intensifiers, throat-clearing, buzzwords, and "not X but Y" framing; state what it is.
- Name headings after their content. Skip summary labels ("In conclusion", "Key takeaways"), severity badges, and summary sections unless the reader needs them.
- Write no em dashes (use a period, comma, colon, parentheses, or semicolon), no curly quotes, and no chatbot sign-offs or offers.
- Back every claim with evidence (file and line, log, test result, URL) and every number with a source; label estimates as estimates.
- Report tested results; never present the prompt or an assumption as fact.
- Quote exactly; never reword a quotation.
- Keep ticket ids and internal blame out of user-facing text.
