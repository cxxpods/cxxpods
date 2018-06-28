
const sh = require('shelljs')

module.exports = {
  exists(path) {
    return sh.test('-f',path)
  },
  
  isDirectory(path) {
    return sh.test('-d', path)
  },
  
  mkdirs(path) {
    sh.mkdir('-p',path)
    return isDirectory(path)
  }
}