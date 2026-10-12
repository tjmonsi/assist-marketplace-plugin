// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Entry-point launcher for every assist-plugin hook command.
// ES5 syntax only (var, function, no arrow functions, no template literals): this file must
// parse on any Node version so an old Node prints a warning instead of a SyntaxError.
// Fail-open: every failure path prints {"systemMessage": ...} and exits 0. It never exits 2.
"use strict";

var fs = require("fs");
var path = require("path");

// Minimum Node major version. The guard and health-check code uses only ES2015 syntax and APIs
// (const, let, arrow functions, template literals, destructuring, Map, Set, fs.writeSync); it avoids
// ES2016+ syntax such as ??, ?. and optional catch binding. The full test matrix passes on Node
// 6.17.1, 8, 10, 12, 14, 18 and 26. Older Node prints the warning and lets the command run.
var MIN_NODE_MAJOR = 6;

// Version strings from process.version only; anything that does not start with vN[.N[.N]] is "unknown".
var VERSION_PREFIX = /^v\d+(\.\d+){0,2}/;

function nodeVersion() {
  var match = VERSION_PREFIX.exec(String(process.version));
  return match ? match[0] : "unknown";
}

// Pure check for unit tests: accepts "v6.17.1" or "6.17.1"; anything else is unsupported.
function isSupported(versionString) {
  var match = /^v?(\d+)(\.\d+){0,2}/.exec(String(versionString));
  return !!match && parseInt(match[1], 10) >= MIN_NODE_MAJOR;
}

function suffixFor(hook) {
  if (hook === "health-check") return "the health check did not run";
  if (hook === "injection-filter") return "this content was not filtered";
  if (hook === "prose-gate") return "this write was not checked";
  if (hook === "prose-advisor") return "this write was not reviewed";
  if (hook === "writing-context") return "the writing standard was not loaded";
  return "this command was not checked";
}

// Last-resort warning that does not depend on any other module.
function bareWarn(hook, detail) {
  try {
    var text = JSON.stringify({
      systemMessage: "assist-plugin " + hook + " hook failed (" + detail + "); " + suffixFor(hook)
    });
    try {
      fs.writeSync(1, text);
    } catch (writeError) {
      process.stdout.write(text);
    }
  } catch (ignored) {
    // Nothing more can be done; exit silently.
  }
  try {
    process.exit(0);
  } catch (ignoredExit) {
    // ignore
  }
}

// hook: hook name for messages; modulePath: path of the real module relative to baseDir.
// The real module must export main().
function launch(hook, modulePath, baseDir) {
  var version = nodeVersion();
  var health = null;
  try {
    health = require("./health.js");
  } catch (loadError) {
    health = null;
  }
  try {
    if (!isSupported(version)) {
      var detail = "Node " + version + " is not supported (minimum " + MIN_NODE_MAJOR + ")";
      if (health) {
        health.failOpen(hook, "unsupported-node", detail, null, { suffix: suffixFor(hook) });
      } else {
        bareWarn(hook, "unsupported-node: " + detail);
      }
      return;
    }
    require(path.join(baseDir, modulePath)).main();
  } catch (err) {
    if (health) {
      health.failOpen(hook, "launch-error", "could not start", err, { suffix: suffixFor(hook) });
    } else {
      bareWarn(hook, "launch-error");
    }
  }
}

module.exports = {
  MIN_NODE_MAJOR: MIN_NODE_MAJOR,
  nodeVersion: nodeVersion,
  isSupported: isSupported,
  launch: launch
};
