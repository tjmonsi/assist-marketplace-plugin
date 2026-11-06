// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Hook entry point. ES5 syntax only: the Node version gate in lib/launch.js runs before the real
// module (impl/data-access-log.js) is loaded, so an unsupported Node prints a warning instead of a SyntaxError.
// [FR-230] Always-log, never deny: any failure lets the tool call proceed and the access goes unlogged (see lib/health.js).
// Never exits 2.
"use strict";
try {
  require("./lib/launch.js").launch("data-access-log", "impl/data-access-log.js", __dirname);
} catch (err) {
  try {
    require("fs").writeSync(
      1,
      '{"systemMessage":"assist-plugin data-access-log hook failed (launch-error); this access was not logged"}'
    );
  } catch (writeError) {
    // exit silently
  }
  process.exit(0);
}
