
const
  Yargs = require("yargs"),
  Repo = require("./repo/Repo")

Repo.firstTimeInit().then(() => {
  Yargs
    .command(require("./commands/RepoCommands"))
    .command(require("./commands/ProjectCommands"))
    .demandCommand(1, "You need at least one command before moving on")
    .argv
  
})

