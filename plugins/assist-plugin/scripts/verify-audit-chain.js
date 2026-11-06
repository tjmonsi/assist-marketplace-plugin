#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-225|NFR-030] Verifies the governance audit log chain. It walks every segment of
// <root>/.agent/logs/governance/ (audit-NNNNNN.jsonl, then audit.jsonl) through verify() in hooks/lib/audit-chain.js,
// which recomputes each line's SHA-256 and follows the chain across the rotation cuts. This script only runs that
// verification and words the result; it does not hash anything itself. The `/assist-plugin:health --verify-audit` mode
// (hooks/impl/health-check.js) calls check() below, so both entry points agree.
//
// Usage:
//   node scripts/verify-audit-chain.js [root]
// `root` is the project root that holds .agent/. Without it the script uses CLAUDE_PROJECT_DIR, else the working
// directory, then the git root of that directory.
//
// Exit codes:
//   0  the chain is intact (a missing or empty log verifies as zero lines)
//   1  the chain is broken: the first broken line is named with its segment, its line in the segment, and the reason
//   2  cannot verify: the project root is unknown or a segment is unreadable
//
// Known limit (NFR-030). The chain runs backward: a line is confirmed by the line after it. The final retained line has
// no successor, and trailing lines removed from the end leave a shorter chain that still verifies. Neither is
// detectable without a head anchor kept outside the log, which is deferred; the output says so when the chain is intact.
//
// The audit log holds no prompt text, command text, or file contents (NFR-031), and this script prints none of the
// record values: it prints counts, line numbers, a segment name, and a fixed reason.
// No dependencies; ES2015 syntax only.
"use strict";

const path = require("path");

const auditChain = require(path.join(__dirname, "..", "hooks", "lib", "audit-chain.js"));
const { findGitRoot } = require(path.join(__dirname, "..", "hooks", "lib", "git-root.js"));

const EXIT_INTACT = 0;
const EXIT_BROKEN = 1;
const EXIT_CANNOT_VERIFY = 2;

const LOG_PATH = auditChain.LOG_DIR.split(path.sep).join("/") + "/" + auditChain.CURRENT_FILE;

// Fixed wording for each reason code verify() returns. The "chain breaks after" reasons name a line the chain still
// confirms: the line after it no longer holds its hash, so either this line or the next was edited, or lines between
// them were removed or reordered.
const REASONS = {
  "prev-mismatch": "the next line does not hold this line's hash: this line or the next was edited, or a line was removed or reordered after this one",
  "genesis-mismatch": "the first line of the oldest kept segment does not hold the genesis value: the start of the log was changed or earlier segments are missing",
  "not-a-record": "the line is not a JSON record with a valid previous-line hash",
  "partial-line": "the last line is incomplete (no end of line)",
};

const CAVEAT = "Not confirmed by the backward chain alone: the final line, and any lines removed from the end of the log. A head anchor outside the log would confirm both; none is kept yet.";

function plural(count, word) {
  return count + " " + word + (count === 1 ? "" : "s");
}

// Counts the `unidentified` records when verify() reports them (a number or a list). The flag stays inert until the
// per-agent identity of a later step lands; this only passes it through.
function unidentifiedCount(result) {
  const value = result && result.unidentified;
  if (Array.isArray(value)) return value.length;
  return typeof value === "number" && value > 0 ? value : 0;
}

// Turns a verify() result into {code, lines}. Pure: no output, no file access.
function describe(result) {
  if (!result || typeof result !== "object") {
    return { code: EXIT_CANNOT_VERIFY, lines: ["Cannot verify the audit chain: no result from the verifier."] };
  }
  if (result.error) {
    const code = typeof result.error.code === "string" ? result.error.code : "unknown";
    return { code: EXIT_CANNOT_VERIFY, lines: ["Cannot verify the audit chain: a segment could not be read (" + code + ")."] };
  }
  const out = [];
  const flagged = unidentifiedCount(result);
  if (result.ok) {
    if (result.lines === 0) {
      out.push("Audit chain: no lines to verify (0 lines in " + LOG_PATH + ").");
    } else {
      out.push("Audit chain intact: " + plural(result.lines, "line") + " verified across " + plural(result.segments, "segment") + ".");
      out.push(CAVEAT);
    }
    if (flagged > 0) out.push("Unidentified records: " + flagged + ".");
    return { code: EXIT_INTACT, lines: out };
  }
  const brk = result.firstBreak || {};
  out.push(
    "Audit chain BROKEN at line " + brk.line + " (segment " + brk.segment + ", line " + brk.segmentLine + " of that segment). " +
    plural(result.lines, "line") + " verified before the break."
  );
  out.push("Reason: " + (REASONS[brk.reason] || brk.reason || "unknown") + ".");
  if (brk.reason === "partial-line") {
    // A crash can leave an incomplete last line; the next append truncates it (audit-chain.js openCurrent). Not a tamper sign.
    out.push("A crash can leave an incomplete last line, and the next append truncates it. This is not necessarily tampering.");
  } else {
    out.push("The log was changed after it was written. Do not edit it; report the break.");
  }
  if (flagged > 0) out.push("Unidentified records before the break: " + flagged + ".");
  return { code: EXIT_BROKEN, lines: out };
}

// The default project root: CLAUDE_PROJECT_DIR else the working directory, then its git root. Null when neither is absolute.
function defaultRoot() {
  const start = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  return findGitRoot(start) || (path.isAbsolute(start) ? start : null);
}

// Verifies the log under `root` (an absolute path; the default root when omitted). Returns {code, lines}. Never throws.
function check(root) {
  try {
    const base = typeof root === "string" && root.length > 0 ? path.resolve(root) : defaultRoot();
    if (!base) return { code: EXIT_CANNOT_VERIFY, lines: ["Cannot verify the audit chain: the project root is unknown."] };
    return describe(auditChain.verify(null, { root: base }));
  } catch (err) {
    const code = err && typeof err.code === "string" ? err.code : "unknown";
    return { code: EXIT_CANNOT_VERIFY, lines: ["Cannot verify the audit chain: the verifier failed (" + code + ")."] };
  }
}

// Writes the lines of a check() result: stdout for a verdict, stderr when the log could not be verified.
function report(outcome) {
  const stream = outcome.code === EXIT_CANNOT_VERIFY ? process.stderr : process.stdout;
  stream.write(outcome.lines.join("\n") + "\n");
}

function main() {
  const outcome = check(process.argv[2]);
  report(outcome);
  process.exitCode = outcome.code;
}

module.exports = { EXIT_INTACT, EXIT_BROKEN, EXIT_CANNOT_VERIFY, describe, check, report };

if (require.main === module) main();
