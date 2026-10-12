// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Hook entry point. ES5 syntax only: the Node version gate in lib/launch.js runs before the real
// module (impl/prose-advisor.js) is loaded, so an unsupported Node prints a warning instead of a SyntaxError.
// Fail-open: any failure lets the write stand without advice (see lib/health.js). Never exits 2.
"use strict";
try {
  require("./lib/launch.js").launch("prose-advisor", "impl/prose-advisor.js", __dirname);
} catch (err) {
  try {
    require("fs").writeSync(
      1,
      '{"systemMessage":"assist-plugin prose-advisor hook failed (launch-error); this write was not reviewed"}'
    );
  } catch (writeError) {
    // exit silently
  }
  process.exit(0);
}
