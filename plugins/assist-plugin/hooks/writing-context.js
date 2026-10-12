// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Hook entry point. ES5 syntax only: the Node version gate in lib/launch.js runs before the real
// module (impl/writing-context.js) is loaded, so an unsupported Node prints a warning instead of a SyntaxError.
// Fail-open: any failure adds no context and lets the session continue (see lib/health.js). Never exits 2.
"use strict";
try {
  require("./lib/launch.js").launch("writing-context", "impl/writing-context.js", __dirname);
} catch (err) {
  try {
    require("fs").writeSync(
      1,
      '{"systemMessage":"assist-plugin writing-context hook failed (launch-error); the writing standard was not loaded"}'
    );
  } catch (writeError) {
    // exit silently
  }
  process.exit(0);
}
