// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Hook entry point. ES5 syntax only: the Node version gate in lib/launch.js runs before the real
// module (impl/purpose-capture.js) is loaded, so an unsupported Node prints a warning instead of a SyntaxError.
// [FR-247] Fail-open for the prompt, no record on failure: any failure lets the user's message through and writes no
// session purpose record, so the access log shows the purpose as "unstated". Never exits 2.
"use strict";
try {
  require("./lib/launch.js").launch("purpose-capture", "impl/purpose-capture.js", __dirname);
} catch (err) {
  try {
    require("fs").writeSync(
      1,
      '{"systemMessage":"assist-plugin purpose-capture hook failed (launch-error); your session purpose was not recorded"}'
    );
  } catch (writeError) {
    // exit silently
  }
  process.exit(0);
}
