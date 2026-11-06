// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-217|NFR-031] Secret rules shared by scripts/scan-staged-secrets.js and any later hook. Each rule is a name and
// one regular expression. A finding is reported by rule name only, never by the matched text (NFR-031), so the
// functions here return names and never the match.
//
// The patterns look for the published shape of a credential: a fixed vendor prefix with a run of key characters, or
// a PEM private-key header. The last rule catches a quoted literal assigned to a credential-like name and is the
// one most likely to flag a placeholder; it needs 20 or more key characters in one run, so short sample values pass.
// This is a pattern scan, not an entropy scan or a verified-secret check. A project that needs more substitutes an
// external scanner (for example gitleaks or trufflehog) in the commit skill and keeps the three outcomes clean,
// findings, and cannot-run.
//
// No rule holds a live secret. A regular expression has no g or y flag, so a rule has no state between calls.
// Every quantifier is bounded or runs over a single character class, so a long line cannot make a rule backtrack.
// Pure: no I/O. ES2015 syntax only.
"use strict";

const RULES = Object.freeze([
  { name: "aws-access-key-id", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/ },
  { name: "github-fine-grained-token", pattern: /\bgithub_pat_[A-Za-z0-9_]{22,255}\b/ },
  { name: "slack-token", pattern: /\bxox[abeoprs]-[A-Za-z0-9-]{10,200}/ },
  { name: "anthropic-api-key", pattern: /\bsk-ant-[A-Za-z0-9_-]{20,255}/ },
  { name: "openai-api-key", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,255}/ },
  { name: "google-api-key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "stripe-live-key", pattern: /\b[rs]k_live_[0-9A-Za-z]{20,255}/ },
  { name: "private-key-block", pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/ },
  {
    name: "credential-assignment",
    pattern: /(?:api[_-]?key|secret|passwd|password|token)\w{0,20}["']?\s{0,3}[:=]\s{0,3}["'][A-Za-z0-9/+_.-]{20,255}["']/i
  }
]);

// Names of the rules that match `text`, in rule order. Returns [] for a non-string.
function matchRules(text) {
  if (typeof text !== "string") return [];
  const names = [];
  for (let i = 0; i < RULES.length; i += 1) {
    if (RULES[i].pattern.test(text)) names.push(RULES[i].name);
  }
  return names;
}

module.exports = { RULES, matchRules };
