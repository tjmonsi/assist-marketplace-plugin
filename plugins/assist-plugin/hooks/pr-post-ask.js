// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Hook entry point. ES5 syntax only: the Node version gate in lib/launch.js runs before the real
// module (impl/pr-post-ask.js) is loaded, so an unsupported Node prints a warning instead of a SyntaxError.
// Fail-open: any failure lets the command proceed (see lib/health.js). Never exits 2.
"use strict";
try {
  require("./lib/launch.js").launch("pr-post-ask", "impl/pr-post-ask.js", __dirname);
} catch (err) {
  try {
    require("fs").writeSync(
      1,
      '{"systemMessage":"assist-plugin pr-post-ask hook failed (launch-error); this command was not checked"}'
    );
  } catch (writeError) {
    // exit silently
  }
  process.exit(0);
}
