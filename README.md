[![Travis Status](https://travis-ci.org/exogen/postinstall-build.svg)](https://travis-ci.org/exogen/postinstall-build)
[![AppVeyor Status](https://ci.appveyor.com/api/projects/status/github/exogen/postinstall-build?svg=true)](https://ci.appveyor.com/project/exogen/postinstall-build)
[![Greenkeeper badge](https://badges.greenkeeper.io/exogen/postinstall-build.svg)](https://greenkeeper.io/)
[![npm Version](https://img.shields.io/npm/v/postinstall-build.svg)](https://www.npmjs.com/package/postinstall-build)
[![npm Downloads](https://img.shields.io/npm/dm/postinstall-build.svg)](https://www.npmjs.com/package/postinstall-build)

# postinstall-build

⚠️ **NOTE! As of npm 5.0.0 (2017-05-25), this functionality is built into npm!** The new `prepare` lifecycle script will build your package when installed from git. If possible, I recommend migrating off of `postinstall-build` and onto the officially supported `prepare`. It works much better!

Conditionally build in the `postinstall` hook without moving your
`devDependencies` to `dependencies`.

```console
npm install postinstall-build --save
```

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
## Contents

- [What does it do?](#what-does-it-do)
- [Why?](#why)
- [Usage](#usage)
  - [Options](#options)
    - [Specifying build dependencies in package.json](#specifying-build-dependencies-in-packagejson)
- [Examples](#examples)
- [Motivation](#motivation)
- [Caveats](#caveats)
  - [Bugs in Yarn](#bugs-in-yarn)
  - [Bugs in npm](#bugs-in-npm)
  - [Excluding source files via `.npmignore` or `files`](#excluding-source-files-via-npmignore-or-files)
  - [Building a file referenced by package.json `bin`](#building-a-file-referenced-by-packagejson-bin)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## What does it do?

1. Check if your build artifacts exist.
2. If not, temporarily install `devDependencies` and build.
3. Clean up anything left behind… and that’s it!

## Why?

So that your package with a build step can support Git (and other non-npm)
install locations without checking build artifacts into source control or making
everyone install your build dependencies. See [Motivation](#motivation) for more
details.

## Usage

```console
postinstall-build [options] <artifact> [command]
```

### Options

* `--script`: Run the given npm script from `package.json` instead of supplying
  a full build command. Specified like: `--script name` or `--script=name`. This
  is the **recommended** way to supply the build command if it is an npm script,
  because it is guaranteed to use the same `$npm_execpath` that triggered
  `postinstall` (as opposed to potentially using an incompatible version of npm
  installed in `node_modules` by a dependency), if the user agent is npm.
* `--only-as-dependency`: Run only if the package is being installed as a
  dependency, not if `npm install` (no args) is being run in the package’s own
  directory (usually while you are developing the package itself).
* `--silent`: Silence the build command’s stdout and stderr, as well as any
  warnings from `postinstall-build` itself. Fatal errors will still be printed.
  Note that this may make debugging much more difficult if something goes wrong.
  Overrides `--verbose` (the last one specified wins).
* `--verbose`: Print information about what `postinstall-build` is doing and
  why (as well as the usual warnings and errors). Overrides `--silent` (the last
  one specified wins).

If neither `command` nor `--script` is supplied, the build command defaults to
`npm run build`.

An `artifact` path is required. It should point to a file or directory that
will be generated by the build command. If the file already exists, the build
command won’t be run. The build artifact should almost certainly be included
in the published npm package, so that normal installs from the npm registry don’t
trigger a build (you can build in the `prepublish` hook, for example). If you want
to always build, you may pass a bogus file path, but this is **not recommended**
(if you’re always going to build, just make your `devDependencies` real
`dependencies` instead of using `postinstall-build`).

Note that if your `command` contains arguments (and thus has spaces), you should
wrap it in escaped double quotes (`\"`) instead of single quotes for maximum
portability – Windows does not treat single-quoted strings as a single
parameter. (This is the case in any npm script regardless of `postinstall-build`
usage.)

#### Specifying build dependencies in package.json

If you specify a `buildDependencies` array in `package.json`, you can control
which dependencies are installed before your build command is run. `buildDependencies`
must be an array of package names that also appear in `devDependencies`. If a
package named in `buildDependencies` does not exist in `devDependencies`, then
it is assumed to already be available (as a global, peer, or production
dependency), will not be installed, and a warning will be printed.

## Examples

Run the `build` script (the default) if `lib` doesn’t exist during `postinstall`:

```json
{
  "scripts": {
    "build": "babel --presets es2015 --out-dir lib src",
    "postinstall": "postinstall-build lib"
  },
  "dependencies": {
    "postinstall-build": "^3.0.0"
  },
  "devDependencies": {
    "babel-cli": "^6.0.0",
    "babel-preset-es2015": "^6.0.0"
  }
}
```


Run a different script:

```json
{
  "scripts": {
    "build:lib": "babel --presets=es2015 --out-dir=lib src",
    "postinstall": "postinstall-build lib --script build:lib"
  }
}
```

Run a non-npm script:

```json
{
  "scripts": {
    "postinstall": "postinstall-build dist \"make dist\""
  }
}
```

Install only the necessary build dependencies:

```json
{
  "scripts": {
    "build": "babel --presets es2015 --out-dir lib src",
    "postinstall": "postinstall-build lib"
  },
  "dependencies": {
    "postinstall-build": "^3.0.0"
  },
  "devDependencies": {
    "ava": "latest",
    "babel-cli": "^6.0.0",
    "babel-preset-es2015": "^6.0.0",
    "nyc": "latest",
    "prettier": "latest"
  },
  "buildDependencies": [
    "babel-cli",
    "babel-preset-es2015"
  ]
}
```

---

⚠️ **INCORRECT USAGE** ⚠️

```json
{
  "scripts": {
    "build": "babel --presets es2015 --out-dir lib src",
    "postinstall": "postinstall-build \"npm run build\""
  }
}
```

This example is missing a build artifact – or rather, `npm run build` is
mistakenly being passed as the build artifact. Since that file will never exist,
the build task is always run. Since `npm run build` is provided as the build
artifact and not the build command, the default build command is used – which
happens to also be `npm run build`. Things will appear to work, but in fact it
is building on every `postinstall` unconditionally. `postinstall-build` will
issue a warning if it suspects the arguments are incorrect.

---

## Motivation

Sometimes you want to install or depend on a package from someplace other than
npm – for example, from a `git` URL. If the package needs to be transpiled by
a tool like Babel, then this can be tricky: most people put their build step in
the `version` or `prepublish` hooks, and if you’re not installing from npm then
this step probably wasn’t run (unless the build artifacts are checked into
source control).

One solution is to add a check to the package’s `postinstall` hook: if the
build artifacts don’t exist, then build! The annoying part is that this
necessitates having your build dependencies (like Babel or webpack) available –
in other words, they’d need to be production `dependencies` instead of
`devDependencies`, even though the module itself doesn’t `require` them (unlike
real dependencies, they’re only used in the build step). That means even
everyone installing from npm wastes time installing them, even though they
already have the build artifacts!

This helper fixes that. Just tell it where a build artifact is and what your
build step is, and it’ll do the rest. Used as intended, `postinstall-build`
should be in `dependencies`.

## Caveats

### Bugs in Yarn

* **'your-package' is not in the npm registry.**

  Yarn will read your custom registry setting from `.npmrc`, but fails to
  communicate this via the `$npm_config_registry` environment variable. So any
  `npm` commands that were triggered by a Yarn install (like those run by
  `postinstall-build`) pick up Yarn‘s default `$npm_config_registry` setting
  instead of the one specified in `.npmrc`.

  For the time being you can solve this by adding a `.yarnrc` file alongside your
  `.npmrc`, which will cause `$npm_config_registry` to behave as expected.

### Bugs in npm

**I recommend using npm 3 or better, except for npm 4.1.x–4.5.x.**

There are several distinct bugs in npm itself that you may encounter when using
`postinstall-build` with npm 2. I have not been able to work around these nor
even reproduce them locally; they are especially prevalent on the combination
of Node 0.12, npm 2, and the Docker environment used by Travis. To the best of
my knowledge they are no fault of this package and are widely reported npm bugs.

* **extraneous packages**

  The `prune` command is broken in npm 4.1.x–4.5.x, and is unable to correctly
  prune `devDependencies`. Thus, when `postinstall-build` is finishing up, it
  leaves behind extraneous packages. (See issues [#15727](https://github.com/npm/npm/issues/15727),
  [#15669](https://github.com/npm/npm/issues/15669), [#15646](https://github.com/npm/npm/issues/15646).)

* **postinstall-build: not found**

  Sometimes npm triggers `postinstall` when a package’s dependencies aren’t
  actually available yet.

* **Callback called more than once.**

  npm has some faulty async code. This message comes from within the npm
  codebase and does not refer to any callbacks within `postinstall-build`.

* **ENOENT during npm prune**

  npm is probably trying to prune a file that was already removed or never
  existed. Seems to happen when there is a larger `devDependency` tree to prune.

* **ECONNRESET**

  npm has trouble making lots of connections to its own registry. You can use
  `npm config set fetch-retries 5` (for example) to work around this; using the
  non-HTTPS registry might also help.

### Excluding source files via `.npmignore` or `files`

When npm installs from a Git repository or any other non-package location, it
will first prepare the directory as if it were publishing a package. This
includes respecting the `.npmignore` file and `files` field in `package.json`,
which means that `postinstall` scripts may be executed with a subset of the
files you need to run your build step. Thus, in order for `postinstall-build`
to work, you should **not** ignore the source files or any necessary
configuration (for example, `.babelrc`).

This is not ideal, but it’s how npm works. If you are determined to exclude
unnecessary source and configuration files from the published npm package,
you may want to consider a publishing step that alters the `.npmignore` or
`files` settings.

### Building a file referenced by package.json `bin`

If your `package.json` file uses the `bin` field, and any of the referenced
files do not exist before building, you may see an error like this:

```console
ENOENT: no such file or directory, chmod '[…]/lib/index.js'
```

This happens because npm needs to symlink any files referenced in the `bin`
field and make them executable, but this step is performed before `postinstall`.
`postinstall-build` can’t do anything to address this shortcoming, but there is
an easy workaround. Create a simple non-built file (that is, not created during
the build step) that imports the built file you actually want to target. For
example, you could create a top-level file called `cli.js` like so:

```js
require('./lib/index');
```

Or, export the program’s behavior in a function and call it:

```js
require('./lib/index').run();
```

Make sure to update your `bin` field to the new file (in this case, `cli.js`)
and include it in your npm package and repository.
