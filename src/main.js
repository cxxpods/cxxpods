
const
  Yargs = require("yargs"),
  Path = require("path")

Yargs
  .command(require("./repo/index"))
  .command(require("./configure/index"))
  .demandCommand(1, "You need at least one command before moving on")
  .argv

//console.log(`Add url: ${argv.url}`,argv)

//Yargs.help()
//Yargs.help
//console.log("Hello")