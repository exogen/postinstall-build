#!/bin/bash

EXIT_STATUS=0

# Each test package specifies other test packages as dependencies using a
# relative path to the package. But relative paths don't behave the same
# across npm versions when actually trying to install. Nothing I tried worked
# across npm versions, so the nuclear option is to just update every test
# package.json with absolute paths.
node fix-relative-deps.js package-*/package.json

# In case cleanup failed before.
rm -rf node_modules

npm install && \
  npm ls && \
  node -e "require('package-c')" && \
  node -e "require('package-d')" && \
  npm run test:cowsay && \
  echo "OK"

EXIT_STATUS=$?

./reset.sh

exit $EXIT_STATUS
