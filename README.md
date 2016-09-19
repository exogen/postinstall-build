[![Travis Status][trav_img]][trav_site]

# postinstall-build

```shell
npm install postinstall-build --save
```

## What it does:

1. Check if your build artifacts exist
2. If not, temporarily install `devDependencies` and build
3. Clean up anything left behind... and that's it!

## Usage

```shell
postinstall-build <PATH_TO_BUILD_ARTIFACT> <BUILD_COMMAND>
```

## Explanation

Sometimes you want to install or depend on a package from someplace other than
npm – for example, from a `git` URL. If the package needs to be transpiled by
a tool like Babel, then this can be tricky: most people put their build step in
the `version` or `prepublish` hooks, and if you're not installing from npm then
this step probably wasn't run (unless the build artifacts are checked into
source).

One solution is to add a check to the package's `postinstall` hook: if the
build artifacts don't exist, then build! The annoying part is that this
necessitates having your build dependencies (like Babel or webpack) available –
in other words, they'd need to be production `dependencies` instead of
`devDependencies`, even though the module itself doesn't `require` them (unlike
real dependencies, they're only used in the build step). That means even
everyone installing from npm wastes time installing them, even though they
already have the build artifacts!

This helper fixes that. Just tell it where a build artifact is and what your
build step is, and it'll do the rest. Used as intended, `postinstall-build`
should be a production `dependency`.

Here's an example using Babel:

```json
{
  "scripts": {
    "build-lib": "babel -d lib src",
    "postinstall": "postinstall-build lib 'npm run build-lib'"
  },
  "dependencies": {
    "postinstall-build": "0.2.x"
  },
  "devDependencies": {
    "babel": "5.x.x"
  }
}
```

The `postinstall-build` helper will check whether the first argument, `lib`,
exists. If not, it will run the second argument, `npm run build-lib`. Because
`build-lib` requires Babel, a dev dependency, it will run
`npm install --only=dev` before building. When the build is done, it will run
`npm prune --production` to clean up. That's it!

[trav_img]: https://travis-ci.org/exogen/postinstall-build.svg
[trav_site]: https://travis-ci.org/exogen/postinstall-build
