const
  Fs = require("fs"),
  Path = require("path"),
  pkgTxt = Fs.readFileSync(Path.resolve(__dirname,"..","package.json"),'utf8'),
  pkgJson = JSON.parse(pkgTxt)

console.log(pkgJson.version)


