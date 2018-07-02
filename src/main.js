
const
  Yargs = require("yargs"),
  Repo = require("./repo/Repo"),
  {GetLogger} = require("./Log"),
  log = GetLogger(__filename)

Repo.firstTimeInit().then(() => {
  try {
    Yargs
      .command(require("./commands/RepoCommands"))
      .command(require("./commands/ProjectCommands"))
      .demandCommand(1, "You need at least one command before moving on")
      .argv
  } catch (ex) {
    log.error(`Failed`,ex)
  }
})

