#!/usr/bin/env node
require("source-map-support").install()
require("babel-polyfill")

const
  Events = require("events"),
  Path = require("path")

// noinspection JSUndefinedPropertyAssignment
Events.defaultMaxListeners = 100
require(Path.resolve(__dirname,"..","dist","main.js"))