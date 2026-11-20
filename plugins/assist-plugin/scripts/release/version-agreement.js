// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// [FR-251|FR-173|FR-194] Version-agreement section of scripts/release-check.js. It reads the plugin version from six
// places under a repository root and compares every place with the plugin.json version:
//   1. plugins/assist-plugin/.claude-plugin/plugin.json          "version"
//   2. .claude-plugin/marketplace.json                           the "assist-plugin" plugin entry "version"
//   3. CLAUDE.md                                                 the "- **Plugin:** ... (vX.Y.Z)" line
//   4. README.md                                                 the "### assist-plugin vX.Y.Z" heading
//   5. MARKETPLACE.md                                            the same heading, and the Versioning sentence
//                                                                "Version X.Y.Z is available"
//   6. CHANGELOG.md                                              the first "## [X.Y.Z]" heading in file order
// Outcomes: "clean" (every place agrees), "finding" (at least one place disagrees), "error" (a place among the first
// five cannot be read or holds no version, so the section could not complete). The sixth place follows the
// [FR-251] release rule: without options.release it is never a finding, whether its newest heading is absent, older,
// or equal; with options.release an absent or disagreeing newest heading is a finding that names CHANGELOG.md.
// No dependencies; ES2015 syntax only.
"use strict";

const fs = require("fs");
const path = require("path");

const OUTCOME_CLEAN = "clean";
const OUTCOME_FINDING = "finding";
const OUTCOME_ERROR = "error";

const VERSION = "\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.]+)?";
const PLUGIN_NAME = "assist-plugin";
const PLUGIN_JSON = "plugins/assist-plugin/.claude-plugin/plugin.json";
const MARKETPLACE_JSON = ".claude-plugin/marketplace.json";
const CHANGELOG = "CHANGELOG.md";

const PLUGIN_LINE = new RegExp("^- \\*\\*Plugin:\\*\\*.*\\(v(" + VERSION + ")\\)", "m");
const PLUGIN_HEADING = new RegExp("^### assist-plugin v(" + VERSION + ")[ \\t]*$", "m");
const VERSIONING_SENTENCE = new RegExp("\\bVersion (" + VERSION + ") is available\\b");
const CHANGELOG_HEADING = new RegExp("^## \\[(" + VERSION + ")\\]", "m");

// A place that cannot be read or holds no version: the section could not complete.
class PlaceError extends Error {
  constructor(file, reason) {
    super(file + ": " + reason);
    this.name = "PlaceError";
  }
}

function readText(root, file) {
  try {
    return fs.readFileSync(path.join(root, file), "utf8");
  } catch (error) {
    throw new PlaceError(file, "cannot read the file (" + (error && error.code ? error.code : "error") + ")");
  }
}

function readJson(root, file) {
  try {
    return JSON.parse(readText(root, file));
  } catch (error) {
    if (error instanceof PlaceError) {
      throw error;
    }
    throw new PlaceError(file, "cannot parse the file as JSON");
  }
}

function matchVersion(text, pattern, file, what) {
  const match = pattern.exec(text);
  if (!match) {
    throw new PlaceError(file, "no version found in " + what);
  }
  return match[1];
}

function jsonVersion(value, file, what) {
  if (typeof value !== "string" || !new RegExp("^" + VERSION + "$").test(value)) {
    throw new PlaceError(file, "no version found in " + what);
  }
  return value;
}

// Each place is { file, what, read(root) } and read returns a version string or throws PlaceError.
const PLACES = [
  {
    file: MARKETPLACE_JSON,
    what: "the assist-plugin entry",
    read: (root) => {
      const manifest = readJson(root, MARKETPLACE_JSON);
      const entry = Array.isArray(manifest && manifest.plugins)
        ? manifest.plugins.find((plugin) => plugin && plugin.name === PLUGIN_NAME)
        : undefined;
      return jsonVersion(entry && entry.version, MARKETPLACE_JSON, "the assist-plugin entry");
    },
  },
  {
    file: "CLAUDE.md",
    what: "the Plugin line",
    read: (root) => matchVersion(readText(root, "CLAUDE.md"), PLUGIN_LINE, "CLAUDE.md", "the Plugin line"),
  },
  {
    file: "README.md",
    what: "the assist-plugin heading",
    read: (root) => matchVersion(readText(root, "README.md"), PLUGIN_HEADING, "README.md", "the assist-plugin heading"),
  },
  {
    file: "MARKETPLACE.md",
    what: "the assist-plugin heading",
    read: (root) =>
      matchVersion(readText(root, "MARKETPLACE.md"), PLUGIN_HEADING, "MARKETPLACE.md", "the assist-plugin heading"),
  },
  {
    file: "MARKETPLACE.md",
    what: "the Versioning sentence",
    read: (root) =>
      matchVersion(readText(root, "MARKETPLACE.md"), VERSIONING_SENTENCE, "MARKETPLACE.md", "the Versioning sentence"),
  },
];

// The newest versioned CHANGELOG heading, or null when there is none or the file is missing [FR-251].
function newestChangelogVersion(root) {
  let text;
  try {
    text = fs.readFileSync(path.join(root, CHANGELOG), "utf8");
  } catch (error) {
    return null;
  }
  const match = CHANGELOG_HEADING.exec(text);
  return match ? match[1] : null;
}

function describe(place, version, reference) {
  return place.file + ": " + place.what + " reads " + version + ", plugin.json reads " + reference;
}

// check(root, options) -> { outcome, details }. options.release turns the CHANGELOG place into a gate.
function check(root, options) {
  const release = Boolean(options && options.release);
  const details = [];
  try {
    const manifest = readJson(root, PLUGIN_JSON);
    const reference = jsonVersion(manifest && manifest.version, PLUGIN_JSON, "the version field");
    PLACES.forEach((place) => {
      const version = place.read(root);
      if (version !== reference) {
        details.push(describe(place, version, reference));
      }
    });
    if (release) {
      const newest = newestChangelogVersion(root);
      if (newest === null) {
        details.push(CHANGELOG + ": no versioned heading, plugin.json reads " + reference);
      } else if (newest !== reference) {
        details.push(CHANGELOG + ": newest heading reads " + newest + ", plugin.json reads " + reference);
      }
    }
  } catch (error) {
    if (error instanceof PlaceError) {
      return { outcome: OUTCOME_ERROR, details: [error.message] };
    }
    return { outcome: OUTCOME_ERROR, details: ["version check failed (" + (error && error.name ? error.name : "Error") + ")"] };
  }
  return { outcome: details.length === 0 ? OUTCOME_CLEAN : OUTCOME_FINDING, details };
}

module.exports = { check, newestChangelogVersion, OUTCOME_CLEAN, OUTCOME_FINDING, OUTCOME_ERROR };
