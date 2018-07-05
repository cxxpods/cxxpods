#!/usr/bin/env node

//require("babel-core/register");
require("babel-polyfill");

const Path = require("path")

require(Path.resolve(__dirname,"..","dist","main.js"))