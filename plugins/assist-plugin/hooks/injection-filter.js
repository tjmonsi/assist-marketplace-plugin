// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Hook entry point. ES5 syntax only: the Node version gate in lib/launch.js runs before the real
// module (impl/injection-filter.js) is loaded, so an unsupported Node prints a warning instead of a SyntaxError.
// Fail-open: any failure lets the content through unchanged (see lib/health.js). Never exits 2.
"use strict";
try {
  require("./lib/launch.js").launch("injection-filter", "impl/injection-filter.js", __dirname);
} catch (err) {
  try {
    require("fs").writeSync(
      1,
      '{"systemMessage":"assist-plugin injection-filter hook failed (launch-error); this content was not filtered"}'
    );
  } catch (writeError) {
    // exit silently
  }
  process.exit(0);
}
