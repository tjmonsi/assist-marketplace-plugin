// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Hook entry point. ES5 syntax only: the Node version gate in lib/launch.js runs before the real
// module (impl/confirmation-record.js) is loaded, so an unsupported Node prints a warning instead of a SyntaxError.
// Fail-open for the prompt, fail-closed for the confirmation: any failure lets the user's message through and
// writes no confirmation record, so the PR-verdict guard has nothing to allow (see lib/health.js). Never exits 2.
"use strict";
try {
  require("./lib/launch.js").launch("confirmation-record", "impl/confirmation-record.js", __dirname);
} catch (err) {
  try {
    require("fs").writeSync(
      1,
      '{"systemMessage":"assist-plugin confirmation-record hook failed (launch-error); your confirmation was not recorded"}'
    );
  } catch (writeError) {
    // exit silently
  }
  process.exit(0);
}
