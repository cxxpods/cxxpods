#!/usr/bin/env node
require("source-map-support").install()
require("babel-polyfill");

const Path = require("path")

require(Path.resolve(__dirname,"..","dist","main.js"))