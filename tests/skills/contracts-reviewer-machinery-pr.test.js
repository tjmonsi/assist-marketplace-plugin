// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Text contract tests for the PR post-step guards of the reviewer machinery: skills/do/references/pr-review-flow.md (the post
// step of a /do PR review) and skills/pr-review/references/review-workflow.md (the post step of the /pr-review skill). Task plan
// docs/task-plans/task-plan-reviewer-machinery-20261125-0717.md, Step 24 (text of Steps 16 and 17).
//
// Sources: specs/spec-reviewer-machinery.md (Requirement 16: Post a PR review only against the current head, scenarios Head
// unchanged and Head moved; Requirement 17: Read back the PR reviews after an unknown posting outcome, scenarios Review exists
// after the error and Review absent after the error; the Traceability rows for FR-304 and FR-305), docs/requirements/
// FR-NFR-harness-governance.md (FR-195, FR-214, FR-304, FR-305), and the spec's own limit: the PR behavior is prompt text, so no
// runtime test is possible without a code-hosting platform. The spec carries no SPEC-NNN id, so it is cited by file name.
//
// What the tests assert: both files state the head read immediately before the post, the stale-draft report with no post, the
// review read-back before any retry, a retry only under a new confirmation, and that the FR-214 confirmation, the body-hash
// check, and the pr-post-ask prompt remain. The new commands are read-only gh commands that carry no verdict flag, so the
// verdict guard has nothing to deny. Bitbucket is UNSUPPORTED for both guards (unset decision U-9) and the files say so.
//
// Traceability format: [AC-N | spec-reviewer-machinery | FR-nnn]. AC-N is the position of the Scenario inside its Requirement
// (Requirement 16: Head unchanged is AC-1, Head moved is AC-2; Requirement 17: Review exists is AC-1, Review absent is AC-2).
//
// Run: node --test tests/skills/contracts-reviewer-machinery-pr.test.js

"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(REPO, "plugins", "assist-plugin");

const SPEC = "spec-reviewer-machinery";
function tag(ac, fr) {
  return "[AC-" + ac + " | " + SPEC + " | " + fr + "]";
}

function read(rel) {
  return fs.readFileSync(path.join(PLUGIN, rel), "utf8");
}

// The text with code ticks and bold markers removed and every run of white space made one space, so a phrase matches across a
// wrapped line and a bold run.
function plain(text) {
  return text.replace(/[`*]/g, "").replace(/\s+/g, " ");
}

function contains(text, phrase) {
  return plain(text).indexOf(plain(phrase)) !== -1;
}

function expectText(label, text, phrase) {
  assert.ok(contains(text, phrase), label + " must state: " + phrase);
}

function linesOf(text) {
  return text.split(/\r?\n/);
}

// Lines under a heading up to the next heading of the same or a higher level, outside code fences.
function section(text, heading) {
  const lines = linesOf(text);
  const level = /^(#+)/.exec(heading)[1].length;
  const out = [];
  let on = false;
  let fence = false;
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i];
    if (/^\s*(```|~~~)/.test(l)) fence = !fence;
    if (!on) {
      if (!fence && l.trim() === heading) on = true;
      continue;
    }
    if (!fence) {
      const m = /^(#+)\s/.exec(l);
      if (m && m[1].length <= level) break;
    }
    out.push(l);
  }
  assert.ok(on, "heading not found: " + heading);
  return out.join("\n");
}

// The fenced code blocks of a text, each as one string.
function codeBlocks(text) {
  const blocks = [];
  let current = null;
  linesOf(text).forEach((l) => {
    if (/^\s*(```|~~~)/.test(l)) {
      if (current === null) current = [];
      else {
        blocks.push(current.join("\n"));
        current = null;
      }
      return;
    }
    if (current !== null) current.push(l);
  });
  return blocks;
}

const FLOW = read("skills/do/references/pr-review-flow.md");
const FLOW_POST = section(FLOW, "## Post");
const FLOW_FETCH = section(FLOW, "## Fetch");
const WORKFLOW = read("skills/pr-review/references/review-workflow.md");
const GUARD = section(WORKFLOW, "### Head Check and Read-Back");

const BOTH = [["pr-review-flow.md", FLOW], ["review-workflow.md", WORKFLOW]];

// ---------------------------------------------------------------------------
// Requirement 16: the head read immediately before the post
// ---------------------------------------------------------------------------

test(tag(1, "FR-304") + " pr-review-flow.md Fetch: /do reads the PR's head revision first on GitHub and keeps it as the revision the draft is built against", () => {
  expectText("Fetch", FLOW_FETCH, "[FR-304] On GitHub, /do first reads the PR's head revision, as its own command before the fetch chain, so the diff is never older than the recorded head.");
  expectText("Fetch", FLOW_FETCH, "gh pr view '<N>' --repo 'github.com/<owner>/<repo>' --json headRefOid --jq '.headRefOid'");
  expectText("Fetch", FLOW_FETCH, "/do keeps the id as <head>, the revision the draft is built against.");
});

test(tag(1, "FR-304") + " pr-review-flow.md Fetch: a head read that fails or returns no 40-character hex id fails the step with tool-failed", () => {
  expectText("Fetch", FLOW_FETCH, "A non-zero exit fails the step with tool-failed. An output that does not match ^[0-9a-f]{40}$ fails the step with tool-failed too.");
});

test(tag(1, "FR-304") + " pr-review-flow.md Post: the head is read again as the last command before the post command, and compared with the recorded head", () => {
  expectText("Post", FLOW_POST, "[FR-304] Head check (GitHub). /do runs this command on its own, as the last command before the post command, so the head is read immediately before the post.");
  expectText("Post", FLOW_POST, "( cur=$(gh pr view '<N>' --repo 'github.com/<owner>/<repo>' --json headRefOid --jq '.headRefOid') || exit 3; [ \"$cur\" = '<head>' ] || exit 4 )");
});

test(tag(1, "FR-304") + " pr-review-flow.md Post: when the head is unchanged (exit 0) the post may run, still subject to the confirmation record, the body-hash check, and the pr-post-ask prompt", () => {
  expectText("Post", FLOW_POST, "Exit 0: the head is still <head>. The post command may run, still subject to the confirmation record, the body-hash check, and the pr-post-ask prompt.");
});

test(tag(2, "FR-304") + " pr-review-flow.md Post: when the head moved (exit 4) /do runs no post command, tells the user the draft is stale, and fails the step with policy-rejection", () => {
  expectText("Post", FLOW_POST, "Exit 4: the head moved, so the draft is stale. /do runs no post command, tells the user the draft is stale, and fails the step with policy-rejection.");
});

test(tag(2, "FR-304") + " pr-review-flow.md Post: a head that could not be read, or a recorded head /do cannot recall, posts nothing", () => {
  expectText("Post", FLOW_POST, "Exit 3 or any other non-zero exit: the head could not be read. /do runs no post command and fails the step with tool-failed.");
  expectText("Post", FLOW_POST, "A <head> /do cannot recall counts as a moved head: no post command runs and the step fails with policy-rejection.");
});

test(tag(2, "FR-304") + " pr-review-flow.md: the status table and the failures table record a moved head as a failure with nothing posted and a stale-draft message", () => {
  expectText("pr-review-flow.md", FLOW, "A moved head (head-check exit 4), or a <head> /do cannot recall | policy-rejection | Step failed; nothing is posted; /do tells the user the draft is stale");
  expectText("pr-review-flow.md", FLOW, "a moved head, or a <head> /do cannot recall, found by the head check before posting (policy-rejection)");
});

test(tag(1, "FR-304") + " review-workflow.md: the head is recorded before the draft, and the head check runs as the last command before the post, which posts nothing when the head moved", () => {
  expectText("review-workflow.md", WORKFLOW, "On GitHub, first read the PR's head revision and keep it as the revision the draft is built against");
  expectText("review-workflow.md", WORKFLOW, "run the head check of [Head Check and Read-Back](#head-check-and-read-back) as the last command before the post, and post nothing when the head moved");
  expectText("Head Check and Read-Back", GUARD, "As the last command before the post, read the head again and compare it with the recorded one.");
});

test(tag(1, "FR-304") + " review-workflow.md: an unchanged head (exit 0) lets the post run, still subject to the confirmation", () => {
  expectText("Head Check and Read-Back", GUARD, "Exit 0: the head is unchanged. The post may run, still subject to the confirmation.");
});

test(tag(2, "FR-304") + " review-workflow.md: a moved head (exit 4) posts nothing, tells the user the draft is stale, and offers a new review against the new head", () => {
  expectText("Head Check and Read-Back", GUARD, "Exit 4: the head moved, so the draft is stale. Post nothing, tell the user the draft is stale, and offer a new review against the new head.");
  expectText("Head Check and Read-Back", GUARD, "Exit 3 or any other non-zero exit, or a recorded head that cannot be recalled: post nothing and report that the head could not be checked.");
});

test(tag(2, "FR-304") + " both files compare the current head with the recorded head and use exit 3 for a failed read and exit 4 for a moved head", () => {
  BOTH.forEach((pair) => {
    const blocks = codeBlocks(pair[1]).filter((b) => b.indexOf("headRefOid") !== -1 && b.indexOf("exit 4") !== -1);
    assert.ok(blocks.length >= 1, pair[0] + " has no head-check command");
    blocks.forEach((b) => {
      assert.ok(b.indexOf("exit 3") !== -1, pair[0] + ": " + b);
      assert.ok(/\[ "\$cur" = '<head>' \] \|\| exit 4/.test(b), pair[0] + ": " + b);
    });
  });
});

// ---------------------------------------------------------------------------
// Requirement 17: the read-back after an unknown outcome
// ---------------------------------------------------------------------------

test(tag(1, "FR-305") + " pr-review-flow.md Post: after a post ends with an unknown outcome, /do reads the PR's reviews back before any retry", () => {
  expectText("Post", FLOW_POST, "[FR-305] Unknown outcome (GitHub). A gh post whose error output shows a server error (an HTTP 5xx status), a timeout, or no response may or may not have created the review.");
  expectText("Post", FLOW_POST, "Before any retry, /do reads the PR's reviews back and matches each review's body hash against the draft's.");
});

test(tag(1, "FR-305") + " pr-review-flow.md Post: when the review exists after the error /do posts nothing more and tells the user the review reached the PR", () => {
  expectText("Post", FLOW_POST, "A review is present: /do posts nothing more. It tells the user the review reached the PR despite the error");
  expectText("Post", FLOW_POST, "posted (confirmed by read-back)");
});

test(tag(2, "FR-305") + " pr-review-flow.md Post: when no review is present a retry is allowed only under a new FR-214 confirmation, and the retry runs the head check and body-hash check again", () => {
  expectText("Post", FLOW_POST, "No review is present: a retry is allowed only under a new FR-214 confirmation.");
  expectText("Post", FLOW_POST, "The retry then runs the head check, the body-hash check, and the post again, in that order.");
  expectText("Post", FLOW_POST, "When the user does not confirm, the step fails with tool-failed and nothing more is posted.");
});

test(tag(2, "FR-305") + " pr-review-flow.md Post: a read-back that fails or a body check that prints FAILED retries nothing, and any other failed post has a known outcome and is not retried", () => {
  expectText("Post", FLOW_POST, "A read-back command that fails, a body-file check that prints FAILED, or a <hash> /do cannot recall: /do retries nothing, tells the user the outcome is unknown");
  expectText("Post", FLOW_POST, "A post that fails any other way (a failed body-hash check, a verdict flag the host rejects, a permission error) has a known outcome and is not retried.");
  expectText("Post", FLOW_POST, "except for an unknown outcome");
});

test(tag(1, "FR-305") + " review-workflow.md: after an unknown outcome the reviews are read back before any retry, and a present review blocks a second post", () => {
  expectText("Head Check and Read-Back", GUARD, "A gh pr review whose error output shows a server error (an HTTP 5xx status), a timeout, or no response may or may not have created the review.");
  expectText("Head Check and Read-Back", GUARD, "Before any retry, read the PR's reviews back and match each review's body hash against the draft's.");
  expectText("Head Check and Read-Back", GUARD, "A review is present: do not post again. Tell the user the review reached the PR despite the error.");
});

test(tag(2, "FR-305") + " review-workflow.md: with no review present a retry needs a new confirmation with a new token after a fresh head check, and a failed read-back retries nothing", () => {
  expectText("Head Check and Read-Back", GUARD, "No review is present: a retry is allowed only under a new confirmation with a new token (steps 3 to 5 of the protocol), after a fresh head check.");
  expectText("Head Check and Read-Back", GUARD, "A read-back that fails, a body check that prints FAILED, or output that cannot be read: retry nothing and tell the user the outcome is unknown.");
});

test(tag(1, "FR-305") + " both files match reviews by body hash and print states and hashes, never a review body", () => {
  expectText("Head Check and Read-Back", GUARD, "The second prints one line per review, the review's state and the body hash with trailing newlines removed, never a review body.");
  expectText("pr-review-flow.md", FLOW_POST, "The second prints one line per review, the review's state and the body hash with trailing newlines removed, never a review body.");
});

// ---------------------------------------------------------------------------
// The guards add to FR-214 and replace none of it
// ---------------------------------------------------------------------------

test(tag(1, "FR-304") + " pr-review-flow.md: the head check and the read-back add to the FR-214 confirmation, the body-hash check, and the pr-post-ask prompt and replace none of them", () => {
  expectText("pr-review-flow.md", FLOW, "[FR-304, FR-305] A GitHub post also needs the head check and, after an unknown outcome, the review read-back (see Post). Both add to the FR-214 confirmation, the body-hash check, and the pr-post-ask prompt and replace none of them.");
});

test(tag(1, "FR-304") + " review-workflow.md: the two guards replace none of the Confirmation Gate, the body-hash check, or the pr-post-ask prompt, and the verdict flags that need a confirmation are unchanged", () => {
  expectText("Head Check and Read-Back", GUARD, "[FR-304, FR-305] These two guards add to the Confirmation Gate and replace none of it: the per-PR, per-verdict confirmation, the body-hash check, and the pr-post-ask prompt stay as written, and the verdict flags that need a confirmation are unchanged.");
});

test(tag(1, "FR-304") + " review-workflow.md: the Confirmation Gate still names the three verdict flags and requires a confirmation for each PR and verdict", () => {
  expectText("review-workflow.md", WORKFLOW, "--approve, --changes-requested, --comment");
  expectText("review-workflow.md", WORKFLOW, "They are never executed without an explicit, affirmative confirmation from the human user in the current turn");
  expectText("review-workflow.md", WORKFLOW, "each PR/verdict needs its own confirmation");
});

test(tag(1, "FR-304") + " pr-review-flow.md: the posting commands still run behind the body-hash check, and the FR-214 confirmation record is still required before a post", () => {
  expectText("Post", FLOW_POST, "A post runs only after the hook recorded the user's token-bearing message in confirmations.jsonl for this PR and verdict (see Confirm)");
  expectText("Post", FLOW_POST, "sha256sum -c --strict - && gh pr review '<N>' --repo 'github.com/<owner>/<repo>' --approve --body-file '<root>/.agent/pr-review/pr-<N>-review.body'");
  expectText("pr-review-flow.md", FLOW, "the PR-verdict guard denies gh pr review and bkt pr approve without that record");
});

test(tag(1, "FR-304") + " pr-review-flow.md: the pr-post-ask hook prompt section remains, and a declined post is still not a failure", () => {
  assert.ok(/^## Hook prompt$/m.test(FLOW), "the Hook prompt section remains");
  const hook = section(FLOW, "## Hook prompt");
  expectText("Hook prompt", hook, "The ask hook may prompt for each posting command");
  expectText("Hook prompt", hook, "reports no tool-failed");
});

test(tag(1, "FR-304") + " review-workflow.md: the Hook Prompt Outcomes section remains, and the pr-post-ask prompt is still named", () => {
  assert.ok(/^### Hook Prompt Outcomes$/m.test(WORKFLOW), "the Hook Prompt Outcomes section remains");
  assert.ok(contains(WORKFLOW, "pr-post-ask"), "pr-post-ask is named");
  expectText("Hook Prompt Outcomes", section(WORKFLOW, "### Hook Prompt Outcomes"), "Each post command meets the ask hook's prompt after the confirmation.");
});

test(tag(1, "FR-304") + " review-workflow.md: the body-hash check remains in the injection-safe posting steps", () => {
  expectText("review-workflow.md", WORKFLOW, "the body-hash check (below) runs before the post");
});

test(tag(1, "FR-304") + " the new commands are read-only gh commands that carry no verdict flag, so no verdict guard denies them", () => {
  BOTH.forEach((pair) => {
    codeBlocks(pair[1]).filter((b) => b.indexOf("headRefOid") !== -1 || b.indexOf("--json reviews") !== -1).forEach((b) => {
      assert.ok(!/gh pr review/.test(b), pair[0] + " runs a review post inside a read command: " + b);
      assert.ok(!/--approve|--request-changes|--comment|--changes-requested/.test(b), pair[0] + " carries a verdict flag in a read command: " + b);
      assert.ok(/gh pr view/.test(b), pair[0] + " reads with gh pr view: " + b);
    });
  });
  expectText("pr-review-flow.md", FLOW_FETCH, "The command is read-only, and its output is one revision id with no PR text");
  expectText("review-workflow.md", GUARD, "Both guards use read-only gh commands that no hook denies");
});

test(tag(1, "FR-305") + " the read-back commands list reviews with gh pr view --json reviews in both files", () => {
  BOTH.forEach((pair) => {
    assert.ok(codeBlocks(pair[1]).some((b) => /gh pr view '<N>'[^\n]*--json reviews/.test(b)), pair[0] + " has no review read-back command");
  });
});

// ---------------------------------------------------------------------------
// Bitbucket
// ---------------------------------------------------------------------------

test(tag(2, "FR-304") + " both files mark Bitbucket UNSUPPORTED for the head check and the read-back, and a failed bkt post is never retried", () => {
  expectText("pr-review-flow.md", FLOW_POST, "Head check (Bitbucket). UNSUPPORTED.");
  expectText("pr-review-flow.md", FLOW_POST, "Unknown outcome (Bitbucket). The review read-back is UNSUPPORTED for Bitbucket");
  expectText("pr-review-flow.md", FLOW_POST, "A failed bkt post is not retried.");
  expectText("review-workflow.md", GUARD, "Bitbucket. UNSUPPORTED for both guards.");
  expectText("review-workflow.md", GUARD, "a failed bkt post is never retried");
});

test(tag(2, "FR-304") + " both files say the Bitbucket head-revision command is not named in the spec, so they invent none, and the FR-214 confirmation, body-hash check, and pr-post-ask prompt still apply there", () => {
  expectText("pr-review-flow.md", FLOW_POST, "The FR-214 confirmation, the body-hash check, and the pr-post-ask prompt still apply.");
  expectText("pr-review-flow.md", FLOW_POST, "this flow does not invent one");
  expectText("review-workflow.md", GUARD, "this skill does not invent one");
});

test(tag(2, "FR-304") + " no bkt command reads the head or the reviews: every code block that reads the head or the reviews is a gh command", () => {
  BOTH.forEach((pair) => {
    codeBlocks(pair[1]).filter((b) => /headRefOid|--json reviews/.test(b)).forEach((b) => {
      assert.ok(!/(^|[\s(])bkt /.test(b), pair[0] + " reads the head or the reviews with bkt: " + b);
    });
  });
});
