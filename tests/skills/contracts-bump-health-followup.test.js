// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Contract and executed tests for the /bump and /health skill text after the follow-up to release
// 1.12.0 (task plan steps 13, 16, and 25): the /bump --path validation (three ordered steps, the
// eight stop messages R1 to R8, the shell-safe commands for R6 and R7) and the /health overview
// and findings rows for the pr-post-ask guard.
//
// Sources: specs/spec-skills-git.md (Change Log 2026-10-22: ADDED Requirement "--path value
// validated before it names anything", MODIFIED Requirement "Bump commit and tag"),
// specs/spec-skills-health.md (Change Log 2026-10-22: MODIFIED Requirement "Short summary with a
// fix per finding"), docs/requirements/FR-NFR-assist-plugin.md (FR-139, FR-209, FR-166, FR-118,
// FR-206), and the approved changes recorded in DECISIONS.md (2026-10-22: /bump tag names and
// pr-post-ask gaps found in review; pr-post-ask is a best-effort guard):
//   - R6 reads `test -d "$(git rev-parse --show-toplevel)/<dir>"` with no `--`.
//   - A stripped absolute value that is empty or "." means no --path.
//   - R8 rejects a segment that starts with "." or contains "..", in the same form as R1 to R7.
//   - There are eight stop messages, R1 to R8.
//   - The /health known-gap list holds the 11 items of the header comment of
//     hooks/impl/pr-post-ask.js, says the hook is best-effort and that later-found forms are added,
//     lists no bkt api gap, says a deny from another hook beats the ask, states the prompt behavior
//     by mode, and names three unverified items.
//
// Traceability format: [Ax | Scenario title | spec section | FR/NFR ids]. Ax is the acceptance row
// of the task plan docs/task-plans/task-plan-post-1-12-0-followups-20261022-143806.md. The specs
// use named requirement blocks and carry no SPEC-NNN id, so none is cited.
//
// The skills are prompt text, so most tests read them as text. The one executed test runs the
// documented R6 and R7 commands under bash in a temporary git repository (its folder name holds a
// quote, a command substitution, and a backtick); it is skipped with a reported reason when bash,
// git, or realpath is missing, and never passes silently. The tests do not run any skill.
//
// Run: node --test tests/skills/contracts-bump-health-followup.test.js

"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const childProcess = require("node:child_process");

const REPO = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");

// ---------------------------------------------------------------------------
// Readers and markdown helpers
// ---------------------------------------------------------------------------

function read(rel) {
  return fs.readFileSync(path.join(PLUGIN, rel), "utf8");
}

function linesOf(text) {
  return text.split(/\r?\n/);
}

function joined(lines) {
  return lines.join("\n");
}

// Collapse every run of white space to one space.
function squash(text) {
  return text.replace(/\s+/g, " ");
}

// Drop the backticks, then collapse white space: lets a key form match across code spans.
function plain(text) {
  return squash(text.replace(/`/g, ""));
}

function headingLevel(line) {
  const m = /^(#{1,6})\s/.exec(line);
  return m ? m[1].length : 0;
}

// Lines under `heading` (compared as a trimmed line) up to the next heading of the same or a higher
// level. Headings inside code fences do not count; fence lines are kept.
function section(text, heading) {
  const lines = linesOf(text);
  const level = headingLevel(heading + " ");
  const out = [];
  let inFence = false;
  let on = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      if (on) out.push(line);
      continue;
    }
    if (!inFence) {
      if (!on) {
        if (line.trim() === heading) on = true;
        continue;
      }
      const lv = headingLevel(line);
      if (lv > 0 && lv <= level) break;
    }
    if (on) out.push(line);
  }
  return out;
}

function splitRow(line) {
  let s = line.trim();
  if (s.charAt(0) === "|") s = s.slice(1);
  if (s.charAt(s.length - 1) === "|") s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.trim());
}

function stripFences(text) {
  return text.replace(/```[\s\S]*?```/g, "");
}

// The contents of every inline code span in `text` (fenced blocks removed first).
function spans(text) {
  const out = [];
  const re = /`([^`]+)`/g;
  const body = stripFences(text);
  let m;
  while ((m = re.exec(body)) !== null) out.push(m[1]);
  return out;
}

function has(text, key) {
  return key instanceof RegExp ? key.test(text) : text.indexOf(key) !== -1;
}

function assertHas(text, key, who) {
  assert.ok(has(text, key), who + ": missing " + String(key));
}

// ---------------------------------------------------------------------------
// /bump: --path validation (A12 | spec-skills-git.md | FR-209, FR-139)
// ---------------------------------------------------------------------------

const BUMP = read("skills/bump/SKILL.md");
const STRATEGY = read("skills/bump/references/bump-strategy.md");

function validation() {
  const lines = section(BUMP, "### `--path` validation");
  assert.ok(lines.length > 0, "skills/bump/SKILL.md has no '### `--path` validation' section");
  return joined(lines);
}

// The numbered Validate items (three-space indent), in document order.
function validateItems() {
  const items = linesOf(validation()).filter((l) => /^ {3}\d+\. /.test(l));
  assert.ok(items.length > 0, "the Validate step holds no numbered item");
  return items;
}

// The rule codes (2, 3, 4, 5, 8, 6, 7 ...) in the order the Validate items list them.
function validateOrder() {
  return validateItems().map((item) => {
    const m = /\(R(\d)\)/.exec(item);
    assert.ok(m, "a Validate item names no rule code: " + item);
    return Number(m[1]);
  });
}

function itemFor(code) {
  const item = validateItems().find((l) => l.indexOf("(R" + code + ")") !== -1);
  assert.ok(item, "no Validate item for R" + code);
  return item;
}

function normalizeStepText() {
  const v = validation();
  const a = v.indexOf("1. **Normalize.**");
  const b = v.indexOf("2. **Validate**");
  assert.ok(a >= 0 && b > a, "the Normalize step is missing or out of order");
  return v.slice(a, b);
}

test("bump SKILL.md --path validation has three steps in order: normalize, validate, name", () => {
  // [A12 | Validation runs before any version file is read; Invalid path builds no name | spec-skills-git.md ADDED Requirement | FR-209, FR-139]
  const v = validation();
  const a = v.indexOf("1. **Normalize.**");
  const b = v.indexOf("2. **Validate**");
  const c = v.indexOf("3. **Name.**");
  assert.ok(a >= 0 && b > a && c > b, "steps must read Normalize, Validate, Name in that order");
  const intro = squash(v);
  assertHas(intro, "A `--path` value passes three ordered steps before the skill reads a version file or writes, commits, or tags anything", "intro");
  assertHas(intro, "A value that breaks a rule stops the run with the message of that rule (R1 to R8), and nothing is changed", "intro");
});

test("bump SKILL.md puts the --path validation under Constraints", () => {
  // [A12 | Validation runs before any version file is read | spec-skills-git.md Planned conformance (SKILL.md Constraints) | FR-209]
  const constraints = joined(section(BUMP, "## Constraints"));
  assert.ok(constraints.indexOf("### `--path` validation") !== -1, "the validation section is not under ## Constraints");
});

test("bump SKILL.md Normalize step decides absolute before it removes anything and reads \\ as /", () => {
  // [A12 | Backslash spelling still works; File-system root is not the repository root | spec-skills-git.md ADDED Requirement | FR-209, FR-139]
  const raw = normalizeStepText();
  const t = squash(raw);
  assertHas(t, "Take the git root `R` from `git rev-parse --show-toplevel`", "Normalize");
  assertHas(t, "treat it as text only", "Normalize");
  assertHas(t, "is never pasted into a command", "Normalize");
  assert.ok(/Read every `\\` as `\/`/.test(t), "Normalize must read every \\ as /");
  assert.ok(/before removing anything, whether the value is absolute/.test(t), "the absolute test must come before any removal");
  assert.ok(/starts with `\/`, or with a drive letter, `:`, and `\/`/.test(t));
  assert.ok(/A lone `\/` or `\\` is absolute and names the file-system root/.test(t));
  assert.ok(t.indexOf("whether the value is absolute") < t.indexOf("loses one leading"), "the absolute test must precede the removals");
});

test("bump SKILL.md Normalize step removes one leading ./ and one trailing / from a relative value", () => {
  // [A12 | Root path counts as no --path; Valid relative path | spec-skills-git.md ADDED Requirement | FR-209]
  const t = squash(normalizeStepText());
  assert.ok(/A relative value loses one leading `\.\/` and one trailing `\/`/.test(t));
  assert.ok(/It counts as no `--path` when it is then empty or `\.`/.test(t));
  assert.ok(/Only one leading `\.\/` and one trailing `\/` are removed/.test(squash(validation())));
  assert.ok(/`\.\/\.\/x` fails R4 and `x\/\/` fails R2/.test(squash(validation())));
});

test("bump SKILL.md Normalize step handles an absolute value: root part kept, R, prefix strip, R1", () => {
  // [A12 | Valid absolute path inside the root; Absolute path outside the git root; File-system root is not the repository root; Root path counts as no --path | spec-skills-git.md ADDED Requirement | FR-209]
  const t = squash(normalizeStepText());
  assert.ok(/An absolute value loses one trailing `\/` only when more than the root part \(`\/`, or a drive letter, `:`, and `\/`\) remains, so `\/` and `C:\/` keep their slash/.test(t));
  assert.ok(/when it equals `R` it counts as no `--path`/.test(t));
  assert.ok(/when it starts with `R` followed by `\/` the prefix is stripped and the value becomes root-relative/.test(t));
  assert.ok(/a drive letter compares without case/.test(t));
  assert.ok(/any other absolute value, the file-system root included \(unless `R` is that root\), stops with R1/.test(t));
});

test("bump SKILL.md: a stripped absolute value that is empty or . means no --path", () => {
  // [A12 | Root path counts as no --path | spec-skills-git.md ADDED Requirement | FR-209; approved change: empty or "." after the strip]
  const t = squash(normalizeStepText());
  assert.ok(/and it counts as no `--path` when it is then empty or `\.` \(so `<root>\/\.` and `<root>\/\/` mean the root\)/.test(t));
  assert.ok(/No `--path` means the default names and root tags apply, and steps 2 and 3 are skipped/.test(t));
});

test("bump SKILL.md Validate step lists the rules in the documented order with R8 before the file-system checks", () => {
  // [A12 | Parent segment; Shell characters; Segment starts with a hyphen; Dots-only segment; Directory does not exist; Symlink leaves the repository | spec-skills-git.md ADDED Requirement | FR-209; approved change: R8]
  assert.deepStrictEqual(validateOrder(), [2, 3, 4, 5, 8, 6, 7]);
  assertHas(itemFor(2), "`^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$`", "R2");
  assertHas(itemFor(3), "No segment is `..`", "R3");
  assertHas(itemFor(4), "No segment matches `^\\.+$`", "R4");
  assertHas(itemFor(4), "so `.` and `...` are refused too", "R4");
  assertHas(itemFor(5), "No segment starts with `-`", "R5");
  assertHas(itemFor(8), "No segment starts with `.` or contains `..`", "R8");
  assertHas(itemFor(8), "`.github` and `a..b` are refused", "R8");
  assertHas(itemFor(8), "invalid git tag name", "R8");
  assertHas(itemFor(8), "before any file, commit, or tag changes", "R8");
  assertHas(squash(validation()), "on the text first and then on the file system", "Validate");
});

test("bump SKILL.md R6 is test -d with no -- and the operand starts with the absolute root", () => {
  // [A12 | Directory does not exist | spec-skills-git.md ADDED Requirement | FR-209; approved change: R6 has no --]
  const r6 = itemFor(6);
  assertHas(r6, "`test -d \"$(git rev-parse --show-toplevel)/<dir>\"` exits 0 (R6)", "R6");
  assertHas(r6, "needs no `--`", "R6");
  assert.ok(!/test -d --/.test(BUMP), "skills/bump/SKILL.md still holds 'test -d --'");
  assert.ok(!/test -d --/.test(STRATEGY), "bump-strategy.md still holds 'test -d --'");
  const tests = spans(validation()).filter((s) => /^test /.test(s));
  assert.deepStrictEqual(tests, ["test -d \"$(git rev-parse --show-toplevel)/<dir>\""]);
});

test("bump SKILL.md R7 compares two realpath outputs that read the root through the substitution", () => {
  // [A12 | Symlink leaves the repository; Git root name holds a quote | spec-skills-git.md ADDED Requirement | FR-209]
  const r7 = itemFor(7);
  assertHas(r7, "followed by `/` (R7)", "R7");
  assertHas(r7, "a symlink that leaves the repository is refused", "R7");
  const reals = spans(r7).filter((s) => /^realpath /.test(s));
  assert.deepStrictEqual(reals.sort(), [
    "realpath -- \"$(git rev-parse --show-toplevel)\"",
    "realpath -- \"$(git rev-parse --show-toplevel)/<dir>\"",
  ]);
  const t = squash(validation());
  assertHas(t, "Both commands read the git root only through the `$(git rev-parse --show-toplevel)` substitution inside double quotes", "Validate");
  assertHas(t, "Never paste the root into a command", "Validate");
  assertHas(t, "a root name that holds a quote, a `$`, a backtick, or a space then cannot break the quoting", "Validate");
});

test("bump SKILL.md: the raw --path text never reaches a shell command, only a validated <dir> does", () => {
  // [A12 | Shell characters; Validation runs before any version file is read | spec-skills-git.md ADDED Requirement | FR-209]
  const t = squash(validation());
  assertHas(t, "The raw `--path` text never reaches a shell command; only a value that passed checks 1 to 5 reaches one, as `<dir>`", "Validate");
  assert.strictEqual(validateOrder().indexOf(6), 5, "checks 1 to 5 must be the text checks that come before R6");
  // Every shell command in the section is test -d or realpath on the substitution, with <dir> as the only variable part.
  const shell = spans(validation()).filter((s) => /^(test|realpath|git) /.test(s));
  shell.forEach((s) => {
    const ok = /^test -d "\$\(git rev-parse --show-toplevel\)\/<dir>"$/.test(s)
      || /^realpath -- "\$\(git rev-parse --show-toplevel\)(\/<dir>)?"$/.test(s)
      || s === "git rev-parse --show-toplevel";
    assert.ok(ok, "unexpected shell command in the validation section: " + s);
  });
  assert.ok(shell.length >= 4, "expected the git root command, test -d, and two realpath commands");
});

test("bump SKILL.md holds eight stop messages R1 to R8, each ending 'nothing was changed'", () => {
  // [A12 | Parent segment; Shell characters; Segment starts with a hyphen; Dots-only segment; Directory does not exist; Symlink leaves the repository; Absolute path outside the git root | spec-skills-git.md ADDED Requirement (messages) | FR-209; approved change: R8]
  const block = /```text\n([\s\S]*?)```/.exec(validation());
  assert.ok(block, "no text block with the messages");
  const msgs = {};
  linesOf(block[1]).forEach((l) => {
    const m = /^R(\d)\s{2}(.*)$/.exec(l);
    if (m) msgs[Number(m[1])] = m[2];
  });
  assert.deepStrictEqual(Object.keys(msgs).map(Number).sort(), [1, 2, 3, 4, 5, 6, 7, 8], "expected exactly R1 to R8");
  assert.strictEqual(msgs[1], "error: --path is an absolute path outside the git root; nothing was changed");
  assert.strictEqual(msgs[2], "error: --path may hold only letters, digits, \".\", \"_\", and \"-\" in segments joined by \"/\"; nothing was changed");
  assert.strictEqual(msgs[3], "error: --path has a \"..\" segment; nothing was changed");
  assert.strictEqual(msgs[4], "error: --path has a segment made only of dots; nothing was changed");
  assert.strictEqual(msgs[5], "error: --path has a segment that starts with \"-\"; nothing was changed");
  assert.strictEqual(msgs[6], "error: --path names no directory: <dir>; nothing was changed");
  assert.strictEqual(msgs[7], "error: --path resolves outside the git root; nothing was changed");
  // R8 has the same form: names the rule, ends with "nothing was changed".
  assert.ok(/^error: --path .*; nothing was changed$/.test(msgs[8]), "R8 must read like R1 to R7");
  assertHas(msgs[8], "starts with \".\"", "R8");
  assertHas(msgs[8], "contains \"..\"", "R8");
  // Only R6 quotes a value, and it is the validated <dir>.
  Object.keys(msgs).forEach((k) => {
    if (Number(k) !== 6) assert.ok(msgs[k].indexOf("<") === -1, "R" + k + " quotes a value");
  });
  assertHas(squash(validation()), "Each message names the rule, ends with \"nothing was changed\", and quotes no raw `--path` text except the validated `<dir>` of R6", "Validate");
});

test("bump skill files no longer say seven messages or R1 to R7", () => {
  // [A12 | (stale count) | spec-skills-git.md Planned conformance | FR-209; approved change: eight stop messages]
  [["skills/bump/SKILL.md", BUMP], ["skills/bump/references/bump-strategy.md", STRATEGY]].forEach((pair) => {
    assert.ok(!/R1 to R7/.test(pair[1]), pair[0] + " still says R1 to R7");
    assert.ok(!/\bseven (stop )?messages\b/i.test(pair[1]), pair[0] + " still says seven messages");
  });
});

test("bump-strategy.md notes that the subproject path passes FR-209 before detection", () => {
  // [A12 | Validation runs before any version file is read | spec-skills-git.md Planned conformance (bump-strategy.md) | FR-209]
  const t = squash(STRATEGY);
  assertHas(t, "FR-209", "bump-strategy.md");
  assertHas(t, "normalize, validate, then name", "bump-strategy.md");
  assertHas(t, "before any version file is detected, read, or written", "bump-strategy.md");
  assertHas(t, "the eight stop messages R1 to R8", "bump-strategy.md");
  assertHas(t, "under \"`--path` validation\" in [../SKILL.md](../SKILL.md)", "bump-strategy.md");
  assertHas(t, "The raw `--path` text never reaches a shell command, and a refused value changes nothing", "bump-strategy.md");
  assert.ok(fs.existsSync(path.join(PLUGIN, "skills", "bump", "SKILL.md")), "the link target SKILL.md is missing");
});

test("bump SKILL.md names <dir> and <tagdir> only after validation, and a root --path counts as none", () => {
  // [A12 | Valid absolute path inside the root; Backslash spelling still works; Invalid path builds no name; Root path counts as no --path | spec-skills-git.md ADDED and MODIFIED Requirements | FR-209, FR-139]
  const v = squash(validation());
  assertHas(v, "3. **Name.** `<dir>` is the validated value and `<tagdir>` is `<dir>` with every `/` replaced by `-`", "Name step");
  const commit = squash(joined(section(BUMP, "### 5. Commit & Tag (optional)")));
  assertHas(commit, "Under a `--path` below the root, the message is `chore: bump <dir> to X.Y.Z`", "Commit & Tag");
  assertHas(commit, "Under a `--path` below the root, the tag is `<tagdir>-vX.Y.Z`", "Commit & Tag");
  assertHas(commit, "`<dir>` is the `--path` value after it is normalized and validated, and only then named", "Commit & Tag");
  assertHas(commit, "with a leading `./` and a trailing `/` removed and `\\` read as `/`", "Commit & Tag");
  assertHas(commit, "A `--path` that resolves to the repository root (`.`, `./`, or the root's own path) counts as no `--path`: the default names and the root tags apply", "Commit & Tag");
});

test("bump SKILL.md --path option row says the value is a directory inside the repository and validated", () => {
  // [A12 | Valid relative path; Valid absolute path inside the root | spec-skills-git.md Planned conformance (SKILL.md option row) | FR-209]
  const row = linesOf(BUMP).find((l) => l.indexOf("| `--path PATH` |") === 0);
  assert.ok(row, "no --path PATH option row");
  const cells = splitRow(row);
  assertHas(cells[1], "Directory inside the repository", "option row");
  assertHas(cells[1], "given as a relative path or an absolute path inside the git root", "option row");
  assertHas(cells[1], "validated before it is used (see Constraints)", "option row");
  assert.strictEqual(cells[2], "`.` (root)");
});

test("bump SKILL.md argument-hint and metadata.json agree and keep [--path PATH]", () => {
  // [A12 | (argument hint unchanged) | spec-skills-git.md Planned conformance | FR-138, FR-209]
  const hint = /^argument-hint:\s*"(.*)"\s*$/m.exec(BUMP);
  assert.ok(hint, "bump SKILL.md has no quoted argument-hint");
  assert.strictEqual(hint[1], "[patch | minor | major | auto] [--path PATH] [--no-tag] [--no-commit] [--no-changelog]");
  const meta = /"argument-hint":\s*"([^"]*)"/.exec(read("skills/bump/metadata.json"));
  assert.ok(meta, "bump metadata.json has no argument-hint");
  assert.strictEqual(meta[1], hint[1]);
});

// ---------------------------------------------------------------------------
// /bump: the documented rules applied to the spec's scenario values (a reference model that takes
// the pattern and the rule order from the skill text, so a change to either breaks a scenario)
// ---------------------------------------------------------------------------

function fold(s) {
  return /^[A-Za-z]:/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

function modelNormalize(raw, root) {
  let v = raw.replace(/\\/g, "/");
  const absolute = v.charAt(0) === "/" || /^[A-Za-z]:\//.test(v);
  if (!absolute) {
    if (v.indexOf("./") === 0) v = v.slice(2);
    if (v.charAt(v.length - 1) === "/") v = v.slice(0, -1);
    return v === "" || v === "." ? { none: true } : { value: v };
  }
  const rootPart = v.charAt(0) === "/" ? "/" : v.slice(0, 3);
  if (v.length > rootPart.length && v.charAt(v.length - 1) === "/") v = v.slice(0, -1);
  if (fold(v) === fold(root)) return { none: true };
  if (fold(v).indexOf(fold(root) + "/") === 0) {
    const rest = v.slice(root.length + 1);
    return rest === "" || rest === "." ? { none: true } : { value: rest };
  }
  return { rule: "R1" };
}

function patternFromSkill() {
  const m = /`(\^[^`]+\$)`/.exec(itemFor(2));
  assert.ok(m, "the R2 item holds no pattern code span");
  return new RegExp(m[1]);
}

function modelOutcome(raw, root) {
  const pattern = patternFromSkill();
  const rules = {
    2: (v) => !pattern.test(v),
    3: (v) => v.split("/").some((s) => s === ".."),
    4: (v) => v.split("/").some((s) => /^\.+$/.test(s)),
    5: (v) => v.split("/").some((s) => s.charAt(0) === "-"),
    8: (v) => v.split("/").some((s) => s.charAt(0) === "." || s.indexOf("..") !== -1),
  };
  const n = modelNormalize(raw, root);
  if (n.rule) return n.rule;
  if (n.none) return "none";
  const textCodes = validateOrder().filter((c) => c !== 6 && c !== 7);
  for (let i = 0; i < textCodes.length; i++) {
    if (rules[textCodes[i]](n.value)) return "R" + textCodes[i];
  }
  return "ok:" + n.value;
}

const ROOT = "/home/user/repo";

const SCENARIO_VALUES = [
  // [A12 | Valid relative path | spec-skills-git.md] valid inputs
  ["./services/auth", ROOT, "ok:services/auth"],
  ["services/auth", ROOT, "ok:services/auth"],
  ["a.b/c_d-e", ROOT, "ok:a.b/c_d-e"],
  // [A12 | Valid absolute path inside the root]
  [ROOT + "/services/auth", ROOT, "ok:services/auth"],
  // [A12 | Backslash spelling still works]
  [".\\services\\auth\\", ROOT, "ok:services/auth"],
  // [A12 | Parent segment]
  ["../other", ROOT, "R3"],
  ["services/../../x", ROOT, "R3"],
  // [A12 | Shell characters | Invalid path builds no name]
  ["svc$(id)", ROOT, "R2"],
  ["svc;x", ROOT, "R2"],
  ["svc\nx", ROOT, "R2"],
  ["svc; touch x", ROOT, "R2"],
  ["a b", ROOT, "R2"],
  // [A12 | Segment starts with a hyphen]
  ["-rf", ROOT, "R5"],
  ["services/-x", ROOT, "R5"],
  // [A12 | Dots-only segment] (R4 is checked before R8, so "..." is R4)
  ["services/.../auth", ROOT, "R4"],
  ["services/./auth", ROOT, "R4"],
  ["...", ROOT, "R4"],
  // One leading ./ and one trailing / only
  ["././x", ROOT, "R4"],
  ["x//", ROOT, "R2"],
  // Approved change: R8 (segment starts with "." or contains "..")
  [".github", ROOT, "R8"],
  ["services/.github/x", ROOT, "R8"],
  ["a..b", ROOT, "R8"],
  ["v1..2/x", ROOT, "R8"],
  // [A12 | Absolute path outside the git root]
  ["/etc/other", ROOT, "R1"],
  // [A12 | File-system root is not the repository root]
  ["/", ROOT, "R1"],
  ["\\", ROOT, "R1"],
  ["C:/", "C:/Users/me/repo", "R1"],
  // [A12 | Root path counts as no --path] and approved change: empty or "." after the strip
  ["./", ROOT, "none"],
  [".", ROOT, "none"],
  [ROOT, ROOT, "none"],
  [ROOT + "/", ROOT, "none"],
  [ROOT + "/.", ROOT, "none"],
  [ROOT + "//", ROOT, "none"],
  ["c:/Users/me/repo/services/auth", "C:/Users/me/repo", "ok:services/auth"],
];

test("rules read from the bump skill give the spec's outcome for each scenario value", () => {
  // [A12 | Valid relative path; Valid absolute path inside the root; Parent segment; Shell characters; Segment starts with a hyphen; Dots-only segment; Backslash spelling still works; Absolute path outside the git root; File-system root is not the repository root; Root path counts as no --path | spec-skills-git.md ADDED Requirement | FR-209]
  SCENARIO_VALUES.forEach((row) => {
    assert.strictEqual(modelOutcome(row[0], row[1]), row[2], "value " + JSON.stringify(row[0]) + " with root " + row[1]);
  });
});

test("the R2 pattern from the bump skill refuses injection-shaped and malformed values", () => {
  // [A12 | Shell characters | spec-skills-git.md ADDED Requirement | FR-209] security-adjacent and boundary inputs
  const pattern = patternFromSkill();
  ["services/auth", "a", "a/b/c", "A-b_c.d", "x.y/z"].forEach((ok) => assert.ok(pattern.test(ok), "should accept " + ok));
  [
    "", "/x", "x/", "x//y", "a b", "a\tb", "svc$(id)", "svc`id`", "svc;x", "svc|x", "svc&x", "svc>x", "svc'x", "svc\"x",
    "svc\n", "svc\nx", "a\\b", "~/x", "$HOME/x", "x\u0000y", "caf\u00e9",
  ].forEach((bad) => assert.ok(!pattern.test(bad), "should refuse " + JSON.stringify(bad)));
});

// ---------------------------------------------------------------------------
// /bump: the documented R6 and R7 commands, executed (A12 | Git root name holds a quote; Directory
// does not exist; Symlink leaves the repository)
// ---------------------------------------------------------------------------

function runnable(cmd, args) {
  const r = childProcess.spawnSync(cmd, args, { encoding: "utf8" });
  return !r.error && r.status === 0;
}

const SKIP_EXEC = process.platform === "win32"
  ? "not-run: the executed test needs a POSIX file system"
  : (runnable("bash", ["-c", "command -v realpath"]) && runnable("git", ["--version"]))
    ? false
    : "not-run: bash, realpath, or git is not on PATH";

function sh(cmd, cwd) {
  return childProcess.spawnSync("bash", ["-c", cmd], { cwd: cwd, encoding: "utf8" });
}

function fill(cmd, dir) {
  return cmd.split("<dir>").join(dir);
}

test("documented R6 and R7 commands behave as stated in a repository whose folder name holds shell syntax", { skip: SKIP_EXEC }, () => {
  // [A12 | Git root name holds a quote; Directory does not exist; Symlink leaves the repository; Valid relative path | spec-skills-git.md ADDED Requirement | FR-209]
  const found = spans(validation());
  const testCmds = found.filter((s) => /^test -d /.test(s));
  const reals = found.filter((s) => /^realpath -- /.test(s));
  assert.strictEqual(testCmds.length, 1, "expected one test -d command");
  assert.strictEqual(reals.length, 2, "expected two realpath commands");
  const testCmd = testCmds[0];
  const withDir = reals.find((s) => s.indexOf("<dir>") !== -1);
  const rootOnly = reals.find((s) => s.indexOf("<dir>") === -1);
  assert.ok(withDir && rootOnly, "the realpath commands are not one with <dir> and one without");

  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bump-path-"));
  try {
    // Security-adjacent: the git root name holds a quote, a command substitution, a backtick, and spaces.
    const root = path.join(base, "o'brien $(touch PWNED) `touch PWNED2` repo");
    const outside = path.join(base, "outside");
    fs.mkdirSync(root);
    fs.mkdirSync(outside);
    const init = childProcess.spawnSync("git", ["init", "-q"], { cwd: root, encoding: "utf8" });
    assert.strictEqual(init.status, 0, "git init failed: " + init.stderr);
    fs.mkdirSync(path.join(root, "services", "auth"), { recursive: true });
    fs.mkdirSync(path.join(root, "-rf"));
    fs.writeFileSync(path.join(root, "afile"), "x");
    fs.symlinkSync(outside, path.join(root, "escape"), "dir");

    const insideRoot = (dir) => {
      const d = sh(fill(withDir, dir), root);
      const r = sh(fill(rootOnly, dir), root);
      assert.strictEqual(d.status, 0, "realpath of the directory failed: " + d.stderr);
      assert.strictEqual(r.status, 0, "realpath of the root failed: " + r.stderr);
      const dl = d.stdout.replace(/\n$/, "");
      const rl = r.stdout.replace(/\n$/, "");
      return dl.indexOf(rl + "/") === 0;
    };

    // Valid: R6 passes and R7 holds.
    assert.strictEqual(sh(fill(testCmd, "services/auth"), root).status, 0, "R6 must pass for an existing directory");
    assert.ok(insideRoot("services/auth"), "R7 must hold for services/auth");
    // Invalid: no such directory, and a file is no directory (R6).
    assert.notStrictEqual(sh(fill(testCmd, "services/missing"), root).status, 0, "R6 must fail for a missing directory");
    assert.notStrictEqual(sh(fill(testCmd, "afile"), root).status, 0, "R6 must fail for a file");
    // Invalid: a symlink out of the repository is a directory (R6 passes) but R7 refuses it.
    assert.strictEqual(sh(fill(testCmd, "escape"), root).status, 0, "test -d follows the symlink");
    assert.ok(!insideRoot("escape"), "R7 must refuse a symlink that leaves the repository");
    // Boundary: a directory named -rf is read as an operand because the operand starts with the absolute root.
    assert.strictEqual(sh(fill(testCmd, "-rf"), root).status, 0, "test -d needs no -- when the operand starts with the root");
    // The root name never ran as a command.
    assert.ok(!fs.existsSync(path.join(root, "PWNED")), "the command substitution in the root name ran");
    assert.ok(!fs.existsSync(path.join(root, "PWNED2")), "the backtick in the root name ran");
    assert.ok(!fs.existsSync(path.join(base, "PWNED")) && !fs.existsSync(path.join(base, "PWNED2")));
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// /health: pr-post-ask overview and findings (A11 | spec-skills-health.md | FR-166, FR-118, FR-206)
// ---------------------------------------------------------------------------

const HEALTH = read("skills/health/SKILL.md");

// The known-gap items of the header comment of hooks/impl/pr-post-ask.js: the lines that start with
// "//   - " after "// Known gaps", with continuation lines joined. Only the header is read.
function hookHeaderGaps() {
  const lines = linesOf(read("hooks/impl/pr-post-ask.js"));
  const end = lines.findIndex((l) => l.trim() === "\"use strict\";");
  assert.ok(end > 0, "hooks/impl/pr-post-ask.js has no \"use strict\" line after its header");
  const header = lines.slice(0, end);
  const start = header.findIndex((l) => /^\/\/ Known gaps/.test(l));
  assert.ok(start >= 0, "the header of pr-post-ask.js has no '// Known gaps' line");
  const items = [];
  for (let i = start + 1; i < header.length; i++) {
    if (/^\/\/ {3}- /.test(header[i])) {
      items.push(header[i].replace(/^\/\/ {3}- /, ""));
    } else if (/^\/\/ {5}\S/.test(header[i]) && items.length > 0) {
      items[items.length - 1] += " " + header[i].replace(/^\/\/\s+/, "");
    } else {
      break;
    }
  }
  return items.map(plain);
}

// Key forms per known gap, in the order of the hook header. `all` must appear in the hook header
// item and in each documentation item; `docs` must appear in each documentation item only (the
// header abbreviates those).
const KEY_FORMS = [
  { name: "program word from a variable or expression", all: ["program word taken from a variable or an expression", "PowerShell splatting"], docs: [] },
  { name: "gh api, gh pr edit, aliases, other bkt pr subcommands", all: ["gh api", "gh pr edit", "gh alias or extension", "subcommands other than"], docs: ["gh pr ready", "gh pr reopen"] },
  { name: "command string run by another program, argv wrappers", all: ["command string run by another program", "bash -c", "eval", "Invoke-Expression", "xargs", "find -exec", "argv wrappers outside the", "setsid", "doas", "ionice", "stdbuf --output"], docs: ["sh -c", "pwsh -Command", "cmd /c"] },
  { name: "substitution inside another program's argument", all: ["another program's argument", "echo $(gh pr merge 1)"], docs: [] },
  { name: "Bash program name in another case, shims, aliases, renamed binaries", all: [/\bGH\b/, ".cmd", ".bat", ".ps1", "shell aliases", "renamed or linked binaries"], docs: [] },
  { name: "option with a separate value ahead of the verb", all: ["separate value ahead of the verb", "gh --body x pr comment 1", "bkt pr --text x comment 1"], docs: ["gh pr --body x comment 1", "gh pr -b x comment 1", "gh pr --body-file f review 1 --approve"] },
  { name: "redirection the shared lexer splits", all: ["redirection the shared lexer splits into separate parts", "gh 2>&1 pr merge 1", "gh >&2 pr merge 1", "gh &>/dev/null pr merge 1", "gh >| out pr merge 1", "bkt 2>&1 pr approve 1", "gh < <(true) pr merge 1"], docs: [] },
  { name: "PowerShell array or script block in the verb position", all: ["PowerShell array or script block in the verb position", "gh pr @('merge') 1", "gh pr {merge} 1", "PowerShell comment that hides an opening parenthesis"], docs: [] },
  { name: "quoting forms, brace expansion, glob, arithmetic heredoc, sudo --user", all: ["$\"gh\"", "$'g\\x68'", "brace expansion", "glob in the program word", "(( x = 1 << 2 ))", "sudo --user"], docs: ["{gh,pr,merge,1}", "/usr/bin/g[h]"] },
  { name: "PowerShell forms of doc-cli-guard, redirection before the program", all: ["PowerShell forms listed for doc-cli-guard", "redirection before the program"], docs: ["2>/dev/null gh pr merge 1"] },
  { name: "REST request through curl, HTTP client, or MCP tool", all: ["REST", "curl", "another HTTP client, or an MCP tool"], docs: [] },
];

// Split on ";" outside parentheses.
function splitTopLevel(text) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === ";" && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

// The /health overview line (line 17 at 1.12.0).
function overview() {
  const line = linesOf(HEALTH).find((l) => l.indexOf("Report whether the assist-plugin hooks are working:") === 0);
  assert.ok(line, "no overview line in skills/health/SKILL.md");
  return line;
}

// The part of the overview about pr-post-ask.
function askPart() {
  const o = overview();
  const s = o.indexOf("The `pr-post-ask` guard asks the user before");
  const e = o.indexOf("`writing-context` adds the compact writing standard");
  assert.ok(s >= 0 && e > s, "the pr-post-ask passage is missing from the overview");
  return o.slice(s, e);
}

// The known-gap items of the /health overview, as plain text.
function healthGapItems() {
  const t = plain(askPart());
  const lead = "Its known gaps, and no others: ";
  const s = t.indexOf(lead);
  const e = t.indexOf(". It has no bkt api gap");
  assert.ok(s >= 0 && e > s, "the overview lacks 'Its known gaps, and no others:' or 'It has no `bkt api` gap'");
  return splitTopLevel(t.slice(s + lead.length, e));
}

test("pr-post-ask header comment holds the 11 known gaps and each key form", () => {
  // [A11 | Overview lists the hook and its gaps | spec-skills-health.md | FR-206; approved change: the final 11-item list]
  const items = hookHeaderGaps();
  assert.strictEqual(items.length, 11, "the header lists " + items.length + " known gaps, expected 11");
  KEY_FORMS.forEach((kf, i) => {
    kf.all.forEach((k) => assertHas(items[i], k, "header item " + (i + 1) + " (" + kf.name + ")"));
  });
  assert.ok(items.join(" ").indexOf("bkt api") === -1, "the header lists a bkt api gap");
});

test("health SKILL.md overview names pr-post-ask among the PreToolUse guards", () => {
  // [A11 | Overview lists the hook and its gaps | spec-skills-health.md | FR-206, FR-166]
  const o = overview();
  assert.ok(/the PreToolUse guards \(`sa-mermaid-only`, `doc-cli-guard`, `commit-attribution-guard`, `pr-post-ask`, `prose-gate`, `fsa-write-bar`\)/.test(o));
});

test("health SKILL.md overview lists the commands pr-post-ask asks before and says every session", () => {
  // [A11 | Overview lists the hook and its gaps | spec-skills-health.md | FR-206]
  const t = squash(askPart());
  assertHas(t, "asks the user before `gh pr review`, `merge`, `comment`, and `close`, `bkt pr approve`, `comment`, `decline`, `close`, and `merge`, and a `bkt api` call that may write", "ask list");
  assertHas(t, "(an option it does not recognize counts as a possible write)", "ask list");
  assertHas(t, "in every session", "ask list");
  assertHas(t, "It asks and never denies, and it fails open", "ask list");
});

test("health SKILL.md says pr-post-ask is best-effort and that a bypass form found later is added", () => {
  // [A11 | Overview lists the hook and its gaps | spec-skills-health.md | FR-206; approved change: best-effort sentence]
  const t = squash(askPart());
  assertHas(t, "It is best-effort, and a bypass form found later is added to this list", "best-effort sentence");
});

test("health SKILL.md known-gap list holds the 11 items of the hook header and nothing else", () => {
  // [A11 | Overview lists the hook and its gaps | spec-skills-health.md | FR-206; approved change: the final 11-item list]
  const items = healthGapItems();
  assert.strictEqual(items.length, 11, "the overview lists " + items.length + " known gaps, expected 11");
  KEY_FORMS.forEach((kf, i) => {
    kf.all.concat(kf.docs).forEach((k) => assertHas(items[i], k, "health gap item " + (i + 1) + " (" + kf.name + ")"));
  });
  assertHas(plain(askPart()), "Its known gaps, and no others:", "gap lead-in");
});

test("health SKILL.md lists no bkt api gap and says why", () => {
  // [A11 | Overview lists the hook and its gaps (AND the text SHALL list no bkt api gap) | spec-skills-health.md | FR-206]
  const items = healthGapItems();
  assert.ok(items.join(" ").indexOf("bkt api") === -1, "a known-gap item names bkt api");
  assertHas(squash(askPart()), "It has no `bkt api` gap, because an unrecognized `bkt api` option asks", "no bkt api gap sentence");
});

test("health SKILL.md says a deny from another hook beats the ask", () => {
  // [A11 | Overview lists the hook and its gaps | spec-skills-health.md; spec-hooks-platform.md "Deny wins over ask" | FR-206, FR-088]
  assertHas(squash(askPart()), "With several PreToolUse hooks, a deny from another hook beats this ask", "deny beats ask");
});

test("health SKILL.md states the prompt behavior by permission mode", () => {
  // [A11 | Overview lists the hook and its gaps | spec-skills-health.md | FR-206]
  const t = squash(askPart());
  assertHas(t, "The ask prompts in default and acceptEdits modes", "mode behavior");
  assertHas(t, "forces a prompt in auto mode", "mode behavior");
  assertHas(t, "in a non-interactive `-p` run with no one to answer, the call is denied", "mode behavior");
});

test("health SKILL.md names three unverified items: bypassPermissions mode, plan mode, and an installed mod", () => {
  // [A11 | Overview lists the hook and its gaps | spec-skills-health.md | FR-206; DECISIONS.md 2026-10-22 unverified modes]
  const t = squash(askPart());
  const at = t.indexOf("Unverified:");
  assert.ok(at >= 0, "no 'Unverified:' sentence");
  const tail = t.slice(at);
  assertHas(tail, "bypassPermissions mode", "unverified");
  assertHas(tail, "plan mode", "unverified");
  assertHas(tail, "whether an installed mod can approve a call the hook would prompt for", "unverified");
});

function findingsRow(needle) {
  const rows = section(HEALTH, "## Findings and fixes")
    .filter((l) => l.trim().charAt(0) === "|")
    .map(splitRow);
  const row = rows.find((cells) => cells[0].indexOf("`pr-post-ask` self-test FAIL") !== -1 && cells[0].indexOf(needle) !== -1);
  assert.ok(row, "no findings row for pr-post-ask with " + needle);
  assert.strictEqual(row.length, 3, "a findings row has three cells: finding, meaning, fix");
  return row;
}

test("health SKILL.md findings row: pr-post-ask known-safe command was ASKED", () => {
  // [A11 | Ask hook disabled by a false ask | spec-skills-health.md | FR-206, FR-118, FR-166]
  const row = findingsRow("known-safe command was ASKED");
  assertHas(squash(row[1]), "auto-disabled", "meaning");
  assertHas(squash(row[1]), "PR posting commands run with no prompt from it", "meaning");
  assertHas(squash(row[1]), "only the calling flow's own confirmation applies", "meaning");
  assertHas(squash(row[2]), "Report the bug (include the report output)", "fix");
  assertHas(squash(row[2]), "run `/assist-plugin:health` again", "fix");
  assertHas(squash(row[2]), "plugin update", "fix");
});

test("health SKILL.md findings row: pr-post-ask known posting command was NOT ASKED", () => {
  // [A11 | Ask hook misses a posting command | spec-skills-health.md | FR-206, FR-118, FR-166]
  const row = findingsRow("known posting command was NOT ASKED");
  assertHas(squash(row[1]), "stays enabled", "meaning");
  assertHas(squash(row[1]), "protection is weak", "meaning");
  assertHas(squash(row[2]), "Report the bug with the report output", "fix");
});

test("health SKILL.md has exactly two pr-post-ask findings rows", () => {
  // [A11 | Ask hook disabled by a false ask; Ask hook misses a posting command | spec-skills-health.md | FR-206]
  const rows = section(HEALTH, "## Findings and fixes").filter((l) => l.trim().charAt(0) === "|" && l.indexOf("`pr-post-ask`") !== -1);
  assert.strictEqual(rows.length, 2);
});

test("health SKILL.md frontmatter description needs no change and still names guard self-tests", () => {
  // [A11 | Health description lists the hook | spec-skills-health.md | FR-166]
  const fm = /^---\n([\s\S]*?)\n---/.exec(HEALTH);
  assert.ok(fm, "no front matter");
  const desc = squash(fm[1]);
  assertHas(desc, "guard, injection-filter, prose-hook, and FSA-hook self-tests", "description");
  assert.ok(desc.indexOf("pr-post-ask") === -1, "the description should not need to name pr-post-ask");
});
