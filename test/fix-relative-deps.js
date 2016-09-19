#!/usr/bin/env node
var fs = require('fs')
var path = require('path')

function fixVersion (dirname, version) {
  if (version.indexOf('..') !== -1) {
    return path.resolve(dirname, version)
  }
  return version
}

var filename
var dirname
var json
var key

for (var i = 2; i < process.argv.length; i++) {
  filename = process.argv[i]
  dirname = path.dirname(filename)
  json = JSON.parse(fs.readFileSync(filename))
  for (key in json.dependencies) {
    json.dependencies[key] = fixVersion(dirname, json.dependencies[key])
  }
  for (key in json.devDependencies) {
    json.devDependencies[key] = fixVersion(dirname, json.devDependencies[key])
  }
  fs.writeFileSync(filename, JSON.stringify(json, null, 2) + '\n')
}
