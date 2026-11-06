// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Worker for the race test in tests/hooks/audit-chain.test.js (spec-hooks-audit.md, Requirement: Hash-chained
// append: two parallel subagents can append at once, and the race is tested). Several of these run in parallel against
// one project root; each appends `count` records through the public append() of hooks/lib/audit-chain.js.
//
// Usage: node append-worker.js <root> <label> <count>
// Prints one JSON line {label, ok, failures} and exits 0 when every append succeeded, 1 otherwise.

"use strict";

const path = require("node:path");

const audit = require(path.join(__dirname, "..", "..", "..", "plugins", "assist-plugin", "hooks", "lib", "audit-chain.js"));

const root = process.argv[2];
const label = process.argv[3];
const count = Number(process.argv[4]);

let okCount = 0;
const failures = [];

for (let i = 1; i <= count; i += 1) {
  try {
    const res = audit.append({ event: "worker-event", rule_id: "worker-" + label, n: i }, { root: root });
    if (res && res.ok) {
      okCount += 1;
    } else {
      failures.push(res && res.code ? String(res.code) : "failed");
    }
  } catch (err) {
    failures.push(err && err.code ? String(err.code) : "threw");
  }
}

process.stdout.write(JSON.stringify({ label: label, ok: okCount, failures: failures }) + "\n");
process.exit(failures.length === 0 ? 0 : 1);
