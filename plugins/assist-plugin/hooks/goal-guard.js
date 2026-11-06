// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Hook entry point. ES5 syntax only: the Node version gate in lib/launch.js runs before the real
// module (impl/goal-guard.js) is loaded, so an unsupported Node prints a warning instead of a SyntaxError.
// Fail-open: any failure lets the tool result through unchanged and unrecorded (see lib/health.js). Never exits 2.
"use strict";
try {
  require("./lib/launch.js").launch("goal-guard", "impl/goal-guard.js", __dirname);
} catch (err) {
  try {
    require("fs").writeSync(
      1,
      '{"systemMessage":"assist-plugin goal-guard hook failed (launch-error); this result was not checked for goal hijack"}'
    );
  } catch (writeError) {
    // exit silently
  }
  process.exit(0);
}
