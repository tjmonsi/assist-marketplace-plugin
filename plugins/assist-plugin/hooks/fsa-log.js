// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Hook entry point. ES5 syntax only: the Node version gate in lib/launch.js runs before the real
// module (impl/fsa-log.js) is loaded, so an unsupported Node prints a warning instead of a SyntaxError.
// Fail-open: any failure leaves the subagent report unchecked and the run unchanged (see lib/health.js). Never exits 2.
"use strict";
try {
  require("./lib/launch.js").launch("fsa-log", "impl/fsa-log.js", __dirname);
} catch (err) {
  try {
    require("fs").writeSync(
      1,
      '{"systemMessage":"assist-plugin fsa-log hook failed (launch-error); this subagent report was not checked"}'
    );
  } catch (writeError) {
    // exit silently
  }
  process.exit(0);
}
