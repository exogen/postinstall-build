#!/bin/bash

set -e

# Cleanup.
rm -rf node_modules

# Reset modified package.json files.
git checkout -- package-*/package.json
