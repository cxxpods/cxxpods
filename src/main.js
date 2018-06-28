
const Yargs = require("yargs")

const argv = Yargs
  .command("repo","Repo management", require("./repo"))
  .demandCommand(1, "You need at least one command before moving on")
  // .usage("$0 <command>", "Execute cunit command", argv => {
  //   console.log("You must provide a command")
  // })
  .argv

//console.log(`Add url: ${argv.url}`,argv)

//Yargs.help()
//Yargs.help
//console.log("Hello")