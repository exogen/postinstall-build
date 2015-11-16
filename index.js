#!/usr/bin/env node
var fs = require("fs");
var exec = require("child_process").exec;

var CWD = process.cwd();
var POSTINSTALL_BUILD_CWD = process.env.POSTINSTALL_BUILD_CWD;

// If we didn't have this check, then we'd be stuck in an infinite `postinstall`
// loop, since we run `npm install --only=dev` below, triggering another
// `postinstall`. We can't use `--ignore-scripts` because that ignores scripts
// on all the modules that get installed, too, which would break stuff. So
// instead, we set an environment variable, `POSTINSTALL_BUILD_CWD`, that keeps
// track of what we're installing. It's more than just a yes/no flag because
// the dev dependencies we're installing might use `postinstall-build` too, and
// we don't want the flag to prevent them from running.
if (POSTINSTALL_BUILD_CWD !== CWD) {
  var BUILD_ARTIFACT = process.argv[2];
  var BUILD_COMMAND = process.argv[3];

  fs.stat(BUILD_ARTIFACT, function(err, stats) {
    if (err || !(stats.isFile() || stats.isDirectory())) {
      var opts = { env: process.env };
      // This script will run again after we run `npm install` below. Set an
      // environment variable to tell it to skip the check. Really we just want
      // the execSync's `env` to be modified, but it's easier just modify and
      // pass along the entire `process.env`.
      process.env.POSTINSTALL_BUILD_CWD = CWD;
      // We already have prod dependencies, that's what triggered `postinstall`
      // in the first place. So only install dev.
      exec("npm install --only=dev", opts, function(err, stdout, stderr) {
        if (err) {
          console.error(err);
          process.exit(1);
        }
        // Don't need the flag anymore as `postinstall` was already run.
        // Change it back so the environment is minimally changed for the
        // remaining commands.
        process.env.POSTINSTALL_BUILD_CWD = POSTINSTALL_BUILD_CWD;
        exec(BUILD_COMMAND, opts, function(err, stdout, stderr) {
          if (err) {
            console.error(err);
            process.exit(1);
          }
          exec("npm prune --production", opts, function(err, stdout, stderr) {
            if (err) {
              console.error(err);
              process.exit(1);
            }
          });
        })
      });
    }
  });
}
