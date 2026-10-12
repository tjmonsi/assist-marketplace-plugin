// Hook entry point. ES5 syntax only: the Node version gate in lib/launch.js runs before the real
// module (impl/doc-cli-guard.js) is loaded, so an unsupported Node prints a warning instead of a SyntaxError.
// Fail-open: any failure lets the command proceed (see lib/health.js). Never exits 2.
"use strict";
try {
  require("./lib/launch.js").launch("doc-cli-guard", "impl/doc-cli-guard.js", __dirname);
} catch (err) {
  try {
    require("fs").writeSync(
      1,
      '{"systemMessage":"assist-plugin doc-cli-guard hook failed (launch-error); this command was not checked"}'
    );
  } catch (writeError) {
    // exit silently
  }
  process.exit(0);
}
