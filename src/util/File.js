
const
  Fs = require('fs'),
  Path = require('path'),
  Yaml = require('js-yaml'),
  sh = require('shelljs'),
  _ = require("lodash")

export function exists(path) {
  return sh.test('-f',path)
}

export function isDirectory(path) {
  return sh.test('-d', path)
}

export function mkdirs(path) {
  if (!isDirectory(path))
    sh.mkdir('-p',path)
  
  return isDirectory(path)
}

export function mkdirParents(path) {
  const parts = _.split(path,"/")
  parts.pop()
  const parentPath = parts.join("/")
  return mkdirs(parentPath)
}

export function readFile(path) {
  if (!exists(path))
    throw `Unable to find: ${path}`
  
  return Fs.readFileSync(path,'utf-8')
}

export function readFileProperties(path) {
  const content = readFile(path)
  
  return _.split(content,"\n")
    .filter(line => !_.isEmpty(line) && line.indexOf('=') > -1)
    .reduce((props,line) => {
      const
        index = line.indexOf('='),
        key = line.substring(0,index)
      
      props[key] = line.substring(index + 1)
      return props
    },{})
}

export function readFileJSON(path) {
  return JSON.parse(readFile(path))
}

export function readFileYaml(path) {
  return Yaml.safeLoad(readFile(path))
}

export function readAsset(assetPath) {
  return readFile(Path.resolve(__dirname,"..","..","src","assets",assetPath))
}

export function writeFile(path,content) {
  Fs.writeFileSync(path,content,'utf-8')
}

export function writeFileJSON(path,obj,formatted = false) {
  Fs.writeFileSync(path,JSON.stringify(obj,null,formatted ? 4 : 0),'utf-8')
}

export function getFileModifiedTimestamp(path, timestamp = 0) {
  if (!exists(path) && !isDirectory(path))
    return timestamp
  
  if (!isDirectory(path)) {
    return Math.max(Fs.statSync(path).mtimeMs, timestamp)
  } else {
    Fs.readdirSync(path)
      .filter(it => !it.startsWith("."))
      .forEach(it => {
        timestamp = Math.max(timestamp, getFileModifiedTimestamp(`${path}/${it}`, timestamp))
      })
  }
  return timestamp
}

export function fixPath(path) {
  return path.replace(/\\/g,'/')
}

export default {
  exists,
  isDirectory,
  mkdirs,
  mkdirParents,
  readAsset,
  readFile,
  readFileProperties,
  readFileJson: readFileJSON,
  readFileYaml,
  writeFile,
  writeFileJSON,
  getFileModifiedTimestamp
}