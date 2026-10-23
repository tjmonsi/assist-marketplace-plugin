// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Contract and executed tests for the /do skill after the follow-up to release 1.12.0 (task plan
// steps 9 to 12 and 24): the symlink guards and the unsafe-path outcome, the Bitbucket PR review
// flow in skills/do/references/pr-review-flow.md (classification, host pin, fetch, body-hash check,
// post, hook prompt, status, cleanup), the PR-flow pointers in SKILL.md, and the PR cases in
// plan-format.md. Two tests run commands: the Cloud link check against a stub bkt (bash), and the
// Requirement 15 cleanup command in temporary folders (bash, and zsh when it is installed).
//
// Sources: specs/spec-orchestration-dispatch.md (Change Log 2026-10-22: Requirement 14 modified,
// Requirements 5, 9, and 12 modified, Requirement 15 added), specs/spec-orchestration.md (Change
// Log 2026-10-22: the symlink guard requirement and the Request flow change), the requirements
// FR-195, FR-202, FR-203, FR-206, FR-207, FR-208, FR-063, FR-052, FR-048, FR-032, FR-012, NFR-021
// in docs/requirements/FR-NFR-assist-plugin.md, and DECISIONS.md: the step 1 results (the Cloud
// request-changes call carries no repository flags; the contexts filter is an array form that /do
// counts element by element; --jq prints strings JSON-quoted) and the 2026-10-22 entry "PR file
// cleanup by name" (the cleanup is one glob-free command, the body-hash check runs as its own
// command before bkt pr approve, both forms work in bash and zsh).
//
// Traceability format: [Ax | Scenario title | spec section | FR/NFR ids]. Ax is the acceptance row
// of the task plan docs/task-plans/task-plan-post-1-12-0-followups-20261022-143806.md. The specs
// use named requirement blocks and carry no SPEC-NNN id, so none is cited.
//
// The executed tests need bash (and for the zsh runs, zsh) on PATH. Without the shell they are
// skipped with a reported reason; they never pass silently.
//
// Run: node --test tests/skills/contracts-do-followup.test.js

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

function headingLevel(line) {
  const m = /^(#{1,6})\s/.exec(line);
  return m ? m[1].length : 0;
}

// Lines under `heading` (compared as a trimmed line) up to the next heading of the same or a
// higher level. Headings inside code fences do not count; fence lines are kept.
function sectionIn(lines, heading) {
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

function sectionText(text, heading) {
  const lines = sectionIn(linesOf(text), heading);
  assert.ok(lines.length > 0, "section not found or empty: " + heading);
  return joined(lines);
}

function splitRow(line) {
  let s = line.trim();
  if (s.charAt(0) === "|") s = s.slice(1);
  if (s.charAt(s.length - 1) === "|") s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.trim());
}

function rowOf(text, firstCell) {
  return linesOf(text).find((l) => l.indexOf("| " + firstCell + " |") === 0);
}

function has(text, needle, label) {
  assert.ok(text.indexOf(needle) !== -1, (label || "text does not hold") + ": " + needle);
}

// Fenced code blocks as arrays of trimmed non-empty lines.
function fencedBlocks(text) {
  const blocks = [];
  let fence = null;
  let cur = null;
  linesOf(text).forEach((raw, i) => {
    const open = /^\s*(`{3,}|~{3,})/.exec(raw);
    if (fence) {
      if (open && open[1].charAt(0) === fence.charAt(0) && open[1].length >= fence.length && raw.trim() === open[1]) {
        blocks.push(cur);
        fence = null;
        cur = null;
      } else if (raw.trim() !== "") {
        cur.lines.push(raw.trim());
      }
      return;
    }
    if (open) {
      fence = open[1];
      cur = { n: i + 2, lines: [] };
    }
  });
  return blocks;
}

function fencedLines(text) {
  const out = [];
  fencedBlocks(text).forEach((b) => b.lines.forEach((l) => out.push(l)));
  return out;
}

function walk(dir) {
  let out = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.isFile() && /\.md$/.test(e.name)) out.push(p);
  });
  return out;
}

const DO = read("skills/do/SKILL.md");
const FLOW = read("skills/do/references/pr-review-flow.md");
const PLAN_FORMAT = read("skills/do/references/plan-format.md");
const PRR_SKILL = read("skills/pr-review/SKILL.md");

const CONTEXTS_CMD =
  "bkt auth status --json --jq '[.contexts[]? as $c | .hosts[]? | select(.key == $c.host) | {name: $c.name, kind: .kind, base_url: .base_url}]'";
const REQUEST_CHANGES = "bkt api '/repositories/<ws>/<slug>/pullrequests/<N>/request-changes' --context '<ctx>' --method POST";
const APPROVE_CMD = "bkt pr approve '<N>' --context '<ctx>' <repo flags>";
const BODY_CHECK = "printf '%s  %s\\n' '<hash>' '<root>/.agent/pr-review/pr-<N>-review.body' | sha256sum -c --strict -";
const COMMENT_CMD = BODY_CHECK + " && bkt pr comment '<N>' --context '<ctx>' <repo flags> --text=\"$(cat -- '<root>/.agent/pr-review/pr-<N>-review.body')\"";
const PR_FILES = ["pr-<N>.diff", "pr-<N>.view.full", "pr-<N>.diff.full", "pr-<N>.comments.full", "pr-<N>-review.body"];
const CLEANUP_CMD =
  "( test ! -L '<root>/.agent' && test ! -L '<root>/.agent/pr-review' || exit 3; rm -f -- " +
  PR_FILES.map((f) => "'<root>/.agent/pr-review/" + f + "'").join(" ") +
  " )";

// ---------------------------------------------------------------------------
// Command lines of the flow file, with their 1-based line numbers: lines inside fenced blocks,
// lines that are one code span, and table cells that are one code span starting with a command.
// ---------------------------------------------------------------------------

const CMD_START = /^(gh |bkt |printf |rm -f|test |git |wc |grep |head |sha256sum|shasum|cat |set -o|\()/;

function commandLines(text) {
  const out = [];
  let fence = null;
  linesOf(text).forEach((raw, i) => {
    const n = i + 1;
    const open = /^\s*(`{3,}|~{3,})/.exec(raw);
    if (fence) {
      if (open && open[1].charAt(0) === fence.charAt(0) && open[1].length >= fence.length && raw.trim() === open[1]) fence = null;
      else if (raw.trim() !== "" && raw.trim().charAt(0) !== "#") out.push({ n: n, kind: "fence", text: raw.trim() });
      return;
    }
    if (open) {
      fence = open[1];
      return;
    }
    const t = raw.trim();
    if (/^`[^`]+`$/.test(t)) {
      out.push({ n: n, kind: "span", text: t.slice(1, -1) });
      return;
    }
    if (t.charAt(0) === "|") {
      splitRow(t).forEach((cell) => {
        const m = /^`([^`]+)`$/.exec(cell);
        if (m && CMD_START.test(m[1])) out.push({ n: n, kind: "cell", text: m[1].replace(/\\\|/g, "|") });
      });
    }
  });
  return out;
}

function segments(cmd) {
  return cmd.split(/\s*(?:&&|\|\||\||;)\s*/).filter(Boolean);
}

const CMDS = commandLines(FLOW);

// ---------------------------------------------------------------------------
// A14: Standing rules, Plan, Host and repository, and the classification order
// ---------------------------------------------------------------------------

test("Standing rules: the flow covers github.com and Bitbucket remotes, each bkt post is its own Bash command, PR files are removed after use, and the placeholders include the Bitbucket ones", () => {
  // [A14 | Scenario: Bitbucket Cloud fetch; Bitbucket Data Center returned verdict | spec-orchestration-dispatch.md Requirement 14 | FR-195 | FR-202]
  const s = sectionText(FLOW, "## Standing rules");
  has(s, "- This flow runs `gh` for a `github.com` remote and `bkt` for a Bitbucket remote (Cloud or Data Center) after the host pin. Any other host fails the step with `precondition-failed` and a message that names both options (see Host and repository).");
  has(s, "- Each `bkt` post is its own Bash command. A permission prompt that the user rejects is a declined post, not a failure (see Hook prompt).");
  has(s, "- The PR's files under `<root>/.agent/pr-review/` are removed after use (see Cleanup).");
  has(s, "- `/do` calls no `/pr-review` and needs no Skill tool.");
  const line = linesOf(s).find((l) => l.indexOf("- Placeholders in the commands below:") === 0);
  assert.ok(line, "no placeholders line");
  ["`<N>`", "`<owner>`", "`<repo>`", "`<ws>`", "`<slug>`", "`<KEY>`", "`<ctx>`", "`<ws-lc>`", "`<slug-lc>`", "`<repo flags>`", "`<root>`", "`<tmp>`", "`<hash>`", "`<D>`", "`<V>`"].forEach((p) => has(line, p, "placeholder missing"));
  assert.ok(!/GitHub-only|github\.com. remotes only|in 1\.12\.0/i.test(FLOW), "the flow file still limits itself to GitHub");
});

test("Plan: a PR URL for this repository yields <N> for GitHub, Bitbucket Cloud, and Data Center, /do runs no bkt command at Decompose, and the plan names gh or bkt", () => {
  // [A14 | Scenario: Bitbucket Cloud fetch; Data Center SSH remote matched by a context | spec-orchestration-dispatch.md Requirement 14 Plan | FR-195]
  const p = sectionText(FLOW, "## Plan");
  has(p, "A PR URL for this same repository yields `<N>`: `https://github.com/<owner>/<repo>/pull/<N>`, `https://bitbucket.org/<ws>/<slug>/pull-requests/<N>`, or `https://<host>[/<context-path>]/projects/<KEY>/repos/<slug>/pull-requests/<N>` for a Data Center `origin` on the same host.");
  has(p, "It runs no `bkt` command at Decompose.");
  has(p, "When the step starts with `<N>` unset or not matching `^[0-9]+$`, the step fails with `precondition-failed` and no `gh` or `bkt` command runs.");
  has(p, "the plan names `/do`'s own fetch and post with `gh` for a `github.com` remote or with `bkt` for a Bitbucket remote, decided when the step starts");
  has(p, "Approve covers the fetch; nothing is posted without the later yes.");
});

test("Host and repository: the URL forms, the name pattern, and the four-step classification with tool-missing and precondition-failed as the failure table states", () => {
  // [A14 | Scenario: Data Center SSH remote matched by a context; Bitbucket remote with no matching context; Host that is not supported; Bitbucket CLI absent
  //  | spec-orchestration-dispatch.md Requirement 14 Host and repository | FR-195 | FR-203]
  const h = sectionText(FLOW, "## Host and repository");
  has(h, "strips any `user:password@` or `token@` part after `://`");
  assert.ok(fencedLines(h).indexOf("set -o pipefail; git -C '<root>' remote get-url origin | sed -E 's#^([a-z+]+://)[^/@]*@#\\1#'") !== -1, "the origin read command is missing");
  has(h, "A failed `git remote get-url origin` (no `origin` remote), or a project that is not a git repository, fails the step at start with `precondition-failed`");
  has(h, "GitHub and Bitbucket Cloud forms: `https://<host>/<a>/<b>`, `git@<host>:<a>/<b>`, and `ssh://git@<host>/<a>/<b>` (seen after the strip as `ssh://<host>/<a>/<b>`), with exactly two path segments.");
  has(h, "Bitbucket Data Center forms: `https://<host>[:<port>][/<context-path>]/scm/<KEY>/<slug>.git`, `ssh://git@<host>[:<port>]/<KEY>/<slug>.git` (seen after the strip as `ssh://<host>[:<port>]/<KEY>/<slug>.git`), and `git@<host>:<KEY>/<slug>.git`, with the key and slug taken from the last two path segments.");
  has(h, "A trailing `.git` is removed. Hosts compare without port and without case. Any other form fails the step with `precondition-failed`.");
  has(h, "Name pattern: every name (`<owner>`, `<repo>`, `<ws>`, `<slug>`, `<KEY>`) must match `^[A-Za-z0-9._-]+$`, or the step fails with `precondition-failed` before any `gh` or `bkt` call.");
  has(h, "Classification at step start, in this order:");
  const items = [
    "1. `github.com` selects `gh`.",
    "2. Otherwise, when `bkt --version` shows bitbucket-cli (first line matching `^bkt version v?[0-9]+\\.[0-9]+\\.[0-9]+`), `/do` runs the presence tests and the contexts command of the Bitbucket host pin. A remote whose hostname matches exactly one context is a Bitbucket remote, whatever its host name or URL form.",
    "3. Otherwise a remote on `bitbucket.org`, with `/scm/` in its HTTPS path, or with `bitbucket` in its host is a Bitbucket remote with no matching context. It fails with `tool-missing` when `bkt` is absent or is another tool, and with `precondition-failed` and the setup message (`bkt auth login`, then `bkt context create <name> --host <host> ... --set-active`) when `bkt` is bitbucket-cli.",
    "4. Every other remote fails with `precondition-failed` and a message that names both options: run `/pr-review` directly where the direct run supports the host (for example GitHub Enterprise), or set up a `bkt` context for a Data Center host. No fetch runs and no reviewer starts. `/do` calls no `/pr-review`.",
  ];
  let last = -1;
  items.forEach((s) => {
    const i = h.indexOf(s);
    assert.ok(i !== -1, "classification item missing: " + s);
    assert.ok(i > last, "classification items out of order at: " + s);
    last = i;
  });
  has(h, "Several matching contexts fail the step with `precondition-failed` and the request to leave one.");
  has(h, "Only `bkt --version` and `bkt auth status --json` run before the pin passes.");
  has(h, "Every `gh` call carries `--repo 'github.com/<owner>/<repo>'`");
  has(h, "Every `bkt pr` call carries `--context '<ctx>'` and the repository flags, from the pin and this one URL. The repository flags are `--workspace '<ws>' --repo '<slug>'` on Cloud and `--project '<KEY>' --repo '<slug>'` on Data Center, written `<repo flags>` below. `bkt api` takes no repository flags: its relative path names the repository.");
  has(h, "Every `<N>` is single-quoted.");
});

test("Bitbucket host pin: identity, three presence tests, the contexts array counted element by element, the match rule, the context name, and the link-check exit mapping", () => {
  // [A14 | Scenario: Bitbucket pin fails; Cloud link mismatch and link-check failure; Cloud link differs only in case; Cloud link names another repository
  //  | spec-orchestration-dispatch.md Requirement 14 Bitbucket host pin | FR-203 | FR-202 (DECISIONS.md step 1 V6, V8, V9)]
  const p = sectionText(FLOW, "## Bitbucket host pin");
  has(p, "Each stage that fails ends the step with the class shown, and no later `bkt` call runs.");
  has(p, "1. Identity: `bkt --version`. Its first line must match `^bkt version v?[0-9]+\\.[0-9]+\\.[0-9]+`. A missing `bkt`, or any other output, is `tool-missing` for a recognized Bitbucket remote (Host and repository, case 3).");
  has(p, "2. Presence tests: three commands, each run on its own, each with no output but its exit status.");
  const lines = fencedLines(p);
  const presence = ['test -z "${BKT_TOKEN+x}"', 'test -z "${BKT_HOST+x}"', 'test -z "${BKT_CONFIG_DIR+x}"'];
  presence.forEach((c) => assert.ok(lines.indexOf(c) !== -1, "presence test missing: " + c));
  has(p, "A variable that is set, an empty value included, exits non-zero and fails the step with `precondition-failed`. The message names each set variable and never its value.");
  has(p, "They run before `bkt auth status --json`, because `BKT_CONFIG_DIR` changes which configuration it reads");
  has(p, "3. Contexts: one command whose output holds only context names, kinds, and base URLs, so no secret reaches `/do`'s context:");
  assert.ok(lines.indexOf(CONTEXTS_CMD) !== -1, "the contexts command is missing or differs");
  assert.ok(lines.indexOf(CONTEXTS_CMD) > lines.indexOf(presence[2]), "the contexts command must follow the presence tests");
  has(p, "The filter always prints a JSON array, and bkt pretty-prints it.");
  has(p, "`/do` counts the elements that meet the Match rule below and never compares a raw line.");
  has(p, "An empty array (`[]`) is zero matching contexts, not a tool failure.");
  has(p, "A command that exits with an error fails the step with `tool-failed`.");
  has(p, "4. Match: a `bitbucket.org` remote needs a context of kind `cloud` whose base-URL hostname is `api.bitbucket.org` or `bitbucket.org`. A Data Center remote needs a context whose base-URL hostname equals the remote's host, ports and case ignored. Exactly one match (one element meets the rule) is the chosen context; kind `cloud` means Bitbucket Cloud and any other kind means Data Center. Zero matches take Host and repository, case 3 or 4. Several matches fail with `precondition-failed`.");
  has(p, "5. Context name: the chosen name must match `^[A-Za-z0-9._-]+$`, or the step fails with `precondition-failed`. It is `<ctx>` in every command.");
  has(p, "6. Cloud link check, after the checks above and before the fetch, as one command whose only output is its exit status (Data Center runs none).");
  has(p, "Exit 0 passes. Exit 4 is a link mismatch and fails the step with `policy-rejection`. Exit 3 or any other non-zero exit is a failed `bkt pr view` and fails the step with `tool-failed`. Neither fetches the diff, and no PR text reaches `/do`'s context.");
  has(p, "The received link is lowercased and the expected link holds the lowercase names, so workspace and slug compare without case on both sides.");
  has(p, "The second comparison accepts a JSON-quoted string, because `--jq` prints strings JSON-quoted.");
  has(p, "The case Bitbucket Cloud uses for the workspace and slug in the link is not confirmed.");
});

// ---------------------------------------------------------------------------
// A14: Paths and Fetch
// ---------------------------------------------------------------------------

test("Paths: the Bitbucket temp file pr-<N>.comments.full joins the scratch files, and the file list names all five PR files", () => {
  // [A14, A15 | Scenario: Bitbucket Cloud fetch; After a post | spec-orchestration-dispatch.md Requirement 14 Paths | FR-195 | FR-208]
  const p = sectionText(FLOW, "## Paths");
  has(p, "plus `'<tmp>/pr-<N>.comments.full'` for Bitbucket");
  has(p, "The files of PR `<N>` under `<root>/.agent/pr-review/` are `pr-<N>.diff`, `pr-<N>.view.full`, `pr-<N>.diff.full`, `pr-<N>.comments.full`, and `pr-<N>-review.body`.");
  has(p, "After each `/do` write or removal under `<root>/.agent/pr-review/`, `/do` refreshes the change-check baseline for that path, as it does for the plan file, so no step is blamed for it.");
});

test("Fetch: the Bitbucket chain starts with rm -f --, fetches the diff first, then the view and the comments, each into its own temp file, and every bkt pr call names the context and repository flags", () => {
  // [A14 | Scenario: Bitbucket Cloud fetch; Partial diff after the bkt timeout; Data Center diff may be cut by the server
  //  | spec-orchestration-dispatch.md Requirement 14 Fetch | FR-195 | FR-202 | NFR-014]
  const f = sectionText(FLOW, "## Fetch");
  const row = linesOf(f).find((l) => l.indexOf("| Bitbucket |") === 0);
  assert.ok(row, "no Bitbucket row in the fetch table");
  const m = /`([^`]+)`/.exec(splitRow(row)[1]);
  assert.ok(m, "the Bitbucket row holds no command");
  const segs = m[1].split(" && ");
  assert.strictEqual(segs.length, 4, "expected rm, diff, view, comments joined with &&: " + m[1]);
  assert.strictEqual(segs[0], "rm -f -- '<tmp>/pr-<N>.diff.full' '<tmp>/pr-<N>.view.full' '<tmp>/pr-<N>.comments.full'");
  assert.strictEqual(segs[1], "bkt pr diff '<N>' --context '<ctx>' <repo flags> > '<tmp>/pr-<N>.diff.full'");
  assert.strictEqual(segs[2], "bkt pr view '<N>' --context '<ctx>' <repo flags> --json > '<tmp>/pr-<N>.view.full'");
  assert.strictEqual(segs[3], "bkt pr comments '<N>' --context '<ctx>' <repo flags> --json > '<tmp>/pr-<N>.comments.full'");
  const gh = linesOf(f).find((l) => l.indexOf("| `github.com` |") === 0);
  assert.ok(gh && /gh pr diff/.test(gh) && /gh pr view/.test(gh), "the GitHub row is gone");
  has(f, "On Bitbucket the diff comes first, so a `bkt pr diff` that exits 1 after its 15-second timeout stops the chain and its partial file is never trusted: the step fails with `tool-failed` and no reviewer starts.");
  has(f, "On Bitbucket, `wc -c` on the view file gives `<V>`.");
  has(f, "On Data Center the server may have cut the diff at its line cap; the confirmation says so (see Confirm).");
  has(f, "`/do` records in the step's Done field the diff's own byte count, how much of the diff and of the rest was cut, and the full size of each temp file (`wc -c` on each).");
});

test("Fetch: two GitHub scratch-file variants chosen by <D> and three Bitbucket variants chosen by <D> and <V>, each starting with rm -f -- and ending with the hash tool", () => {
  // [A14 | Scenario: Bitbucket Cloud fetch; Fetch cap | spec-orchestration-dispatch.md Requirement 14 Fetch | FR-195 | NFR-014]
  const f = sectionText(FLOW, "## Fetch");
  has(f, "GitHub, when `<D>` is under 204,800:");
  has(f, "GitHub, otherwise the diff alone fills the cap and there is no second `head`:");
  has(f, "Bitbucket, when `<D>` is at least 204,800: the diff alone, with the same command as the GitHub case above.");
  has(f, "Bitbucket, when `<D>` + `<V>` is at least 204,800: the diff and the first `204800 - <D>` bytes of the view:");
  has(f, "Bitbucket, otherwise the diff, the view, and the first `204800 - <D> - <V>` bytes of the comments:");
  has(f, "The hash tool runs on the finished file in the same Bash command, so the hash `/do` keeps is taken where the file is written.");
  const scratch = "'<root>/.agent/pr-review/pr-<N>.diff'";
  const blocks = fencedBlocks(f).filter((b) => b.lines.some((l) => l.indexOf("head -c 204800") !== -1));
  assert.ok(blocks.length >= 4, "expected at least four scratch-file blocks (two for GitHub, two more for Bitbucket), found " + blocks.length);
  const cmds = blocks.map((b) => b.lines.join(" "));
  cmds.forEach((c) => {
    const segs = segments(c);
    assert.ok(segs[0].indexOf("rm -f -- " + scratch) === 0, "a block does not start with rm -f -- of the scratch file: " + c);
    assert.ok(/^(sha256sum|shasum -a 256)\b/.test(segs[segs.length - 1]), "a block does not end with the hash tool: " + c);
    assert.ok(c.indexOf("> " + scratch) !== -1, "a block does not write the scratch file: " + c);
  });
  const diffOnly = cmds.filter((c) => c.indexOf("$((204800") === -1);
  const withView = cmds.filter((c) => c.indexOf("head -c $((204800 - <D>))") !== -1);
  const withComments = cmds.filter((c) => c.indexOf("head -c $((204800 - <D> - <V>))") !== -1);
  assert.ok(diffOnly.length >= 1, "no diff-only variant");
  assert.ok(withView.length >= 1, "no diff-plus-view variant");
  assert.strictEqual(withComments.length, 1, "expected one diff, view, and comments variant");
  withView.forEach((c) => {
    assert.ok(c.indexOf("'<tmp>/pr-<N>.view.full' >> " + scratch) !== -1, "the view is not appended: " + c);
  });
  const all3 = withComments[0];
  assert.ok(all3.indexOf("'<tmp>/pr-<N>.view.full' >> " + scratch) !== -1, "the view is not appended in the three-file variant");
  assert.ok(all3.indexOf("-- '<tmp>/pr-<N>.comments.full' >> " + scratch) !== -1, "the comments are not appended in the three-file variant");
  assert.ok(all3.indexOf(".diff.full") < all3.indexOf(".view.full") && all3.indexOf(".view.full") < all3.indexOf(".comments.full"), "the order is not diff, view, comments");
});

// ---------------------------------------------------------------------------
// A14: Tamper check, Confirm, Post, Hook prompt
// ---------------------------------------------------------------------------

test("Tamper check: a separate body check runs before bkt pr approve, the comment command keeps its own check, approve and the request-changes call carry no body, and a forgotten body hash fails before the body check", () => {
  // [A14 | Scenario: Body hash forgotten before a Bitbucket approval; Bitbucket approved verdict; Approval stands when the comment fails
  //  | spec-orchestration-dispatch.md Requirement 14 Tamper check (DECISIONS.md 2026-10-22 "PR file cleanup by name") | FR-195 | NFR-014]
  const t = sectionText(FLOW, "## Tamper check");
  has(t, "- The body file is checked in the same command as the post: the `gh` post on GitHub, and the `bkt pr comment` command on Bitbucket (Post). On Bitbucket `bkt pr approve` and the request-changes call carry no body; for an `approved` verdict a separate body check runs as its own command before `bkt pr approve`, so a changed body stops the post before the approval.");
  has(t, "A body-file hash `/do` cannot recall before the post fails the step with `policy-rejection`, and no post command runs. On Bitbucket this holds before the body check that precedes `bkt pr approve`, so no approval is posted without its comment.");
  has(t, "A mismatch at any check fails the step with `policy-rejection`, and nothing more is posted.");
  const post = fencedLines(sectionText(FLOW, "## Post"));
  assert.ok(post.indexOf(BODY_CHECK) !== -1, "the separate Bitbucket body check is missing or differs");
  assert.ok(post.indexOf(APPROVE_CMD) !== -1, "the Bitbucket approve command is missing or differs");
  assert.ok(post.indexOf(COMMENT_CMD) !== -1, "the Bitbucket comment command is missing or differs");
  assert.ok(post.indexOf(REQUEST_CHANGES) !== -1, "the Cloud request-changes call is missing or differs");
  assert.ok(post.indexOf(BODY_CHECK) < post.indexOf(APPROVE_CMD), "the body check must come before bkt pr approve");
  assert.ok(post.indexOf(APPROVE_CMD) < post.indexOf(COMMENT_CMD), "the approve command must come before the comment command");
  assert.strictEqual(post.filter((l) => l === BODY_CHECK).length, 1, "the separate body check must be its own command, once");
  const comment = segments(COMMENT_CMD);
  assert.ok(/^printf\b/.test(comment[0]) && /^sha256sum -c --strict -$/.test(comment[1]) && /^bkt pr comment\b/.test(comment[2]), "the comment command must keep its own hash check ahead of bkt pr comment");
  [APPROVE_CMD, REQUEST_CHANGES].forEach((c) => {
    assert.ok(!/review\.body|--text|printf|sha256sum/.test(c), "a command that carries no body holds a body or a hash check: " + c);
  });
});

test("Confirm: the Bitbucket labels, the Data Center notice, and the line that a permission prompt may follow for each posting command", () => {
  // [A14 | Scenario: Data Center diff may be cut by the server; Bitbucket approved verdict; Bitbucket Cloud returned verdict; Bitbucket Data Center returned verdict
  //  | spec-orchestration-dispatch.md Requirement 14 Confirm | FR-195 | FR-206]
  const c = sectionText(FLOW, "## Confirm");
  has(c, "the target repository (`owner/repo` on GitHub, `workspace/slug` on Cloud, `KEY/slug` on Data Center), the PR number, and the block's verdict");
  has(c, "on Data Center, that the server may have cut the diff at its line cap and that the review covers the text received");
  has(c, "that a Claude Code permission prompt may follow for each posting command");
  has(c, "`approved`: approve (`bkt pr approve`), then comment (`bkt pr comment`).");
  has(c, "`returned` on Cloud: comment (`bkt pr comment`), then request changes (`bkt api ... request-changes`).");
  has(c, "`returned` on Data Center: comment (`bkt pr comment`); the PR stays open");
  has(c, "| Post as a comment | comment (`--comment`) | comment (`bkt pr comment`) |");
  has(c, "One AskUserQuestion call, with no option marked Recommended");
});

test("Post: the Bitbucket post table starts an approved verdict with the body check, one Bash command per post, a mismatch posts nothing, no request-changes call before the comment, no absolute URL, and the two-command outcome table", () => {
  // [A14 | Scenario: Bitbucket approved verdict; Bitbucket Cloud returned verdict; Bitbucket Data Center returned verdict; Cloud comment fails under /do;
  //  Request-changes call fails after the comment; Approval stands when the comment fails; Body hash forgotten before a Bitbucket approval
  //  | spec-orchestration-dispatch.md Requirement 14 Post | FR-195 | FR-202]
  const p = sectionText(FLOW, "## Post");
  has(p, "On Bitbucket it runs the commands of the Bitbucket post table, each as its own Bash command, in order, and stops at the first failure or rejection.");
  has(p, "Bitbucket body check, its own command, run before `bkt pr approve` so a body file changed after the confirmation stops the post before any approval (a mismatch fails the step with `policy-rejection` and nothing is posted):");
  has(p, "Bitbucket comment command, which repeats the body check ahead of the post and reads the body from the file:");
  [
    "| `approved`, post the verdict | the body check, then the approve command, then the comment command |",
    "| `returned` on Cloud, post the verdict | the comment command, then the request-changes call |",
    "| `returned` on Data Center, post the verdict | the comment command; the PR stays open and no `bkt api` call runs |",
    "| Either verdict, post as a comment | the comment command |",
  ].forEach((r) => has(p, r, "post table row missing"));
  has(p, "On an `approved` verdict the body check runs before the first row applies: a mismatch there fails the step with `policy-rejection`, runs neither the approve nor the comment command, and posts nothing. The body check is not a posting command and raises no hook prompt.");
  has(p, "The request-changes call never runs before the comment is posted. When the comment fails, is declined, or fails its body check, `/do` makes no request-changes call. `/do` passes `bkt api` no absolute URL.");
  has(p, "A failed `bkt` post is not retried. `/do` shows the draft and the error, and states which command stands.");
  has(p, "Bitbucket Cloud request-changes call, which names the repository through its relative path and carries no repository flags:");
  [
    "| Declined at the prompt | Not run | `completed` | Both declined |",
    "| Posted | Declined at the prompt | `completed` | First posted, second declined |",
    "| Posted | Posted | `completed` | Both posted |",
    "| Failed | Not run | `failed`, `tool-failed` | First failed |",
    "| Posted | Failed | `failed`, `tool-failed` | First posted and stands (an approval stands; a comment is not deleted) |",
    "| Posted | Body-hash mismatch in the comment command | `failed`, `policy-rejection` | Approval posted and stands; comment not posted |",
  ].forEach((r) => has(p, r, "outcome table row missing"));
  // Each bkt post is its own command line: no command line joins two posting commands.
  CMDS.forEach((e) => {
    const posts = e.text.match(/\bbkt (?:pr approve|pr comment|api)\b/g) || [];
    assert.ok(posts.length <= 1, "line " + e.n + ": a command line joins " + posts.length + " bkt posting commands: " + e.text);
  });
  const calls = CMDS.filter((e) => /^bkt api\b/.test(e.text));
  assert.strictEqual(calls.length, 1, "expected exactly one bkt api command line");
  assert.strictEqual(calls[0].text, REQUEST_CHANGES);
  assert.ok(!/--(?:workspace|project|repo)\b/.test(calls[0].text), "the request-changes call carries repository flags");
});

test("Hook prompt: a Bash result with no command exit status is a declined post, which is recorded, never retried, not a tool-failed, and settles the step completed", () => {
  // [A14, A15 | Scenario: User rejects the hook prompt; First prompt of the Bitbucket approve-then-comment pair rejected; Second prompt of the Bitbucket pair rejected;
  //  Cloud comment prompt rejected; Cloud request-changes prompt rejected after the comment; Post declined at the hook prompt
  //  | spec-orchestration-dispatch.md Requirement 14 Hook prompt; Requirement 5 | FR-195 | FR-206 | FR-048]
  const h = sectionText(FLOW, "## Hook prompt");
  has(h, "A Bash result that reports that the user did not allow the call, with no exit status of the command, counts as declined.");
  has(h, "a result that carries a command exit status is a command failure, not a decline");
  has(h, "- records it, runs no later post command of the step, and never retries;");
  has(h, "- reports no `tool-failed`;");
  has(h, "- settles the step `completed` and removes the PR's files (Cleanup).");
  has(h, "A rejected first prompt of a pair runs no second command and records both as declined. A rejected second prompt records the first as posted and the second as declined. On Cloud, an allowed comment followed by a rejected request-changes prompt records the comment as posted and the request as declined.");
  has(h, "A hook that is disabled or fails open shows no prompt, and the post runs after `/do`'s own confirmation.");
});

// ---------------------------------------------------------------------------
// A14, A15: Status, Failures, Record
// ---------------------------------------------------------------------------

test("Status: completed after every post command ran, a declined post, or a do-not-post answer; failed on a fetch, link-check, or post error; the transition rows carry the Bitbucket causes", () => {
  // [A14, A15 | Scenario: Declined post completes the step; Dependent of a failed Bitbucket fetch | spec-orchestration-dispatch.md Requirements 14 and 5 | FR-195 | FR-048 | FR-052]
  const s = sectionText(FLOW, "## Status");
  has(s, "It becomes `completed` after every post command of the step ran, after a post the user declined at the hook prompt, or after a \"do not post\" answer, and `failed` on a fetch, link-check, or post error, or a hash mismatch.");
  const rows = linesOf(s).filter((l) => /^\| `(pending|in_progress|waiting-user)` \|/.test(l));
  assert.strictEqual(rows.length, 6, "the transitions table has six rows");
  const failed = rows.find((r) => /^\| `in_progress` \| `failed` \|/.test(r));
  assert.ok(failed, "in_progress to failed row missing");
  ["(`tool-missing`)", "a remote that is neither `github.com` nor a Bitbucket remote", "a set `BKT_TOKEN`, `BKT_HOST`, or `BKT_CONFIG_DIR`", "no matching context, several matching contexts", "a Cloud link mismatch (`policy-rejection`)", "a failed link-check view", "(`tool-failed`)"].forEach((x) => has(failed, x, "in_progress to failed row"));
  const done = rows.find((r) => /^\| `waiting-user` \| `completed` \|/.test(r));
  assert.ok(done && done.indexOf("a post declined at the hook prompt") !== -1 && done.indexOf("a \"do not post\" answer") !== -1, "waiting-user to completed row lacks the declined case");
  const wf = rows.find((r) => /^\| `waiting-user` \| `failed` \|/.test(r));
  assert.ok(wf && wf.indexOf("A `gh` or `bkt` post error (`tool-failed`)") !== -1 && wf.indexOf("(`policy-rejection`)") !== -1, "waiting-user to failed row lacks the bkt post error");
});

test("Failures: the Bitbucket failure table maps each cause to its error class, and a declined post is not a failure", () => {
  // [A14, A15 | Scenario: Bitbucket CLI absent; Bitbucket pin fails; Cloud link mismatch and link-check failure; Partial diff after the bkt timeout; Dependent of a failed Bitbucket fetch
  //  | spec-orchestration-dispatch.md Requirements 14 and 9 | FR-195 | FR-203 | FR-052]
  const f = sectionText(FLOW, "## Failures");
  has(f, "Dependents of a failed step are `skipped` (\"Skipped: depends on failed step N\"). A post declined at the hook prompt is not a failure.");
  const rows = linesOf(f).filter((l) => l.charAt(0) === "|").map(splitRow);
  const cls = (start) => {
    const r = rows.find((c) => c[0].indexOf(start) === 0);
    assert.ok(r, "no failure row starts with: " + start);
    return r;
  };
  assert.strictEqual(cls("`gh` absent on a `github.com` remote")[1], "`tool-missing`");
  assert.strictEqual(cls("A recognized Bitbucket remote and `bkt` absent or another tool")[1], "`tool-missing`");
  assert.strictEqual(cls("`BKT_TOKEN`, `BKT_HOST`, or `BKT_CONFIG_DIR` set (empty included)")[1], "`precondition-failed`");
  const other = cls("A remote that is neither `github.com` nor a Bitbucket remote by the classification");
  assert.strictEqual(other[1], "`precondition-failed`");
  assert.ok(other[2].indexOf("names both options") !== -1, "the message must name both options");
  assert.strictEqual(cls("A Cloud link mismatch (link-check exit 4)")[1], "`policy-rejection`");
  assert.strictEqual(cls("A failed link-check view (exit 3 or another non-zero exit)")[1], "`tool-failed`");
  assert.strictEqual(cls("A fetch command that exits with an error (a partial diff included)")[1], "`tool-failed`");
  assert.strictEqual(cls("A `gh` or `bkt` post that exits with an error")[1], "`tool-failed`");
  assert.strictEqual(cls("A hash mismatch on the scratch file or the body file")[1], "`policy-rejection`");
});

test("Record: the Done field records posted, declined at the hook prompt, failed, or not run for each post command", () => {
  // [A14, A15 | Scenario: User rejects the hook prompt; Second prompt of the Bitbucket pair rejected | spec-orchestration-dispatch.md Requirement 14 Record | FR-195 | FR-206]
  const r = sectionText(FLOW, "## Record");
  has(r, "the result of each post command: `posted`, `declined at the hook prompt`, `failed`, or `not run`, for example `approve: posted; comment: declined at the hook prompt`.");
  has(r, "A \"do not post\" answer records that the draft was not posted.");
});

// ---------------------------------------------------------------------------
// A15: the Cleanup section, static
// ---------------------------------------------------------------------------

test("Cleanup section: one glob-free subshell with the symlink guard (exit 3) and rm -f -- of the five PR files by exact single-quoted path, plus the exit-code and baseline rules", () => {
  // [A15 | Scenario: After a post; PR 12 and PR 123; After a do-not-post answer; Post declined at the hook prompt; Symlinked folder; No step is blamed for the removal
  //  | spec-orchestration-dispatch.md Requirement 15 (DECISIONS.md 2026-10-22 "PR file cleanup by name") | FR-208 | FR-207 | FR-195]
  const c = sectionText(FLOW, "## Cleanup");
  has(c, "`/do` removes the files of PR `<N>` under `<root>/.agent/pr-review/` right after a PR review step settles `completed`: its post commands ran, a post was declined at the hook prompt, or the user answered \"do not post\". It removes nothing through a symlinked folder. One Bash command holds the symlink guard and the removal by exact name, with no glob, so it behaves the same in bash and zsh:");
  const blocks = fencedBlocks(c);
  assert.strictEqual(blocks.length, 1, "expected one command block in the Cleanup section, found " + blocks.length);
  assert.strictEqual(blocks[0].lines.length, 1, "the Cleanup command must be one line");
  const cmd = blocks[0].lines[0];
  assert.strictEqual(cmd, CLEANUP_CMD, "the Cleanup command differs from the decided form");
  assert.ok(cmd.indexOf("*") === -1 && cmd.indexOf("?") === -1 && !/\[[^\]]*\]\s*$/.test(cmd), "the Cleanup command holds a glob character");
  PR_FILES.forEach((f) => assert.strictEqual(cmd.split("'<root>/.agent/pr-review/" + f + "'").length - 1, 1, "the file " + f + " must be named exactly once, single-quoted"));
  assert.strictEqual((cmd.match(/pr-<N>/g) || []).length, 5, "the command must name exactly the five PR files");
  assert.ok(cmd.indexOf("|| exit 3;") < cmd.indexOf("rm -f --"), "the guard (exit 3) must come before the removal");
  has(c, "- Exit 0: the guard passed and `rm -f` ran. A file already gone is not an error, so the exit stays 0. The cleanup report line is `PR files removed: PR <N>`.");
  has(c, "- Exit 3: `<root>/.agent` or `<root>/.agent/pr-review` is a symlink. Nothing was removed. `/do` reports the symlink (`PR files kept: <root>/.agent/pr-review is a symlink`) and the step stays `completed`.");
  has(c, "- Any other non-zero exit: `rm` failed. `/do` reports the error and the step stays `completed`.");
  has(c, "- `<root>` is quoted by the Quoting rule. `<N>` matches `^[0-9]+$` and each path is single-quoted, so the command names only the five files of that PR and never matches another PR number: PR 12 leaves `pr-123.diff` and `pr-123-review.body`, and PR 123 leaves `pr-1234.diff`.");
  has(c, "- For each path `/do` wrote for that step, it then refreshes the change-check status line and drops the path's hash from the baseline, as after a write, so no step is blamed for the removed paths.");
  has(c, "- Temp files in the session scratchpad sit outside `<root>/.agent` and are not removed here.");
  has(c, "- A failed step, and a step a stop returned to `pending`, keep their files until the Cleanup sweep of [SKILL.md](../SKILL.md#cleanup), which runs this command for every PR review step of the plan whose `<N>` is set, whatever its Status. A symlink found by the removal or the sweep changes no terminal.");
});

// ---------------------------------------------------------------------------
// A14: structural checks over every command line of the flow file
// ---------------------------------------------------------------------------

test("every gh pr diff, gh pr view, and gh pr review command still carries --repo 'github.com/<owner>/<repo>', and no other gh command appears", () => {
  // [A14 | Scenario: GitHub flow unchanged (GH_HOST does not redirect the post; Repository pinned with two remotes) | spec-orchestration-dispatch.md Requirement 14 Host and repository | FR-195]
  const segs = [];
  CMDS.forEach((e) => segments(e.text).forEach((s) => segs.push({ e: e, s: s })));
  const gh = segs.filter((x) => /^gh /.test(x.s));
  assert.ok(gh.filter((x) => /^gh pr diff\b/.test(x.s)).length >= 1, "no gh pr diff command");
  assert.ok(gh.filter((x) => /^gh pr view\b/.test(x.s)).length >= 1, "no gh pr view command");
  assert.ok(gh.filter((x) => /^gh pr review\b/.test(x.s)).length >= 4, "expected the three mapped posts and the combined post");
  const bad = gh.filter((x) => !/^gh pr (diff|view|review)\b/.test(x.s) || x.s.indexOf("--repo 'github.com/<owner>/<repo>'") === -1).map((x) => "line " + x.e.n + ": " + x.s);
  assert.deepStrictEqual(bad, [], "gh command without the host-qualified --repo, or an unexpected gh command:\n" + bad.join("\n"));
});

test("every bkt pr and bkt api command names --context '<ctx>'; bkt pr names the repository flags; the Cloud request-changes call names none (V4: bkt api takes a relative path)", () => {
  // [A14 | Scenario: Bitbucket Cloud fetch; Bitbucket Cloud returned verdict | spec-orchestration-dispatch.md Requirement 14 Host and repository | FR-195 | FR-202 | FR-203 (DECISIONS.md step 1 V4)]
  const inv = [];
  CMDS.forEach((e) => (e.text.match(/\bbkt (?:pr|api)\b[^&|;)]*/g) || []).forEach((x) => inv.push({ n: e.n, inv: x.trim() })));
  assert.ok(inv.length >= 7, "expected the link check, the three fetches, approve, comment, and the api call; found " + inv.length);
  inv.forEach((x) => {
    assert.ok(x.inv.indexOf("--context '<ctx>'") !== -1, "line " + x.n + ": no --context '<ctx>': " + x.inv);
    if (/^bkt pr\b/.test(x.inv)) {
      const ok = x.inv.indexOf("<repo flags>") !== -1 || (x.inv.indexOf("--workspace '<ws>'") !== -1 && x.inv.indexOf("--repo '<slug>'") !== -1);
      assert.ok(ok, "line " + x.n + ": a bkt pr command without the repository flags: " + x.inv);
    }
    if (/^bkt api\b/.test(x.inv)) {
      assert.ok(!/--(?:workspace|project|repo)\b/.test(x.inv), "line " + x.n + ": bkt api carries repository flags: " + x.inv);
      assert.ok(/^bkt api '\/repositories\//.test(x.inv), "line " + x.n + ": bkt api path is not a relative /repositories/ path: " + x.inv);
    }
  });
  // The only bkt commands that carry no --context are the two that run before the pin passes.
  const other = [];
  CMDS.forEach((e) =>
    segments(e.text).forEach((s) => {
      if (/^bkt\b/.test(s) && !/^bkt (?:pr|api)\b/.test(s) && !/^bkt (?:--version|auth status --json)\b/.test(s)) other.push("line " + e.n + ": " + s);
    })
  );
  assert.deepStrictEqual(other, [], "an unexpected bkt command:\n" + other.join("\n"));
});

// ---------------------------------------------------------------------------
// A13: SKILL.md States rows, terminal row, and the symlink guards
// ---------------------------------------------------------------------------

const UNSAFE = "`unsafe-path` (the plan-file or snapshot guard found a symlink) -> Error(policy-rejection)";

test("States table: the seven rows Ingest, Branch, PlanApproval, Preflight, Dispatch, DocSignOff, and Cleanup each carry the unsafe-path outcome to Error(policy-rejection), and no other row does", () => {
  // [A13 | Scenario: Symlinked .agent at Branch; Cancel with a symlinked plan folder; Plan-invalid error with a symlinked plan file; Symlinked snapshot folder without a scratchpad
  //  | spec-orchestration.md Request flow and the symlink guard requirement | FR-207 | FR-012 | NFR-021]
  ["Ingest", "Branch", "PlanApproval", "Preflight", "Dispatch", "DocSignOff", "Cleanup"].forEach((name) => {
    const row = rowOf(DO, name);
    assert.ok(row, name + " row missing");
    const cells = splitRow(row);
    assert.ok(cells[3].indexOf(UNSAFE) !== -1, name + " row lacks the unsafe-path outcome: " + cells[3]);
  });
  const states = sectionText(DO, "## States");
  const withOutcome = linesOf(states).filter((l) => l.charAt(0) === "|" && l.indexOf("unsafe-path") !== -1);
  assert.strictEqual(withOutcome.length, 7, "expected exactly seven States rows with unsafe-path, found " + withOutcome.length);
  has(splitRow(rowOf(DO, "Ingest"))[2], "For `resume`, the plan-file guard runs before the step Status reset (see Symlink guards)");
  has(splitRow(rowOf(DO, "Branch"))[2], "Run the plan-file guard (see Symlink guards), then write the plan file");
});

test("Cleanup row: unsafe-path comes first, ahead of stopped, some-failed-or-skipped, and all-completed, and the row sweeps the PR files", () => {
  // [A13, A15 | Scenario: Plan-invalid error with a symlinked plan file; Symlinked PR folder at Cleanup | spec-orchestration.md; spec-orchestration-dispatch.md Requirement 12 | FR-207 | FR-208 | FR-063]
  const cells = splitRow(rowOf(DO, "Cleanup"));
  const o = cells[3];
  const order = ["`unsafe-path` (", "`stopped` (", "`some-failed-or-skipped` (", "`all-completed` ("].map((s) => o.indexOf(s));
  order.forEach((i, k) => assert.ok(i !== -1 && (k === 0 || i > order[k - 1]), "Cleanup outcomes out of order: " + o));
  assert.strictEqual(order[0], 0, "unsafe-path must be the first outcome");
  has(cells[2], "sweep the files of the plan's PR review steps (see Cleanup)");
  has(cells[2], "Test in this order and take the first match");
});

test("terminal row: the two sentences about the symlink guard are present verbatim", () => {
  // [A13 | Scenario: Guard Error writes no Status; Cancel with a symlinked plan folder | spec-orchestration.md Request flow | FR-207 | FR-012]
  const cells = splitRow(rowOf(DO, "Complete, Partial, Paused, Cancelled, Error"));
  has(cells[2], "An `Error(policy-rejection)` raised by the plan-file or snapshot symlink guard writes no Status to any plan file and is shown in the reply only.");
  has(cells[2], "A terminal whose Status write the plan-file guard blocks is reported as `Error(policy-rejection)` with no Status written.");
});

test("Symlink guards: the plan-file and snapshot guard commands, where each runs, no rm -f of the plan file, and what a non-zero exit does", () => {
  // [A13 | Scenario: Symlinked .agent at Branch; Plan file edited in place; Plan file is a symlink; Symlinked snapshot folder without a scratchpad; Snapshots in the scratchpad;
  //  Planted file at a snapshot target; Plain folders; Guard Error writes no Status | spec-orchestration.md the symlink guard requirement | FR-207 | FR-032 | NFR-021]
  const g = sectionText(DO, "### Symlink guards");
  const lines = fencedLines(g);
  assert.ok(lines.indexOf("test ! -L '<root>/.agent' && test ! -L '<root>/.agent/main-plan' && test ! -L '<plan path>'") !== -1, "the plan-file guard command is missing or differs");
  assert.ok(lines.indexOf("test ! -L '<root>/.agent' && test ! -L '<root>/.agent/change-check'") !== -1, "the snapshot guard command is missing or differs");
  has(g, "`/do` guards each write it makes under `<root>/.agent/` against a symlink.");
  has(g, "Each guard is one Bash command on its own, run just before the write.");
  has(g, "Plan-file guard, before every plan-file Write or Edit (Branch; a `resume` at Ingest; PlanApproval; Preflight; Dispatch; DocSignOff; Cleanup; and a terminal Status):");
  has(g, "`/do` edits the plan file in place and never runs `rm -f` on it.");
  has(g, "Snapshot guard, only when the session has no scratchpad directory, so snapshots go to `'<root>/.agent/change-check/'`:");
  has(g, "The command that then writes a snapshot file starts its `&&` chain with `rm -f --` of that file, so a planted link at the target is never followed. Snapshots in the scratchpad get no guard: they sit outside `<root>/.agent`.");
  has(g, "`test ! -L` on a path that does not exist exits 0, so a first write into a missing folder proceeds and the folder is created as before; the guards add no `mkdir`.");
  has(g, "A non-zero exit means a symlink, because `test` has no other failure for these operands.");
  has(g, "`/do` writes nothing, writes no Status to any plan file, and ends in `Error(policy-rejection)` at the state that tried the write. The reply alone names the symlinked path and the state.");
  has(g, "In Dispatch, `/do` sends no new dispatch and no SendMessage, names the steps still running in the reply, and ends.");
  has(g, "A terminal Status write that the plan-file guard blocks is reported as `Error(policy-rejection)` in place of the terminal it was about to write, with no Status written. That covers `Complete`, `Partial`, and `Paused` from Cleanup, `Cancelled` from the PlanApproval cancel and the Preflight stop, and an `Error` of another class, the `Error(plan-invalid)` rows included.");
  has(g, "A non-zero plan-file or snapshot guard exit takes this outcome ahead of every other outcome of the state, `resume` at Ingest and the terminal choices at Cleanup included.");
  has(g, "Only the plan-file and snapshot guards raise this Error. A symlink found by the PR-file guard fails only the PR step (see [references/pr-review-flow.md](references/pr-review-flow.md)), and one found by the Cleanup sweep or the removal after a post changes no terminal.");
  // /do text names no rm -f of the plan file: each rm -f mention concerns a snapshot file, a PR file, or says never.
  linesOf(DO).forEach((l, i) => {
    if (l.indexOf("rm -f") !== -1) assert.ok(/snapshot|never|that file|PR review/i.test(l), "SKILL.md:" + (i + 1) + ": an rm -f mention that is not about a snapshot or PR file: " + l.slice(0, 140));
  });
  assert.ok(fencedLines(DO).every((l) => !/^rm\b/.test(l)), "a fenced rm command in SKILL.md");
});

test("the guards sit at the states that write: Branch path, resume, Dispatch, the Done update, Preflight snapshots, and the Cleanup outcome", () => {
  // [A13 | Scenario: Symlinked .agent at Branch; Plan file edited in place; Symlinked snapshot folder without a scratchpad | spec-orchestration.md Request flow | FR-207 | FR-032]
  has(DO, "Branch writes the plan file at `<root>/.agent/main-plan/plan-[slug]-[timestamp].md` using [references/plan-format.md](references/plan-format.md)");
  has(DO, "On `resume`, run the plan-file guard (see Symlink guards), then set every step still `in_progress` or `waiting-user` back to `pending`");
  has(DO, "Run the plan-file guard (see Symlink guards) before each plan-file Edit, then use the Edit tool to set each step **Status** to `in_progress` when it starts.");
  has(DO, "Run the plan-file guard, then update the plan file before proceeding.");
  has(DO, "Without a scratchpad directory, run the snapshot guard (see Symlink guards) before each snapshot write.");
  has(DO, "start the write command's `&&` chain with `rm -f --` of the snapshot file");
  const c = sectionText(DO, "## Cleanup");
  has(c, "5. Run the plan-file guard (see Symlink guards), then add the cleanup outcome to the plan file.");
  has(c, "A non-zero plan-file guard exit takes `Error(policy-rejection)` before any of these (see Symlink guards):");
});

// ---------------------------------------------------------------------------
// A14, A15: SKILL.md PR-flow pointers and the Cleanup sweep
// ---------------------------------------------------------------------------

test("SKILL.md PR-flow pointers name both hosts: Decompose, the plan line, Dispatch, the Done bullet, Failed steps, and Constraints", () => {
  // [A14 | Scenario: Host that is not supported; Bitbucket remote (ORCH); Declined post completes the step | spec-orchestration-dispatch.md Requirement 14; Requirement 5; Requirement 9 | FR-195 | FR-048 | FR-052]
  const dec = sectionText(DO, "### PR review requests");
  has(dec, "The flow supports `github.com` remotes with `gh` and Bitbucket remotes with `bkt` after the host pin; `/do` runs no `bkt` command at Decompose. Any other host fails the step at start with `precondition-failed` and a message that names both options.");
  const plan = linesOf(sectionText(DO, "### Show the plan in chat")).find((l) => l.indexOf("- For a PR review step:") === 0);
  assert.ok(plan, "no PR review line under the Order line");
  has(plan, "`/do`'s own fetch and post with `gh` for a `github.com` remote or with `bkt` for a Bitbucket remote after the host pin, decided when the step starts. Any other host fails with `precondition-failed` and a message that names both options. Approve covers the fetch; nothing is posted without the later confirmation.");
  const dispatch = sectionText(DO, "## Dispatch");
  has(dispatch, "A PR review step follows [references/pr-review-flow.md](references/pr-review-flow.md): `/do` classifies the `origin` (the classification order is in that file), fetches with `gh` for a `github.com` remote or with `bkt` for a Bitbucket remote after the host pin, hands the scratch file to the `reviewer`, asks the user once, and posts the confirmed draft itself, each `bkt` post as its own Bash command.");
  const done = linesOf(DO).find((l) => l.indexOf("- **Done:**") === 0);
  assert.ok(done, "Done bullet missing");
  has(done, "becomes `completed` only after a successful post, a post the user declined at the hook prompt, or a \"do not post\" answer");
  const failed = sectionText(DO, "### Failed steps (decision D3)");
  has(failed, "including a missing `gh` or `bkt`, a host that is neither `github.com` nor a Bitbucket remote by that file's classification (`precondition-failed`), the Bitbucket pin failures");
  has(failed, "A post the user declined at the hook prompt is not a failure: the step is `completed`.");
  has(failed, "Its dependents are `skipped` as above.");
  const rule = linesOf(DO).find((l) => l.indexOf("- Never do delivery work in the main agent.") === 0);
  assert.ok(rule, "constraint missing");
  has(rule, "The one exception is posting a user-confirmed PR review draft with `gh` or `bkt`");
  const limits = [];
  walk(path.join(PLUGIN, "skills/do")).forEach((p) => {
    linesOf(fs.readFileSync(p, "utf8")).forEach((l, i) => {
      if (/GitHub remotes only|GitHub only|GitHub-only|`github\.com` remotes only|Bitbucket included|only in 1\.12\.0/i.test(l)) limits.push(path.relative(PLUGIN, p) + ":" + (i + 1) + ": " + l.trim().slice(0, 120));
    });
  });
  assert.deepStrictEqual(limits, [], "a sentence in skills/do limits the flow to GitHub:\n" + limits.join("\n"));
});

test("SKILL.md Change check refresh covers each write or removal under <root>/.agent/pr-review/, Cleanup included", () => {
  // [A15 | Scenario: No step is blamed for the removal | spec-orchestration-dispatch.md Requirement 15 | FR-208 | FR-032]
  const cc = sectionText(DO, "### Change check");
  has(cc, "and after each /do write or removal under `<root>/.agent/pr-review/` for a PR review (Cleanup included), refresh that file's status line and, for `DECISIONS.md` and the PR review files, its hash in the baseline, so /do's own writes are never attributed to a step.");
});

test("SKILL.md ## Cleanup sweeps the PR files of every PR review step with <N> set by the one glob-free command, reports one line per PR, never removes through a symlinked folder (exit 3), and changes no terminal choice", () => {
  // [A15 | Scenario: Failed step; Stopped step; Symlinked folder at Cleanup | spec-orchestration-dispatch.md Requirement 12 (DECISIONS.md 2026-10-22 "PR file cleanup by name") | FR-208 | FR-063 | FR-207]
  const c = sectionText(DO, "## Cleanup");
  has(c, "3. For every PR review step of the plan whose `<N>` is set, whatever its Status (`completed`, `failed`, or returned to `pending` by a stop), run the one command of the Cleanup section of [references/pr-review-flow.md](references/pr-review-flow.md#cleanup) for that `<N>`: its symlink guard, then `rm -f --` of the five PR files by exact name, with no glob. Never remove through a symlinked folder (exit 3). For a `completed` step the files are already gone and the command removes nothing and exits 0. Refresh the change-check baseline for each removed path (see Change check).");
  has(c, "with one line per PR: `PR files removed: PR <N>`, or `PR files kept: <root>/.agent/pr-review is a symlink`.");
  has(c, "The Display reply holds no cleanup report.");
  has(c, "skip step 3 if the plan has no PR review step with `<N>` set");
  has(c, "A symlinked `<root>/.agent/pr-review` changes no terminal choice.");
  const i0 = c.indexOf("`stopped`");
  const i1 = c.indexOf("`some-failed-or-skipped`");
  const i2 = c.indexOf("`all-completed`");
  assert.ok(i0 !== -1 && i1 > i0 && i2 > i1, "terminal tests out of order");
});

test("plan-format.md defines waiting-user, completed, and failed with the three PR review cases", () => {
  // [A15 | Scenario: Declined post completes the step; Failed step | spec-orchestration-dispatch.md Requirements 14 and 5 | FR-195 | FR-048 | FR-051]
  const lines = linesOf(PLAN_FORMAT);
  const wu = lines.find((l) => /^\s+- `waiting-user`:/.test(l));
  const co = lines.find((l) => /^\s+- `completed`:/.test(l));
  const fa = lines.find((l) => /^\s+- `failed`:/.test(l));
  assert.ok(wu && co && fa, "a status definition is missing");
  has(wu, "It also covers the open draft confirmation of a PR review step.");
  has(co, "A PR review step runs no gate: it is `completed` after a post, a post the user declined at the hook prompt, or a \"do not post\" answer");
  has(fa, "A PR review step is also `failed` on a fetch, link-check, or post error");
});

test("check-fsa-tables.js --check exits 0 and prints the match line after the States and Cleanup edits", () => {
  // [A13 | Scenario: Guard Error writes no Status (States table stays in step with the checker) | spec-orchestration.md | FR-207 | FR-180]
  const r = childProcess.spawnSync(process.execPath, [path.join(PLUGIN, "scripts", "check-fsa-tables.js"), "--check"], { cwd: REPO, encoding: "utf8", timeout: 60000 });
  assert.strictEqual(r.error, undefined, "spawn failed: " + (r.error && r.error.message));
  assert.strictEqual(r.status, 0, "exit " + r.status + "\n" + r.stdout + r.stderr);
  const last = (r.stdout || "").split("\n").filter((l) => l.trim() !== "").pop();
  assert.strictEqual(last, "FSA tables match the markdown.");
});

// ---------------------------------------------------------------------------
// Executed tests: the Cloud link check against a stub bkt, and the Requirement 15 cleanup command
// ---------------------------------------------------------------------------

function findOnPath(name) {
  if (process.platform === "win32") return null;
  const dirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  for (let i = 0; i < dirs.length; i++) {
    const p = path.join(dirs[i], name);
    try {
      fs.accessSync(p, fs.constants.X_OK);
      if (fs.statSync(p).isFile()) return p;
    } catch (e) {
      // not in this directory
    }
  }
  return null;
}

const BASH = findOnPath("bash");
const ZSH = findOnPath("zsh");
const SKIP_BASH = BASH ? false : "bash is not on PATH (or the platform is win32): the executed tests were not run";
const SKIP_ZSH = ZSH ? false : "zsh is not on PATH (or the platform is win32): the zsh run of the cleanup command was not run";
const ORIGINAL_PATH_DIRS = (process.env.PATH || "").split(path.delimiter).filter(Boolean);

// Runs `cmd` under `shellPath -c` with PATH set to exactly `pathDirs`.
function runShell(shellPath, cmd, pathDirs, cwd, extraEnv) {
  const env = Object.assign({}, process.env, { PATH: pathDirs.join(path.delimiter) });
  delete env.STUB_LINK;
  delete env.STUB_MODE;
  delete env.STUB_EXIT;
  delete env.STUB_LOG;
  Object.assign(env, extraEnv || {});
  return childProcess.spawnSync(shellPath, ["-c", cmd], { cwd: cwd, env: env, encoding: "utf8", timeout: 30000 });
}

const ANCHOR = "( link=";

// Every line that holds the Cloud link check. A line that starts with the anchor (after the list
// indentation of the flow file is trimmed) and ends with "exit 4 )" is a whole command; a line
// that mentions the check without being one is a command split across lines.
function linkCheckScan(text) {
  const good = [];
  const broken = [];
  linesOf(text).forEach((raw, i) => {
    const t = raw.replace(/^[ \t]+/, "");
    const starts = t.indexOf(ANCHOR) === 0;
    const mentions = t.indexOf("link=$(bkt pr view") !== -1;
    if (!starts && !mentions) return;
    const whole = starts && t.indexOf("|| exit 3;") !== -1 && /\|\| exit 4 \)$/.test(t);
    if (whole) good.push({ n: i + 1, text: t });
    else broken.push({ n: i + 1, text: t.slice(0, 120) });
  });
  return { good: good, broken: broken };
}

test("the Cloud link check in pr-review-flow.md is one single-line command, byte-identical to the one in the pr-review SKILL.md after the list indentation is trimmed", () => {
  // [A14 | Scenario: Cloud link mismatch and link-check failure; Cloud link differs only in case | spec-orchestration-dispatch.md Requirement 14 Bitbucket host pin | FR-203 | FR-195]
  const flow = linkCheckScan(FLOW);
  assert.deepStrictEqual(flow.broken, [], "pr-review-flow.md holds the link check split across lines or malformed: " + JSON.stringify(flow.broken));
  assert.ok(flow.good.length >= 1, "pr-review-flow.md holds no whole link-check command (anchor '( link=')");
  const skill = linkCheckScan(PRR_SKILL);
  assert.deepStrictEqual(skill.broken, [], "the pr-review SKILL.md link check is split or malformed: " + JSON.stringify(skill.broken));
  assert.strictEqual(skill.good.length, 1, "the pr-review SKILL.md must hold the link check once");
  flow.good.forEach((g) => assert.strictEqual(g.text, skill.good[0].text, "pr-review-flow.md:" + g.n + " differs from skills/pr-review/SKILL.md"));
  const workflow = linkCheckScan(read("skills/pr-review/references/review-workflow.md"));
  assert.deepStrictEqual(workflow.broken, []);
  workflow.good.forEach((g) => assert.strictEqual(g.text, skill.good[0].text, "review-workflow.md:" + g.n + " differs from SKILL.md"));
  has(PRR_SKILL, "The second comparison accepts a JSON-quoted string, because `--jq` prints strings JSON-quoted.");
});

const FILL = { "<ws-lc>": "acme", "<slug-lc>": "shop", "<ws>": "Acme", "<slug>": "Shop", "<N>": "123", "<ctx>": "cloud-prod" };

function fill(cmd) {
  return Object.keys(FILL).reduce((s, k) => s.split(k).join(FILL[k]), cmd);
}

const STUB = [
  "#!/bin/sh",
  "# Stub bkt for the link-check test: logs its arguments, then fails or prints STUB_LINK.",
  'if [ -n "$STUB_LOG" ]; then',
  '  for a in "$@"; do printf \'%s\\n\' "$a" >> "$STUB_LOG"; done',
  "fi",
  'if [ "$STUB_MODE" = "fail" ]; then',
  '  echo "bkt: stub failure" >&2',
  '  exit "${STUB_EXIT:-1}"',
  "fi",
  "printf '%s\\n' \"$STUB_LINK\"",
  "",
].join("\n");

test("executed link check from pr-review-flow.md: exit 0 for a matching, JSON-quoted, or case-only-different link; exit 4 for another repository; exit 3 when bkt fails or is absent", { skip: SKIP_BASH }, (t) => {
  // [A14 | Scenario: Cloud link differs only in case; Cloud link names another repository; Cloud link mismatch and link-check failure
  //  | spec-orchestration-dispatch.md Requirement 14 Bitbucket host pin | FR-203 | FR-195 (DECISIONS.md step 1 V8, V9)]
  const flow = linkCheckScan(FLOW);
  assert.ok(flow.good.length >= 1, "pr-review-flow.md holds no whole link-check command");
  const cmd = fill(flow.good[0].text);
  const leftover = cmd.match(/<[A-Za-z-]+>/g);
  assert.strictEqual(leftover, null, "placeholders left after filling: " + JSON.stringify(leftover));

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "do-linkcheck-"));
  try {
    const bin = path.join(work, "bin");
    const empty = path.join(work, "empty");
    const cwd = path.join(work, "cwd");
    [bin, empty, cwd].forEach((d) => fs.mkdirSync(d));
    fs.writeFileSync(path.join(bin, "bkt"), STUB, { mode: 0o755 });
    fs.chmodSync(path.join(bin, "bkt"), 0o755);
    const log = path.join(work, "args.log");
    const withStub = [bin].concat(ORIGINAL_PATH_DIRS);

    const probe = runShell(BASH, "bkt probe", withStub, cwd, { STUB_LINK: "probe-ok", STUB_LOG: path.join(work, "probe.log") });
    if (probe.status !== 0 || probe.stdout.trim() !== "probe-ok") {
      t.skip("the stub bkt could not run from " + bin + " (noexec temp folder?): exit " + probe.status + " " + (probe.stderr || "").trim());
      return;
    }

    const base = "https://bitbucket.org/";
    const pr = "/pull-requests/123";
    const exit0 = [
      ["matching lowercase link", base + "acme/shop" + pr],
      ["JSON-quoted matching link", '"' + base + "acme/shop" + pr + '"'],
      ["case-only difference (Acme/Shop)", base + "Acme/Shop" + pr],
      ["JSON-quoted case-only difference", '"' + base + "Acme/Shop" + pr + '"'],
    ];
    const exit4 = [
      ["another repository", base + "acme/other" + pr],
      ["another workspace", base + "other/shop" + pr],
      ["another PR number", base + "acme/shop/pull-requests/124"],
      ["PR number with an extra digit", base + "acme/shop/pull-requests/1234"],
      ["another host", "https://bitbucket.example.com/acme/shop" + pr],
      ["extra path segment", base + "acme/shop" + pr + "/diff"],
      ["empty link", ""],
      ["jq null", "null"],
      ["command substitution in the link", base + "acme/shop" + pr + "$(touch PWNED)"],
    ];
    const expectedArgs = ["pr", "view", "123", "--context", "cloud-prod", "--workspace", "Acme", "--repo", "Shop", "--json", "--jq", ".pull_request.links.html.href"];

    exit0.concat(exit4).forEach((c) => {
      const want = exit0.indexOf(c) !== -1 ? 0 : 4;
      fs.writeFileSync(log, "");
      const r = runShell(BASH, cmd, withStub, cwd, { STUB_LINK: c[1], STUB_LOG: log });
      assert.strictEqual(r.status, want, c[0] + ": expected exit " + want + ", got " + r.status + " stderr=" + r.stderr);
      assert.strictEqual(r.stdout, "", c[0] + ": the command printed to stdout: " + JSON.stringify(r.stdout));
      assert.deepStrictEqual(fs.readFileSync(log, "utf8").split("\n").filter(Boolean), expectedArgs, c[0] + ": bkt received other arguments");
      assert.ok(!fs.existsSync(path.join(cwd, "PWNED")), c[0] + ": link text ran as a command");
    });

    [1, 2, 4, 127].forEach((code) => {
      const r = runShell(BASH, cmd, withStub, cwd, { STUB_MODE: "fail", STUB_EXIT: String(code), STUB_LOG: log });
      assert.strictEqual(r.status, 3, "bkt exits " + code + ": expected exit 3, got " + r.status);
      assert.strictEqual(r.stdout, "", "bkt exits " + code + ": stdout must be empty");
    });

    const absent = runShell(BASH, cmd, [empty], cwd, { STUB_LINK: base + "acme/shop" + pr });
    assert.strictEqual(absent.status, 3, "bkt absent: expected exit 3, got " + absent.status);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

// The Cleanup command, extracted from the Cleanup section: the one single-line subshell.
function cleanupCommand() {
  const blocks = fencedBlocks(sectionText(FLOW, "## Cleanup"));
  const found = blocks.filter((b) => b.lines.length === 1 && /^\( test ! -L '<root>\/\.agent' && test ! -L '<root>\/\.agent\/pr-review' \|\| exit 3; rm -f -- .*pr-<N>.* \)$/.test(b.lines[0]));
  assert.strictEqual(found.length, 1, "expected one single-line cleanup subshell in the Cleanup section, found " + found.length);
  return found[0].lines[0];
}

// Fills <root> (quoted as the Quoting rule says: each ' becomes '\'') and <N>.
function fillCleanup(cmd, root, n) {
  const quoted = root.replace(/'/g, "'\\''");
  return cmd.split("<root>").join(quoted).split("<N>").join(String(n));
}

function prFiles(n) {
  return ["pr-" + n + ".diff", "pr-" + n + ".view.full", "pr-" + n + ".diff.full", "pr-" + n + ".comments.full", "pr-" + n + "-review.body"];
}

function populate(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const names = [].concat(prFiles(12), prFiles(123), prFiles(1234), ["pr-12x.diff", "notes.txt"]);
  names.forEach((n) => fs.writeFileSync(path.join(dir, n), n));
  return names;
}

function cleanupCases(shellName, shellPath, t) {
  const cmd = cleanupCommand();
  assert.strictEqual(cmd, CLEANUP_CMD);
  const tag = (s) => shellName + ": " + s;
  const run = (root, n, cwd) => runShell(shellPath, fillCleanup(cmd, root, n), ORIGINAL_PATH_DIRS, cwd);
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "do-cleanup-" + shellName + "-"));
  try {
    // PR 12, PR 123, and PR 1234 each remove exactly their own five files, in roots with a space, a quote, and glob characters.
    ["root", "root with space", "o'hara root", "g*lob[1]"].forEach((rootName) => {
      [12, 123, 1234].forEach((n) => {
        const root = path.join(base, rootName + "-" + n);
        const prDir = path.join(root, ".agent", "pr-review");
        const all = populate(prDir);
        const r = run(root, n, base);
        assert.strictEqual(r.status, 0, tag(rootName + " PR " + n + ": exit " + r.status + " " + r.stderr));
        const gone = prFiles(n);
        const expected = all.filter((f) => gone.indexOf(f) === -1).sort();
        assert.deepStrictEqual(fs.readdirSync(prDir).sort(), expected, tag(rootName + " PR " + n + ": the remaining files differ"));
        // A second run finds nothing to remove and still exits 0.
        const again = run(root, n, base);
        assert.strictEqual(again.status, 0, tag(rootName + " PR " + n + ": the second run exits " + again.status + " " + again.stderr));
        assert.deepStrictEqual(fs.readdirSync(prDir).sort(), expected, tag(rootName + " PR " + n + ": the second run changed the folder"));
      });
    });

    // PR 12 explicitly: every PR 123 and PR 1234 file and the unrelated files remain.
    const root12 = path.join(base, "explicit");
    const dir12 = path.join(root12, ".agent", "pr-review");
    populate(dir12);
    assert.strictEqual(run(root12, 12, base).status, 0);
    const left = fs.readdirSync(dir12);
    prFiles(12).forEach((f) => assert.ok(left.indexOf(f) === -1, tag(f + " was not removed")));
    prFiles(123).concat(prFiles(1234)).forEach((f) => assert.ok(left.indexOf(f) !== -1, tag(f + " was removed")));
    assert.ok(left.indexOf("pr-12x.diff") !== -1 && left.indexOf("notes.txt") !== -1, tag("an unrelated file was removed"));

    // A planted symlink at a file name is removed, not followed.
    const rootLink = path.join(base, "planted");
    const dirLink = path.join(rootLink, ".agent", "pr-review");
    fs.mkdirSync(dirLink, { recursive: true });
    const target = path.join(base, "precious.txt");
    fs.writeFileSync(target, "keep");
    try {
      fs.symlinkSync(target, path.join(dirLink, "pr-12.diff"));
    } catch (e) {
      t.skip("symlinks cannot be created here: " + e.message);
      return;
    }
    assert.strictEqual(run(rootLink, 12, base).status, 0, tag("a planted file symlink: exit"));
    assert.ok(!fs.existsSync(path.join(dirLink, "pr-12.diff")) && fs.lstatSync(target).isFile(), tag("the symlink target was touched or the link stayed"));
    assert.strictEqual(fs.readFileSync(target, "utf8"), "keep");

    // No files present: a missing .agent, and an empty pr-review folder, both exit 0 and change nothing.
    const bare = path.join(base, "bare");
    fs.mkdirSync(bare);
    assert.strictEqual(run(bare, 12, base).status, 0, tag("no .agent folder: exit"));
    assert.deepStrictEqual(fs.readdirSync(bare), [], tag("no .agent folder: the run created something"));
    const emptyRoot = path.join(base, "empty");
    fs.mkdirSync(path.join(emptyRoot, ".agent", "pr-review"), { recursive: true });
    assert.strictEqual(run(emptyRoot, 12, base).status, 0, tag("empty pr-review folder: exit"));
    assert.deepStrictEqual(fs.readdirSync(path.join(emptyRoot, ".agent", "pr-review")), [], tag("empty pr-review folder: changed"));

    // Symlinked folders: exit 3 and nothing removed through the link.
    const cases = [
      [
        "pr-review folder is a symlink",
        (root, elsewhere) => {
          populate(elsewhere);
          fs.mkdirSync(path.join(root, ".agent"), { recursive: true });
          fs.symlinkSync(elsewhere, path.join(root, ".agent", "pr-review"), "dir");
        },
        (elsewhere) => elsewhere,
      ],
      [
        ".agent is a symlink",
        (root, elsewhere) => {
          populate(path.join(elsewhere, "pr-review"));
          fs.mkdirSync(root, { recursive: true });
          fs.symlinkSync(elsewhere, path.join(root, ".agent"), "dir");
        },
        (elsewhere) => path.join(elsewhere, "pr-review"),
      ],
      [
        "pr-review is a dangling symlink",
        (root) => {
          fs.mkdirSync(path.join(root, ".agent"), { recursive: true });
          fs.symlinkSync(path.join(root, "nowhere"), path.join(root, ".agent", "pr-review"), "dir");
        },
        null,
      ],
    ];
    for (let i = 0; i < cases.length; i++) {
      const name = cases[i][0];
      const root = path.join(base, "link" + i);
      const elsewhere = path.join(base, "elsewhere" + i);
      cases[i][1](root, elsewhere);
      const watched = cases[i][2] ? cases[i][2](elsewhere) : null;
      const before = watched ? fs.readdirSync(watched).sort() : null;
      const r = run(root, 12, base);
      assert.strictEqual(r.status, 3, tag(name + ": the cleanup must exit 3, got " + r.status + " " + r.stderr));
      if (watched) {
        assert.ok(before.length > 0, tag(name + ": the watched folder was empty, so the check proves nothing"));
        assert.deepStrictEqual(fs.readdirSync(watched).sort(), before, tag(name + ": a file was removed through the link"));
      }
    }
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
}

test("executed cleanup under bash: the glob-free subshell removes exactly the five files of PR 12, PR 123, or PR 1234, a second run exits 0, no files present exits 0, and a symlinked .agent or pr-review folder exits 3 with nothing removed", { skip: SKIP_BASH }, (t) => {
  // [A15 | Scenario: PR 12 and PR 123; After a do-not-post answer; After a post; Post declined at the hook prompt; Symlinked folder; Symlinked folder at Cleanup
  //  | spec-orchestration-dispatch.md Requirements 12 and 15 (DECISIONS.md 2026-10-22 "PR file cleanup by name") | FR-208 | FR-207]
  cleanupCases("bash", BASH, t);
});

test("executed cleanup under zsh: the same cases, including no files present, which must exit 0", { skip: SKIP_ZSH }, (t) => {
  // [A15 | Scenario: PR 12 and PR 123; Symlinked folder | spec-orchestration-dispatch.md Requirement 15 (DECISIONS.md 2026-10-22: works in bash and zsh) | FR-208 | FR-207]
  cleanupCases("zsh", ZSH, t);
});

test("executed tests, skip guard: each executed test carries a non-empty skip reason when its shell is missing and none when it is present", () => {
  // [A14, A15 | Scenario: Cloud link check; Symlinked folder | docs/task-plans Check Commands TESTS row | FR-203 | FR-208]
  [[BASH, SKIP_BASH], [ZSH, SKIP_ZSH]].forEach((p) => {
    if (p[0]) {
      assert.strictEqual(p[1], false);
      assert.ok(path.isAbsolute(p[0]));
    } else {
      assert.ok(typeof p[1] === "string" && p[1].length > 0, "the skip reason must be a non-empty string");
    }
  });
});
