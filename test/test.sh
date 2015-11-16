#!/bin/sh -e

# Each test package specifies other test packages as dependencies using a
# relative path to the package. But relative paths don't behave the same
# across npm versions when actually trying to install. Nothing I tried worked
# across npm versions, so the nuclear option is to just update every test
# package.json with absolute paths.
node fix-relative-deps.js package-*/package.json

rm -rf node_modules
npm install
npm ls && echo "OK, no extraneous deps"
node -e "require('package-c')" && echo "OK, c worked"
node -e "require('package-d')" && echo "OK, d worked"
rm -rf node_modules

# Reset modified package.json files.
git checkout -- package-*/package.json
