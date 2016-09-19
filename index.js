#!/usr/bin/env node
var fs = require("fs");
var spawn = require("child_process").spawn;

// Use `spawn` to make a better `exec` without stdio buffering.
function exec(command, options, callback) {
  // Copied from npm's lib/utils/lifecycle.js
  var sh = "sh";
  var shFlag = "-c";

  var shOpts = {
    env: options.env, // We only ever pass `env`.
    stdio: options.stdio || "inherit"
  };

  // Copied from npm's lib/utils/lifecycle.js
  if (process.platform === "win32") {
    sh = process.env.comspec || "cmd";
    shFlag = "/d /s /c";
    shOpts.windowsVerbatimArguments = true;
  }

  var proc = spawn(sh, [shFlag, command], shOpts);

  function procKill() {
    proc.kill();
  }

  function procDone(err) {
    process.removeListener("SIGTERM", procKill);
    callback(err);
  }

  process.once("SIGTERM", procKill);
  proc.on("error", procDone);
  proc.on("close", function(code, signal) {
    var err;
    if (code) {
      // Behave like `exec` and construct an Error object.
      var cmdStr = [sh, shFlag, command].join(" ");
      err = new Error("Command failed: " + cmdStr + "\n");
      err.killed = signal ? true : false;
      err.code = code;
      err.signal = signal;
      err.cmd = cmdStr;
    }
    procDone(err);
  });
};

// If we were to `process.exit` immediately after logging to the console, then
// any process that is reading our output through a pipe would potentially get
// truncated output, because the pipe would be closed before it could be read.
// See: https://github.com/nodejs/node-v0.x-archive/issues/3737
function safeExit(code) {
  process.on("exit", function() {
    process.exit(code);
  });
}

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
  var BUILD_ARTIFACT;
  var BUILD_COMMAND;
  var FLAGS = {};
  for (var i = 2; i < process.argv.length; i++) {
    var arg = process.argv[i];
    if (arg === "--silent") {
      FLAGS.silent = true;
    } else if (typeof BUILD_ARTIFACT === "undefined") {
      BUILD_ARTIFACT = arg;
    } else if (typeof BUILD_COMMAND === "undefined") {
      BUILD_COMMAND = arg;
    }
  }

  fs.stat(BUILD_ARTIFACT, function(err, stats) {
    if (err || !(stats.isFile() || stats.isDirectory())) {
      var opts = { env: process.env };
      if (FLAGS.silent) {
        opts.stdio = "ignore";
      }
      // This script will run again after we run `npm install` below. Set an
      // environment variable to tell it to skip the check. Really we just want
      // the execSync's `env` to be modified, but it's easier just modify and
      // pass along the entire `process.env`.
      process.env.POSTINSTALL_BUILD_CWD = CWD;
      // We already have prod dependencies, that's what triggered `postinstall`
      // in the first place. So only install dev.
      exec("npm install --only=dev", opts, function(err) {
        if (err) {
          console.error(err);
          return safeExit(1);
        }
        // Don't need the flag anymore as `postinstall` was already run.
        // Change it back so the environment is minimally changed for the
        // remaining commands.
        process.env.POSTINSTALL_BUILD_CWD = POSTINSTALL_BUILD_CWD;
        exec(BUILD_COMMAND, opts, function(err) {
          if (err) {
            console.error(err);
            return safeExit(1);
          }
          exec("npm prune --production", opts, function(err) {
            if (err) {
              console.error(err);
              return safeExit(1);
            }
          });
        })
      });
    }
  });
}
