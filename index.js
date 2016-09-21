#!/usr/bin/env node
var fs = require('fs')
var path = require('path')
var spawn = require('child_process').spawn

// Use `spawn` to make a better `exec` without stdio buffering.
function exec (command, options, callback) {
  // Copied from npm's lib/utils/lifecycle.js
  var sh = 'sh'
  var shFlag = '-c'

  // Doesn't need to support all options, we only ever pass these two.
  var shOpts = {
    env: options.env,
    stdio: options.stdio || 'inherit'
  }

  // Copied from npm's lib/utils/lifecycle.js
  if (process.platform === 'win32') {
    sh = process.env.comspec || 'cmd'
    shFlag = '/d /s /c'
    shOpts.windowsVerbatimArguments = true
  }

  var proc = spawn(sh, [shFlag, command], shOpts)
  var done = false

  function procKill () {
    proc.kill()
  }

  function procDone (err) {
    if (!done) {
      done = true
      process.removeListener('SIGTERM', procKill)
      callback(err)
    }
  }

  process.once('SIGTERM', procKill)
  proc.on('error', procDone)
  proc.on('close', function (code, signal) {
    var err
    if (code) {
      // Behave like `exec` and construct an Error object.
      var cmdStr = [sh, shFlag, command].join(' ')
      err = new Error('Command failed: ' + cmdStr + '\n')
      err.killed = signal != null
      err.code = code
      err.signal = signal
      err.cmd = cmdStr
    }
    procDone(err)
  })
}

// If we call `process.exit` immediately after logging to the console, then
// any process that is reading our output through a pipe would potentially get
// truncated output, because the pipe would be closed before it could be read.
// See: https://github.com/nodejs/node-v0.x-archive/issues/3737
function safeExit (code) {
  process.on('exit', function () {
    process.exit(code)
  })
}

var CWD = process.cwd()
var POSTINSTALL_BUILD_CWD = process.env.POSTINSTALL_BUILD_CWD || ''

// If we didn't have this check, then we'd be stuck in an infinite `postinstall`
// loop, since we run `npm install --only=dev` below, triggering another
// `postinstall`. We can't use `--ignore-scripts` because that ignores scripts
// in all the modules that get installed, too, which would break stuff. So
// instead, we set an environment variable, `POSTINSTALL_BUILD_CWD`, that keeps
// track of what we're installing. It's more than just a yes/no flag because
// the dev dependencies we're installing might use `postinstall-build` too, and
// we don't want the flag to prevent them from running.
if (POSTINSTALL_BUILD_CWD !== CWD) {
  var BUILD_ARTIFACT
  var BUILD_COMMAND
  var FLAGS = {}
  for (var i = 2; i < process.argv.length; i++) {
    var arg = process.argv[i]
    if (arg === '--silent') {
      FLAGS.silent = true
    } else if (arg === '--script') {
      // Consume the next argument.
      FLAGS.script = process.argv[++i]
    } else if (arg.indexOf('--script=') === 0) {
      FLAGS.script = arg.slice(9)
    } else if (BUILD_ARTIFACT == null) {
      BUILD_ARTIFACT = arg
    } else if (BUILD_COMMAND == null) {
      BUILD_COMMAND = arg
    }
  }

  if (FLAGS.script != null) {
    // Hopefully people aren't putting special characters that need escaping
    // in their script names. If they are, they can take care of escaping it
    // themselves when they supply `--script`.
    BUILD_COMMAND = 'npm run ' + FLAGS.script
  } else if (BUILD_COMMAND == null) {
    // If no command or script was given, run the 'build' script.
    BUILD_COMMAND = 'npm run build'
  }

  if (BUILD_ARTIFACT == null) {
    throw new Error('A build artifact must be supplied to postinstall-build.')
  }

  fs.stat(BUILD_ARTIFACT, function (err, stats) {
    if (err || !(stats.isFile() || stats.isDirectory())) {
      // After building, we almost always want to prune back to the production
      // dependencies, so that the transient development dependencies aren't
      // left behind. The only reason we wouldn't want to prune is if we're the
      // top-level package being `npm install`ed with no arguments for
      // development or testing purposes. If we're the `postinstall` script of a
      // dependency, we should always prune. Unfortunately, npm doesn't set
      // any helpful environment variables to indicate whether we're being
      // installed as a dependency or not. The best we can do is check whether
      // the parent directory is `node_modules`.
      var isDependency = path.basename(path.dirname(CWD)) === 'node_modules'
      // If we're the top-level package being `npm install`ed with no
      // arguments, we still might want to prune if certain flags indicate that
      // only production dependencies were requested.
      var isProduction = (process.env.npm_config_production === 'true' &&
                          process.env.npm_config_only !== 'development' &&
                          process.env.npm_config_only !== 'dev')
      var isOnlyProduction = (process.env.npm_config_only === 'production' ||
                              process.env.npm_config_only === 'prod')
      var prune = isDependency || isProduction || isOnlyProduction

      // This script will run again after we run `npm install` below. Set an
      // environment variable to tell it to skip the check. Really we just want
      // the spawned child's `env` to be modified, but it's easier just modify
      // and pass along our entire `process.env`.
      process.env.POSTINSTALL_BUILD_CWD = CWD

      var opts = { env: process.env }
      if (FLAGS.silent) {
        opts.stdio = 'ignore'
      }

      // We already have prod dependencies, that's what triggered `postinstall`
      // in the first place. So only install dev.
      exec('npm install --only=dev', opts, function (err) {
        if (err) {
          console.error(err)
          return safeExit(1)
        }
        // Don't need the flag anymore as `postinstall` was already run.
        // Change it back so the environment is minimally changed for the
        // remaining commands.
        process.env.POSTINSTALL_BUILD_CWD = POSTINSTALL_BUILD_CWD
        exec(BUILD_COMMAND, opts, function (err) {
          if (err) {
            console.error(err)
            return safeExit(1)
          }
          if (prune) {
            exec('npm prune --production', opts, function (err) {
              if (err) {
                console.error(err)
                return safeExit(1)
              }
            })
          }
        })
      })
    }
  })
}
