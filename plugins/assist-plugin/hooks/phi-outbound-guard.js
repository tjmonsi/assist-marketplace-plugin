// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Toni-Jan Keith Monserrat
// Hook entry point. ES5 syntax only: the Node version gate in lib/launch.js runs before the real
// module (impl/phi-outbound-guard.js) is loaded, so an unsupported Node prints a warning instead of a SyntaxError.
// [FR-233|NFR-028] Security-critical guard: once the input is parsed, a failure of the guard denies a WebFetch call or a
// PR-post command (see lib/health.js). A failure of this launcher before the module runs lets the call proceed with a
// systemMessage. Never exits 2.
"use strict";
try {
  require("./lib/launch.js").launch("phi-outbound-guard", "impl/phi-outbound-guard.js", __dirname);
} catch (err) {
  try {
    require("fs").writeSync(
      1,
      '{"systemMessage":"assist-plugin phi-outbound-guard hook failed (launch-error); this call was not checked"}'
    );
  } catch (writeError) {
    // exit silently
  }
  process.exit(0);
}
