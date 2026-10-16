# spec-hooks-prose-hooks

## Metadata

| Field | Value |
|---|---|
| **Feature** | Prose hooks: `prose-gate` (block tier) and `prose-advisor` (advisory tier), with the `docs/tts/` exemption under the project root and the session directory |
| **Parent feature** | spec-hooks-platform.md |
| **Sub-features** | None |
| **Requirement refs** | BR-003, BR-008, UR-016, FR-103, FR-104, FR-105, FR-106, FR-181, NFR-005, NFR-008, NFR-009, NFR-019 |
| **Feature type** | Functionality |
| **Status** | Draft |

Status values: Draft, Review, Approved, Implemented.

## Description

Two hooks apply the writing standard (`rules/writing-standard.md`) to prose that agents and the main session write. `prose-gate` (PreToolUse) denies a write only when the text the call adds holds a block-tier tell: an em dash, chatbot residue, a curly quote, or a summary label. `prose-advisor` (PostToolUse) returns the advisory-tier tells in the added text as a short note and never blocks. Text already in the file is never judged, so files with old tells stay editable. Both share `lib/prose-diff.js` and `lib/prose-rules.js` and skip temp files, voice scripts under `docs/tts/`, and allowlisted paths.

Requirements marked **Built** describe commit 4803a0d. FR-181 is **PLANNED (1.11.1)**: it exempts `docs/tts/` under the project root and, when the session's working directory lies inside the project, under that directory too, as `DECISIONS.md:73-75` (2026-10-16) decides, refining the 2026-10-12 entry. Until it ships, the built rule exempts only `<cwd>/docs/tts/`, which equals the project's `docs/tts/` only for a session whose `cwd` is the project root (FR-104 status). The voice-script skill that writes `docs/tts/voice-*.md` is FR-163 (Area C) and is unchanged by the decision.

## Triggered by

| Trigger type | Source | Condition |
|---|---|---|
| Event | PreToolUse, matcher `Write\|Edit\|MultiEdit\|NotebookEdit` (`hooks/hooks.json:39-48`) | `prose-gate`, before the write |
| Event | PostToolUse, same matcher (`hooks/hooks.json:71-80`) | `prose-advisor`, after the write; it also requires `hook_event_name` `PostToolUse` (`impl/prose-advisor.js:42`) |

## Required data

| Data | Source | Type | Notes |
|---|---|---|---|
| `tool_name`, `tool_input` | Hook input | string, object | `file_path`, `content`, `old_string`, `new_string`, `replace_all`, `edits`, `notebook_path`, `cell_id`, `cell_type`, `edit_mode`, `new_source` |
| `tool_response.originalFile`, `tool_response.type` | Hook input (PostToolUse) | string or null | File contents before the call |
| `cwd` | Hook input | string | Base for relative target paths; root for `docs/tts/` today; PLANNED (FR-181): start of the `.git` walk and the session root |
| Target file contents | Local file system (PreToolUse) | UTF-8 text | Not judged above 4,000,000 bytes |
| `prose-gate-allowlist.json` | `${CLAUDE_PLUGIN_DATA}` | JSON array of strings | At most 200 entries of 1 to 500 characters; missing or malformed means empty |
| `CLAUDE_PROJECT_DIR` | Hook process environment | path | PLANNED (FR-181): first choice for the project root |

## Preconditions

| Condition | Check | If not met |
|---|---|---|
| Target is a prose file or a markdown notebook cell | Requirement: Prose file selection | No judgment, no output |
| Target is not exempt | Requirement: Path exemptions as built (PLANNED: the voice-script part replaced by Requirement: Voice-script exemption under the project root and the session directory) | No judgment, no output |
| Platform preconditions | spec-hooks-platform.md | Fail open |

## Algorithmic steps

Start-to-end flow, with the built and planned root for `docs/tts/`. Source: [spec-hooks-prose-hooks-flow.mmd](spec-hooks-prose-hooks-flow.mmd).

```mermaid
flowchart TD
  S(["Write, Edit, MultiEdit, or NotebookEdit"]) --> A["Resolve target: absolute as given, relative against input cwd"]
  A --> B{"Prose file or markdown notebook cell?"}
  B -->|no| NONE["Not judged: no output"]
  B -->|yes| C{"Under the system temp directory?"}
  C -->|yes| NONE
  C -->|no| R{"Root for docs/tts"}
  R -->|"Built"| R1["ROOT = input cwd"]
  R -->|"PLANNED FR-181"| R2["ROOT = project root (CLAUDE_PROJECT_DIR, else git root of input cwd, else input cwd), plus input cwd when inside the project"]
  R1 --> D{"Inside any ROOT/docs/tts/?"}
  R2 --> D
  D -->|yes| NONE
  D -->|no| E{"Path holds a prose-gate-allowlist.json entry, or the entry is *?"}
  E -->|yes| NONE
  E -->|no| F["Build before and after text pairs"]
  F --> G["Added lines: after lines with no equal line left in before"]
  G --> H["Blank exempt regions, scan the tier's rules, count hits on added lines minus hits on removed lines"]
  H --> I{"Which hook"}
  I -->|"prose-gate, PreToolUse"| J{"Block-tier hits?"}
  J -->|yes| DENY["Deny: hits by family with line, rule id, fix"]
  J -->|no| NONE
  I -->|"prose-advisor, PostToolUse"| K{"Advisory-tier hits?"}
  K -->|yes| ADV["additionalContext: one line per family, 10 lines at most"]
  K -->|no| NONE
```

**Note:** PNG rendering requires mermaid-cli with its headless browser, which is missing on this machine (see spec-hooks-platform.md). Render with `mmdc -i specs/spec-hooks-prose-hooks-flow.mmd -o specs/spec-hooks-prose-hooks-flow.png` once it is installed.

### Requirement: Prose file selection

Both hooks SHALL judge a Write, Edit, MultiEdit, or NotebookEdit call only when its target is a prose file (extension `.md`, `.mdx`, `.txt`, `.rst`, or `.adoc`, compared without regard to case) whose base name does not start with `changelog`, `license`, or `notice` (any case) and whose path has no `node_modules` or `.git` directory, or a markdown cell of a notebook whose path would be a prose file with `.md` in place of `.ipynb`.

**Requirement refs:** FR-103, FR-106, UR-016
**Status:** Built
**Source:** `hooks/lib/prose-rules.js:36-38`, `:297-307`; `hooks/lib/prose-diff.js:115-130`, `:229-261`

Target resolution: `file_path` (or `notebook_path`) as given when absolute or when the input `cwd` is missing or empty; otherwise resolved against the input `cwd`. A notebook cell counts as markdown when `cell_type` says so or, without it, when the existing cell found by `cell_id` is markdown; `edit_mode: "delete"` is never judged.

#### Scenario: Prose file

- **GIVEN** a Write of `notes.md` that adds a sentence with an em dash (U+2014)
- **WHEN** `prose-gate` evaluates it
- **THEN** the hook SHALL judge the added text and deny the write

#### Scenario: Changelog and code files

- **GIVEN** a Write of `CHANGELOG.md` and a Write of `a.js`, each adding an em dash
- **WHEN** `prose-gate` evaluates each
- **THEN** the hook SHALL allow both with no output

#### Scenario: Notebook code cell

- **GIVEN** a NotebookEdit on `a.ipynb` with `cell_type` `code` whose new source holds an em dash
- **WHEN** `prose-gate` evaluates it
- **THEN** the hook SHALL allow it with no output

### Requirement: Path exemptions as built

Both hooks SHALL NOT judge a target under the system temp directory (or its resolved real path), a target inside `<cwd>/docs/tts/` where `<cwd>` is the hook input's `cwd` and is a non-empty absolute path, or a target whose path contains an entry of `${CLAUDE_PLUGIN_DATA}/prose-gate-allowlist.json`, where the entry `*` exempts every path.

**Requirement refs:** FR-104, UR-016
**Status:** Built for a session whose cwd is the project root; root resolution from a subdirectory is PLANNED (FR-181)
**Source:** `docs/requirements/FR-NFR-assist-plugin.md:1959-1978` (FR-104); `hooks/lib/prose-diff.js:55-113`, `:250`; `DECISIONS.md:3-5` (2026-10-12, Prose hooks skip docs/tts) and `DECISIONS.md:73-75` (2026-10-16 refinement)

This requirement states the code at 4803a0d, which exempts `<cwd>/docs/tts/` only. FR-104's statement (`:1961`) already names the project root and the session's working directory inside it; Requirement: Voice-script exemption under the project root and the session directory specifies that planned part.

Matching rules: both paths are resolved and compared at a path-separator boundary, without regard to case on Windows; dot segments are normalized first, so `docs/tts/../README.md` is outside; symlinks are not resolved. An allowlist entry matches when the path, as given or with backslashes turned into slashes, contains it. The allowlist is separate from `hooks-disabled.json`, so a self-test never changes it.

#### Scenario: Voice script from the project root

- **GIVEN** a session whose `cwd` is the project root and a Write to `docs/tts/voice-intro-20261012-0900.md` with em dashes as pause marks
- **WHEN** `prose-gate` evaluates it
- **THEN** the hook SHALL allow the write with no output

#### Scenario: Voice script from a session started in a subdirectory, as built

- **GIVEN** a session started in `<project>/src` and a Write to `<project>/docs/tts/voice-intro-20261012-0900.md` with an em dash
- **WHEN** `prose-gate` evaluates it at commit 4803a0d
- **THEN** the hook SHALL deny it, because the built rule resolves `docs/tts/` against `<project>/src` only (this changes with FR-181, which adds the project root)

#### Scenario: Other docs path

- **GIVEN** a Write to `docs/guide.md` with an em dash
- **WHEN** `prose-gate` evaluates it
- **THEN** the hook SHALL deny the write

#### Scenario: Path that climbs out

- **GIVEN** a session at the project root and a Write to `docs/tts/../README.md` with an em dash
- **WHEN** `prose-gate` evaluates it
- **THEN** the hook SHALL deny the write

#### Scenario: Allowlist entry star

- **GIVEN** `prose-gate-allowlist.json` holds `["*"]`
- **WHEN** a Write to any prose file adds an em dash
- **THEN** both hooks SHALL emit nothing

### Requirement: Voice-script exemption under the project root and the session directory

Both hooks SHALL exempt a target inside `docs/tts/` under each exempt root: the project root (`CLAUDE_PROJECT_DIR`, else the git root of the hook input's `cwd`, else that `cwd`), and the hook input's `cwd` when that directory is the project root or lies inside it.

**Requirement refs:** FR-181, FR-104, UR-016, BR-008
**Status:** PLANNED (1.11.1)
**Source:** `DECISIONS.md:73-75` (2026-10-16, docs/tts exemption covers the project root and the session directory, refining the 2026-10-12 entry at `DECISIONS.md:3-5`); `docs/requirements/FR-NFR-assist-plugin.md:2417-2451` (FR-181, statement at `:2419`); `hooks/lib/prose-diff.js:95-101` (built rule)

Exempt roots, computed on every call:
1. **Project root.** (a) If the hook process's `CLAUDE_PROJECT_DIR` is a non-empty absolute path, the project root is that path, normalized. (b) Otherwise, if the hook input's `cwd` is a non-empty absolute path, the hook checks that directory and then each parent, up to the file-system root, for an entry named `.git` (a directory, or a file as in a linked worktree or a submodule); the first directory that holds one is the project root. (c) Otherwise, if the input `cwd` is a non-empty absolute path, the project root is that `cwd`. (d) Otherwise there is no project root.
2. **Session root.** The input `cwd`, when it is a non-empty absolute path and, after normalization, equals the project root or sits inside it (compared at a path-separator boundary, without regard to case on Windows). When the project root came from 1(b) or 1(c), the `cwd` is always inside it. A `cwd` outside the project root gives no session root.
3. A target is exempt when, after normalization, it sits inside `<project root>/docs/tts/` or `<session root>/docs/tts/`, compared as in Requirement: Path exemptions as built.

Further rules:
- "The hook's cwd" means the hook input's `cwd` field. The hook process's own working directory is the plugin root (`hooks/hooks.json:9`), which may sit inside the plugin's own git clone, so it is never used.
- Target resolution: an absolute target is used as given; a relative target is resolved against the input `cwd` only when that `cwd` is a usable root, a non-empty absolute path. A relative target with a missing, empty, or relative `cwd` is never exempt as a voice script, even when `CLAUDE_PROJECT_DIR` is set, because it cannot be placed in the project. (Today `targetPath` keeps such a target as written when the `cwd` is missing or empty, and resolves it against the process directory, the plugin root, when the `cwd` is relative (`hooks/lib/prose-diff.js:115-120`); in both cases `isVoiceScript` rejects it (`:98-99`). The planned code keeps that result by checking the `cwd` explicitly, and never treats the process directory as a root.)
- A `docs/tts/` directory under neither root is not exempt: with the session at `<project>`, `<project>/src/docs/tts/` is gated.
- The `.git` walk never throws: an error while checking one directory counts as "no `.git` here", and the walk continues upward. It does not run `git` (Business rules RULE-006).
- `/voice-script` is unchanged: it keeps saving under the session's working directory (`skills/voice-script/SKILL.md:162`), which the session root covers.
- One change in `lib/prose-diff.js` covers both hooks, because both call `changes()`.

Test option keys, accepted by `changes()` and forwarded by both hooks:

| Key | Value | When the key is absent |
|---|---|---|
| `projectDir` | A string, used as the value of `CLAUDE_PROJECT_DIR` under the same non-empty absolute rule, or `null` for "unset" | Read `process.env.CLAUDE_PROJECT_DIR` |
| `findGitRoot` | A function from an absolute directory to the directory that holds `.git`, or to `null` when there is none | Walk the file system as in step 1(b) |

A key is absent when the options object lacks it or holds `undefined` for it. The planned forwarding at `prose-gate.js:57` and `prose-advisor.js:44` takes both keys from `options || {}` unconditionally, as those lines do today for `readFile`, `allowlist`, and `tmpdir`, so a hook called with no options passes `undefined` for both, and `changes()` must then read the environment and walk the file system as in production. Only `null` for `projectDir` means "unset", and a `findGitRoot` value that is not a function counts as absent.

Code lines this requirement changes:

| File and lines | Change |
|---|---|
| `hooks/lib/prose-diff.js:95-101` (`isVoiceScript`), `:103-113` (`isExempt`), `:241-261` (`changes`, including `opts.cwd` at `:250`) | Compute both exempt roots; read `projectDir` and `findGitRoot` from the options |
| New module for the `.git` walk (proposed `hooks/lib/git-root.js`, ES2015, no dependencies) | Step 1(b) lives here, shared with `fsa-write-bar` for FR-186 (spec-hooks-fsa-write-bar.md, Requirement: Task-planner write scope in docs/task-plans/), so both hooks find a git root the same way |
| `hooks/impl/prose-gate.js:57` | Forward `projectDir` and `findGitRoot` from its `options` to `diff.changes()` (today it forwards `readFile`, `allowlist`, `tmpdir`) |
| `hooks/impl/prose-advisor.js:44` | The same forwarding |
| `hooks/impl/health-check.js:165-167` (`diskReader`) | Pass `projectDir` and `findGitRoot` from each case; see Requirement: Self-test isolation for the project root |
| Comments: `hooks/impl/prose-gate.js:8-10`, `hooks/impl/prose-advisor.js:7-8`, `:40`, `hooks/lib/prose-diff.js:95-97`, `:103-105`, `:241-243`, `:250`, `hooks/impl/health-check.js:31` | Describe the two exempt roots in place of `<cwd>/docs/tts/` |

Documents that describe the built rule and change with this requirement, as listed in `docs/requirements/FR-NFR-assist-plugin.md:3786`: `CLAUDE.md:96` and `:97` (prose-gate and prose-advisor bullets), `plugins/assist-plugin/Claude.md:76` and `:77`, `README.md:293`, and three Area C files: `skills/voice-script/SKILL.md:162` (which says the exemption is anchored to the session's working directory), `skills/health/SKILL.md:17`, and `docs/SPECIFICATION.md:420` (which says the hooks skip `docs/tts/` in the hook's working directory, not the git root). Area C tracks its three files as OP-2 under "Decided points" in `specs/spec-skills.md:42`.

#### Scenario: Subdirectory session, voice script at the project root

- **GIVEN** `CLAUDE_PROJECT_DIR` is `<project>` and the session `cwd` is `<project>/src`
- **WHEN** either hook evaluates a write to `<project>/docs/tts/voice-intro-20261012-0900.md` with em dashes
- **THEN** the hook SHALL treat the file as exempt and emit nothing

#### Scenario: Subdirectory session, voice script in the session directory

- **GIVEN** `CLAUDE_PROJECT_DIR` is `<project>` and the session `cwd` is `<project>/src`
- **WHEN** either hook evaluates a write to `<project>/src/docs/tts/voice-intro-20261016-0900.md`, where `/voice-script` saves, with em dashes
- **THEN** the hook SHALL treat the file as exempt and emit nothing

#### Scenario: Worktree session

- **GIVEN** `CLAUDE_PROJECT_DIR` is `<project>` and the session `cwd` is `<project>/.claude/worktrees/w`
- **WHEN** either hook evaluates a write to `<project>/.claude/worktrees/w/docs/tts/a.md` with em dashes
- **THEN** the hook SHALL treat the file as exempt and emit nothing

#### Scenario: No project directory variable

- **GIVEN** `CLAUDE_PROJECT_DIR` is unset and the input `cwd` is `<repo>/src`, inside a git repository whose root `<repo>` holds `.git`
- **WHEN** either hook evaluates a write under `<repo>/docs/tts/`
- **THEN** the hook SHALL take `<repo>` as the project root and emit nothing

#### Scenario: Linked worktree without the variable

- **GIVEN** `CLAUDE_PROJECT_DIR` is unset and the input `cwd` is `<worktree>/lib`, where `<worktree>` holds a `.git` file
- **WHEN** either hook evaluates a write to `<worktree>/docs/tts/a.md`
- **THEN** the hook SHALL take `<worktree>` as the project root and emit nothing

#### Scenario: Neither available

- **GIVEN** `CLAUDE_PROJECT_DIR` is unset and the input `cwd` is not inside a git repository
- **WHEN** either hook evaluates a write to `docs/tts/voice-x.md` relative to the `cwd`
- **THEN** the hook SHALL take the `cwd` as the project root and emit nothing

#### Scenario: Session directory outside the project

- **GIVEN** `CLAUDE_PROJECT_DIR` is `<project>` and the session `cwd` is `/work/other`, outside `<project>`
- **WHEN** `prose-gate` evaluates a write to `/work/other/docs/tts/a.md` with an em dash
- **THEN** the hook SHALL deny the write, because a `cwd` outside the project gives no second exempt root

#### Scenario: Other docs path stays gated

- **GIVEN** the subdirectory session of the first scenario
- **WHEN** `prose-gate` evaluates a write to `<project>/docs/guide.md` with an em dash
- **THEN** the hook SHALL deny the write

#### Scenario: docs/tts under neither root

- **GIVEN** `CLAUDE_PROJECT_DIR` is `<project>` and the session `cwd` is `<project>`
- **WHEN** `prose-gate` evaluates a write to `<project>/src/docs/tts/a.md` with an em dash
- **THEN** the hook SHALL deny the write

#### Scenario: Relative target without a usable cwd

- **GIVEN** `CLAUDE_PROJECT_DIR` is `<project>` and the hook input has no `cwd`
- **WHEN** `prose-gate` evaluates a write to the relative target `docs/tts/a.md` with an em dash
- **THEN** the hook SHALL deny the write, because a relative target without an absolute `cwd` is never exempt

#### Scenario: Relative project variable

- **GIVEN** `CLAUDE_PROJECT_DIR` is `app` (not absolute) and the input `cwd` is absolute and outside any git repository
- **WHEN** either hook evaluates a write to `<cwd>/docs/tts/a.md`
- **THEN** the hook SHALL ignore the variable, take the `cwd` as the project root, and emit nothing

#### Scenario: Hook called with no options honours CLAUDE_PROJECT_DIR

- **GIVEN** a unit test that sets `process.env.CLAUDE_PROJECT_DIR` to `/p`, and a Write input with `cwd` `/p/src` that adds an em dash to `/p/docs/tts/a.md`
- **WHEN** the test calls `prose-gate`'s `evaluate(input)` with no `options` argument, and `prose-advisor`'s `evaluate(input2)` with no `options` argument, where `input2` is a PostToolUse Write of the same target from the same `cwd` (`tool_response.type` `create`) whose added text holds an advisory tell
- **THEN** `prose-gate` SHALL return no deny and `prose-advisor` SHALL return `null`, because the forwarded `undefined` keys count as absent and `/p` becomes the project root

#### Scenario: Null project directory overrides the environment

- **GIVEN** the same environment and input
- **WHEN** the test calls `prose-gate`'s `evaluate(input, {projectDir: null, findGitRoot: () => null})`
- **THEN** `prose-gate` SHALL deny the write, because the project root falls back to `/p/src` and `/p/docs/tts/` sits under neither root

#### Scenario: Unreadable parent directory

- **GIVEN** `CLAUDE_PROJECT_DIR` is unset and checking one parent of the `cwd` raises a permission error
- **WHEN** either hook evaluates a write
- **THEN** the walk SHALL continue to the next parent, and the hook SHALL NOT take the failure path

### Requirement: Self-test isolation for the project root

Every prose self-test case in `impl/health-check.js` SHALL carry the two test option keys `projectDir` (a string, or null for unset) and `findGitRoot` (a function that returns a root or null), passed through `diskReader` to the hook, so neither the real `CLAUDE_PROJECT_DIR` nor the real file system changes a case's result.

**Requirement refs:** FR-181, FR-118, FR-091
**Status:** PLANNED (1.11.1)
**Source:** `hooks/impl/health-check.js:150-293` (prose case builders, corpora, and `diskReader`); spec-hooks-health-check.md

Without this, the SessionStart self-test would run in a session whose real `CLAUDE_PROJECT_DIR` is the user's project. The built allow case `tts: em dash in docs/tts (relative path)` (input `cwd` `/assist-selftest/project`, outside the user's project) would then lose both exempt roots, be denied, count as a false deny, and auto-disable `prose-gate` (FR-091).

Code lines this requirement changes:

| File and lines | Change |
|---|---|
| `hooks/impl/health-check.js:165-167` (`diskReader`) | Add `projectDir: input.projectDir` and `findGitRoot: input.findGitRoot` to the options it returns, and throw an `Error` naming the case label when the case lacks an own `projectDir` key or a function `findGitRoot`, so the case is recorded under "case threw" (`:851-858`) |
| `hooks/impl/health-check.js:155-161`, `:172-174`, `:182-186`, `:247-269` (`proseWrite`, `proseEdit`, `proseAt`, `proseIn`, `postWrite`, `postEdit`, `postIn`) | Set `projectDir: null` and `findGitRoot: NO_GIT_ROOT` (a function that returns null) unless the caller passes values |
| `hooks/impl/health-check.js:199`, `:213`, `:214`, `:222`, `:241`, `:242`, `:243`, `:244`, `:292` (cases written as object literals) | Add both keys |
| `hooks/impl/prose-gate.js:57`, `hooks/impl/prose-advisor.js:44` | Forward both keys to `diff.changes()` (Requirement: Voice-script exemption under the project root and the session directory) |

With project directory null and a finder that returns null, every existing case keeps its built result: the project root falls back to the `cwd` (step 1(c)), and the session root is the same directory.

Cases to add, with the fixed root `TTS_ROOT` = `/assist-selftest/project` and the fixed temp directory `TTS_TMP` (`impl/health-check.js:177-180`). Gate content is `` `A ${EM} B.\n` `` (an em dash between two words, as in the existing `tts:` cases); advisor content is `This is very robust.\n` (an intensifier and an AI-vocabulary word):

| # | Hook | Expect | `projectDir` | `findGitRoot` returns | Input `cwd` | Target | Content |
|---|---|---|---|---|---|---|---|
| 1 | `prose-gate` | allow | `TTS_ROOT` | null | `TTS_ROOT/src` | `TTS_ROOT/docs/tts/a.md` | gate |
| 2 | `prose-gate` | allow | `TTS_ROOT` | null | `TTS_ROOT/src` | `../docs/tts/a.md` | gate |
| 3 | `prose-gate` | allow | `TTS_ROOT` | null | `TTS_ROOT/src` | `TTS_ROOT/src/docs/tts/a.md` | gate |
| 4 | `prose-gate` | allow | `TTS_ROOT` | null | `TTS_ROOT/.claude/worktrees/w` | `TTS_ROOT/.claude/worktrees/w/docs/tts/a.md` | gate |
| 5 | `prose-gate` | allow | null | `TTS_ROOT` | `TTS_ROOT/src` | `TTS_ROOT/docs/tts/a.md` | gate |
| 6 | `prose-gate` | deny | `TTS_ROOT` | null | `TTS_ROOT` | `TTS_ROOT/src/docs/tts/a.md` | gate |
| 7 | `prose-gate` | deny | `TTS_ROOT` | null | `/assist-selftest/other` | `/assist-selftest/other/docs/tts/a.md` | gate |
| 8 | `prose-gate` | deny | `TTS_ROOT` | null | `TTS_ROOT/src` | `TTS_ROOT/docs/guide.md` | gate |
| 9 | `prose-gate` | deny | `TTS_ROOT` | null | none | `docs/tts/a.md` | gate |
| 10 | `prose-gate` | deny | `app` | null | none | `docs/tts/a.md` | gate |
| 11 | `prose-advisor` | clean | `TTS_ROOT` | null | `TTS_ROOT/src` | `TTS_ROOT/src/docs/tts/a.md` | advisor |
| 12 | `prose-advisor` | flagged | `TTS_ROOT` | null | `TTS_ROOT` | `TTS_ROOT/src/docs/tts/a.md` | advisor |
| 13 | `prose-advisor` | flagged | `TTS_ROOT` | null | `/assist-selftest/other` | `/assist-selftest/other/docs/tts/a.md` | advisor |

Case 9 is the relative-target, no-`cwd` case: the project root is `TTS_ROOT`, there is no session root, and the target stays relative, so it is not exempt.

#### Scenario: Real project variable during SessionStart

- **GIVEN** SessionStart runs with `CLAUDE_PROJECT_DIR=/home/u/app`
- **WHEN** the `prose-gate` self-test runs the case `tts: em dash in docs/tts (relative path)`
- **THEN** the case SHALL pass and `prose-gate` SHALL stay out of `hooks-disabled.json`

#### Scenario: Every prose case carries both keys

- **GIVEN** the exported corpora `PROSE_GATE_ALLOW`, `PROSE_GATE_DENY`, `PROSE_ADVISOR_CLEAN`, and `PROSE_ADVISOR_FLAGGED` (`impl/health-check.js:1143`)
- **WHEN** a unit test iterates every case
- **THEN** every case SHALL have an own `projectDir` property whose value is a string or null, and an own `findGitRoot` property that is a function

#### Scenario: Case built without the keys

- **GIVEN** a prose case added without `findGitRoot`
- **WHEN** the self-test runs it
- **THEN** `diskReader` SHALL throw for that case, the report SHALL list it under "case threw", and the hook's self-test SHALL be FAIL

### Requirement: Added-text extraction

Both hooks SHALL judge only the text a call adds, counting per rule the hits on added lines minus the hits on removed lines and reporting a hit only when that count is above zero.

**Requirement refs:** FR-103, FR-106, UR-016
**Status:** Built
**Source:** `hooks/lib/prose-diff.js:3-17`, `:146-261`, `:263-371`

Steps:
1. Build (before, after) text pairs. When the whole file is known, the pair is the whole file before and after the call. `prose-gate` reads the file from disk (a missing file is empty for a Write); `prose-advisor` uses `tool_response.originalFile` (`null` or `type: "create"` means empty; a Write with neither is not judged). An Edit or MultiEdit is applied in order the way the Edit tool does (`replace_all` honored; an empty `old_string` only on an empty file). When an `old_string` is not found, each edit becomes its own `old_string`/`new_string` pair. A NotebookEdit pairs the old cell source (insert mode, or the advisor: empty) with `new_source`.
2. Added lines are lines of "after" with no equal line left in "before"; removed lines are the reverse (a multiset match, so moved lines count as unchanged).
3. The tier's rules run over the whole of each text with exempt regions blanked; only hits on added and removed lines count.
4. When only some hits of a rule are new, the reported ones are those whose surrounding 12 characters on each side do not appear in the removed lines, checked for rules with at most 100 hits.
5. A side longer than 1,000,000 characters, or a target file over 4,000,000 bytes, is not judged.

Hit locations: `line N` for a whole-file pair, `new_string line N` for one fragment, `edit K, line N` for several, `cell line N` for a notebook cell.

#### Scenario: Old text untouched

- **GIVEN** a file that already holds an em dash and an Edit that adds clean text elsewhere
- **WHEN** `prose-gate` evaluates it
- **THEN** the hook SHALL allow the write

#### Scenario: Reworded line keeps its tell

- **GIVEN** a file line with one em dash and a Write that rewords that line and keeps the one em dash
- **WHEN** `prose-gate` evaluates it
- **THEN** the hook SHALL allow the write

#### Scenario: Second em dash added to a line

- **GIVEN** an Edit whose `old_string` holds one em dash and whose `new_string` holds two
- **WHEN** `prose-gate` evaluates it
- **THEN** the hook SHALL deny the write and report one hit

### Requirement: Exempt text regions

Both hooks SHALL blank, before any rule runs, fenced code (any indentation, unclosed fences to the end), blockquote lines, inline code of 1 to 3 backticks up to 500 characters, traceability markers such as `[SPEC-003 -> FR-045]`, link and image targets, reference link definitions, autolinks and bare URLs, straight or curly double-quoted runs of 1 to 300 characters on one line (the quote marks themselves stay judged), and an en or em dash between a digit and a number or numbered id.

**Requirement refs:** FR-105, UR-016
**Status:** Built
**Source:** `hooks/lib/prose-rules.js:40`, `:207-291`; `rules/writing-standard.md` (Exemptions)

Blanking keeps the text length and line breaks, so offsets and line numbers still point into the original text.

#### Scenario: Verbatim quotation

- **GIVEN** a write that adds `The log says "retry` plus an em dash plus `giving up" twice.`
- **WHEN** `prose-gate` evaluates it
- **THEN** the hook SHALL allow the write

#### Scenario: Traceability marker

- **GIVEN** a write that adds `[SPEC-003 -> FR-045]`
- **WHEN** both hooks evaluate it
- **THEN** neither hook SHALL flag the arrow

#### Scenario: Long quotation

- **GIVEN** a write that adds a double-quoted run of 301 characters holding an em dash
- **WHEN** `prose-gate` evaluates it
- **THEN** the hook SHALL deny the write, because the run is longer than 300 characters

### Requirement: Block-tier judgment and deny reason

`prose-gate` SHALL deny a write whose added text holds a hit of a block-tier rule, with a reason that groups the hits by family and gives each hit's location, rule id, and surrounding text, and each rule's fix once.

**Requirement refs:** FR-103, NFR-019, UR-016, BR-008
**Status:** Built
**Source:** `hooks/impl/prose-gate.js:18-61`; `hooks/lib/prose-rules.js:66-99`

Block-tier rules: `em-dash/char` (U+2014 and U+2015); `chatbot-residue/` `hope-it-helps`, `let-me-know`, `feel-free`, `happy-to-help`, `great-question`, `as-an-ai`, `anything-else`, `exclaimed-opener`, `apology`; `curly-quote/char` (U+2018, U+2019, U+201C, U+201D); `summary-label/` `opener`, `takeaway`, `bottom-line`, `heading`.

Reason format:
1. `assist-plugin prose-gate denied this write to <base name>: the added text has tells that are not allowed in prose by the writing standard.`
2. Per family: `<family>, <N> hit[s]:`, then at most 6 lines `- <location> (<rule id>) at "<surrounding text>"`, with `: <fix>` after the first hit of each rule id, then `- <K> more <family> hit[s] in the added text.` when more remain. Surrounding text is up to 20 characters each side, one line, control characters removed.
3. `Rewrite only the flagged text; the standard is at <plugin root>/rules/writing-standard.md.`
4. `Text that must stay verbatim (a quotation, the user's own words, a title) passes inside double quotes, a blockquote, or a code span; or ask the user to add the path to prose-gate-allowlist.json.`

The hook never rewrites the write.

#### Scenario: Added em dash

- **GIVEN** an Edit that adds a sentence with an em dash to `notes.md`
- **WHEN** `prose-gate` evaluates it
- **THEN** the hook SHALL deny the write and list the hit with its line, rule id `em-dash/char`, and fix

#### Scenario: Advisory tells only

- **GIVEN** a Write whose added text holds only intensifiers and hedges
- **WHEN** `prose-gate` evaluates it
- **THEN** the hook SHALL allow the write

#### Scenario: Clean prose

- **GIVEN** an agent writes a report to `report.md` with no block-tier tell
- **WHEN** `prose-gate` evaluates the write
- **THEN** the hook SHALL allow it with no output

### Requirement: Advisory note

`prose-advisor` SHOULD, after a write to a prose file, return the advisory-tier tells in the added text as `additionalContext`, each family once with its count, one example, its location, and its fix, in at most 10 lines, without blocking or changing the write.

**Requirement refs:** FR-106, UR-016
**Status:** Built
**Source:** `hooks/impl/prose-advisor.js:16-60`; `hooks/lib/prose-rules.js:101-205`

Advisory families: `em-dash` (rule `spaced-double-hyphen`), `hedge`, `intensifier`, `ai-vocabulary`, `throat-clearing`, `binary-contrast`, `en-dash`, `unicode-arrow` (a single arrow on a line that is not a table row).

Note format: first line `assist-plugin prose-advisor: the text just written to <base name> has advisory writing-standard tells (the write was not blocked; see rules/writing-standard.md):`, then at most 9 lines `- <family> (<count>): "<example>" on <location>. <fix>`. The example is the matched phrase, or the surrounding text when the match is shorter than 4 characters, cut to 60 characters with `...`.

#### Scenario: Hedge added

- **GIVEN** a write that adds a sentence opening with the hedge rule `hedge/should-be-noted`
- **WHEN** the advisor runs
- **THEN** the advisor SHALL add a note naming the `hedge` family and its fix

#### Scenario: Clean text

- **GIVEN** a write that adds no advisory tell
- **WHEN** the advisor runs
- **THEN** the advisor SHALL emit nothing

#### Scenario: Unknown earlier contents

- **GIVEN** a PostToolUse Write whose `tool_response` has neither `originalFile` nor `type: "create"`
- **WHEN** the advisor runs
- **THEN** the advisor SHALL emit nothing, because the added text cannot be told apart

### Requirement: No output on clean writes

Neither prose hook SHALL return any text to the model when the added text holds no tell of its tier.

**Requirement refs:** NFR-005, BR-003
**Status:** Built
**Source:** `hooks/impl/prose-gate.js:58-60`; `hooks/impl/prose-advisor.js:45-47`

#### Scenario: Clean write adds no tokens

- **GIVEN** a write to a prose file whose added text has no tell
- **WHEN** `prose-gate` and `prose-advisor` run
- **THEN** both SHALL print nothing to stdout

#### Scenario: Hook failure on a clean write

- **GIVEN** `prose-advisor` throws on a clean write
- **WHEN** the runtime handles it
- **THEN** the only output SHALL be the platform `systemMessage` warning, and the write SHALL stand

## Business rules

| Rule ID | Rule | Traces to | Applied at step | Example |
|---|---|---|---|---|
| RULE-001 | Only text the call adds is judged | FR-103, FR-106 | Requirement: Added-text extraction | Old em dashes stay editable |
| RULE-002 | Block-tier tells deny; advisory tells only advise | FR-103, FR-106 | Requirement: Block-tier judgment and deny reason | Intensifiers never deny |
| RULE-003 | Quotations, code, markers, links, and numeric ranges are not prose | FR-105 | Requirement: Exempt text regions | `"retry ... giving up"` |
| RULE-004 | Voice scripts under the project's `docs/tts/`, or under the session directory's `docs/tts/` when that directory is inside the project, may use em dashes as pause marks | FR-104, FR-181 | Requirement: Path exemptions as built; Requirement: Voice-script exemption under the project root and the session directory | `docs/tts/voice-intro-20261012-0900.md` |
| RULE-005 | Changelogs, licenses, notices, `node_modules`, and `.git` are not judged | FR-103 | Requirement: Prose file selection | `CHANGELOG.md` |
| RULE-006 | PLANNED: the git root is found by looking for a `.git` entry from the input `cwd` upward, without starting a `git` process (as `DECISIONS.md:75` states) | FR-181, NFR-008 | Requirement: Voice-script exemption under the project root and the session directory | A process start costs more of the 110 ms budget than a few `stat` calls (estimate) and fails where `git` is not installed |

## Data transformations

| Input | Transformation | Output | Notes |
|---|---|---|---|
| Tool input and file contents | Build before and after pairs | `{file, pairs: [{before, after, where}]}` | `changes()` |
| Pair | Multiset line diff, blank exempt regions, scan, subtract removed hits | Findings `{id, family, tier, line, where, excerpt, snippet, fix}` | `addedFindings()` |
| Findings | Group by family | Deny reason or advisory note | Per hook format |
| Input `cwd`, `CLAUDE_PROJECT_DIR`, file system | PLANNED: resolve the project root and the session root | Zero, one, or two absolute roots | Requirement: Voice-script exemption under the project root and the session directory |

## Output / Outcome

| Output | Type | Description |
|---|---|---|
| Deny decision | PreToolUse JSON | `prose-gate` only |
| `additionalContext` | PostToolUse JSON | `prose-advisor` only, `hookEventName` `PostToolUse` |
| Nothing | No stdout | Clean, exempt, or not prose |

## Error handling

| Error condition | Handling strategy | Outcome |
|---|---|---|
| Target file unreadable | Treated as missing (Write: empty before; Edit: fragment pairs) | Judgment on the call's own text |
| File over 4,000,000 bytes or text over 1,000,000 characters | Not judged | No output; the write proceeds |
| Allowlist malformed | Treated as empty | Normal judgment |
| PLANNED: error while looking for `.git` | Count as not found, continue upward | Root falls back per the order |
| Thrown error, malformed input, timeout | Platform failure path | Warning; the write proceeds unchecked |
| Hook disabled | Platform disabled path | `prose-gate` warns on every call; `prose-advisor` warns once per disable event |

## Events emitted

| Event name | Payload | Consumer(s) | When emitted |
|---|---|---|---|
| PreToolUse deny | Reason listing hits | Claude Code; the writer retries with the flagged text rewritten | Block-tier hit in added text |
| PostToolUse note | `additionalContext` | The model | Advisory-tier hit in added text |

## Events consumed

| Event name | Producer | Payload used | Handling |
|---|---|---|---|
| PreToolUse (`Write`, `Edit`, `MultiEdit`, `NotebookEdit`) | Claude Code | `tool_name`, `tool_input`, `cwd` | `prose-gate` |
| PostToolUse (same tools) | Claude Code | `tool_name`, `tool_input`, `tool_response`, `cwd` | `prose-advisor` |

## Sub-feature breakdown

Not applicable: a leaf feature of spec-hooks-platform.md.

## Performance considerations

| Concern | Target | Approach |
|---|---|---|
| Per-write latency (NFR-008) | At most 110 ms, measured as the median wall-clock time of 20 runs of `node hooks/<hook>.js` on a `Write` that creates a 2 KB clean `.md` file at `notes/a.md` (method proposed in `docs/requirements/FR-NFR-assist-plugin.md`, awaiting the user's confirmation) | One file read, linear line diff, bounded regexes |
| PLANNED root lookup cost | Within the same 110 ms | One `stat` per directory from the input `cwd` to the first `.git` or the file-system root; skipped entirely when `CLAUDE_PROJECT_DIR` is set |
| Self-test | 26 deny and 27 allow cases for `prose-gate`; 8 flagged and 10 clean cases for `prose-advisor` (`impl/health-check.js:188-293`), plus the PLANNED cases above | Fixed inputs with stub file readers |

## Traceability

| Requirement | Spec section | Verified by |
|---|---|---|
| BR-003 | Requirement: No output on clean writes | Clean-write scenario |
| BR-008 | Requirement: Block-tier judgment and deny reason; Requirement: Voice-script exemption under the project root and the session directory | Self-test corpora |
| UR-016 | Requirement: Prose file selection | Self-test corpora |
| FR-103 | Requirement: Prose file selection; Requirement: Added-text extraction; Requirement: Block-tier judgment and deny reason | `prose-gate` deny and allow corpora (`impl/health-check.js:188-245`) |
| FR-104 | Requirement: Path exemptions as built | `tts:` cases in the `prose-gate` corpora |
| FR-105 | Requirement: Exempt text regions | Quotation, marker, fence, range cases |
| FR-106 | Requirement: Advisory note; Requirement: Added-text extraction | `prose-advisor` corpora (`impl/health-check.js:271-293`) |
| FR-181 | Requirement: Voice-script exemption under the project root and the session directory; Requirement: Self-test isolation for the project root | PLANNED self-test cases 1 to 13; subdirectory, worktree, and outside-session scenarios; the every-case key test |
| NFR-005 | Requirement: No output on clean writes | Clean-write scenario |
| NFR-008 | Performance considerations | Median of 20 timed runs per hook |
| NFR-009 | Error handling | Platform failure-path tests |
| NFR-019 | Requirement: Block-tier judgment and deny reason | 0 block-tier hits in added text, as `prose-gate` judges it |
