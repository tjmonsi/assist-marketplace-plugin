// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Shared by the Bash guards: finds the program word of a split command after leading VAR=value words and
// wrappers (env, command, timeout, nice, nohup, stdbuf, time). Pure: no I/O.
"use strict";

const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const DURATION = /^\d+(\.\d+)?[smhd]?$/;

// Wrappers that may precede the program. Each entry lists the options that consume a separate value.
const WRAPPERS = new Map([
  ["env", new Set(["-u", "--unset", "-C", "--chdir"])],
  ["command", new Set()],
  ["timeout", new Set(["-s", "--signal", "-k", "--kill-after"])],
  ["nice", new Set(["-n", "--adjustment"])],
  ["nohup", new Set()],
  ["stdbuf", new Set(["-i", "-o", "-e"])],
  ["time", new Set(["-f", "--format", "-o", "--output"])],
]);

function defaultBaseName(word) {
  return word.split("/").pop();
}

// Skips VAR=value words and wrappers. Returns the index of the program word, whether an endpoint variable
// (a word matching options.isEndpoint, if given) was assigned on the way, or -1 when no program is found.
// options (all optional): {wrappers: Map of extra wrappers, keywords: words to skip, baseName: word -> name,
// isEndpoint: assignment word -> boolean}.
function findProgram(words, options) {
  const opts = options || {};
  const baseName = opts.baseName || defaultBaseName;
  const keywords = opts.keywords || [];
  const extra = opts.wrappers || new Map();
  let endpointAssigned = false;
  let i = 0;
  while (i < words.length) {
    const word = words[i];
    if (ENV_ASSIGNMENT.test(word)) {
      if (opts.isEndpoint && opts.isEndpoint(word)) endpointAssigned = true;
      i++;
      continue;
    }
    if (keywords.indexOf(word) !== -1) {
      i++;
      continue;
    }
    const name = baseName(word);
    const wrapper = extra.get(name) || WRAPPERS.get(name);
    if (wrapper === undefined) return { index: i, endpointAssigned };
    i++;
    // Skip the wrapper's own options (and their values); a duration follows timeout's options.
    while (i < words.length && words[i].startsWith("-")) {
      if (words[i] === "--") {
        i++;
        break;
      }
      i += wrapper.has(words[i]) ? 2 : 1;
    }
    if (name === "timeout" && i < words.length && DURATION.test(words[i])) i++;
  }
  return { index: -1, endpointAssigned };
}

module.exports = { ENV_ASSIGNMENT, WRAPPERS, findProgram };
