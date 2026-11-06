// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Hook entry point. ES5 syntax only: the Node version gate in lib/launch.js runs before the real
// module (impl/pr-verdict-guard.js) is loaded, so an unsupported Node prints a warning instead of a SyntaxError.
// Security-critical guard (NFR-028): once the input is parsed, a failure of the guard denies a command that looks like a
// PR verdict post (see lib/health.js). A failure of this launcher before the module runs lets the command proceed with a
// systemMessage. Never exits 2.
"use strict";
try {
  require("./lib/launch.js").launch("pr-verdict-guard", "impl/pr-verdict-guard.js", __dirname);
} catch (err) {
  try {
    require("fs").writeSync(
      1,
      '{"systemMessage":"assist-plugin pr-verdict-guard hook failed (launch-error); this command was not checked"}'
    );
  } catch (writeError) {
    // exit silently
  }
  process.exit(0);
}
