// Hook entry point. ES5 syntax only: the Node version gate in lib/launch.js runs before the real
// module (impl/health-check.js) is loaded, so an unsupported Node prints a warning instead of a SyntaxError.
// Fail-open: any failure lets the command proceed (see lib/health.js). Never exits 2.
"use strict";
try {
  require("./lib/launch.js").launch("health-check", "impl/health-check.js", __dirname);
} catch (err) {
  try {
    require("fs").writeSync(
      1,
      '{"systemMessage":"assist-plugin health-check hook failed (launch-error); the health check did not run"}'
    );
  } catch (writeError) {
    // exit silently
  }
  process.exit(0);
}
