
const
  Fs = require('fs'),
  Yaml = require('js-yaml'),
  sh = require('shelljs')

function exists(path) {
  return sh.test('-f',path)
}

function isDirectory(path) {
  return sh.test('-d', path)
}

function mkdirs(path) {
  sh.mkdir('-p',path)
  return isDirectory(path)
}

function readFile(path) {
  if (!exists(path))
    throw `Unable to find: ${path}`
  
  return Fs.readFileSync(path,'utf-8')
}

function readFileJson(path) {
  return JSON.parse(readFile(path))
}

function readFileYaml(path) {
  return Yaml.safeLoad(readFile(path))
}

function writeFile(path,content) {
  Fs.writeFileSync(path,content,'utf-8')
}

module.exports = {
  exists,
  isDirectory,
  mkdirs,
  readFile,
  readFileJson,
  readFileYaml,
  writeFile
}