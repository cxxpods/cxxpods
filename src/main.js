
import * as Repo from './repo/Repo'
import GetLogger from './Log'

const
  log = GetLogger(__filename)
let
  Yargs = require("yargs")


function addCommands(file) {
  const mod = require(file)
  Yargs = mod.default ? mod.default(Yargs) : mod(Yargs)
}

Repo.firstTimeInit().then(() => {
  try {
    [
      "./commands/RepoCommands",
      "./commands/ProjectCommands",
      "./commands/InfoCommands"
    ].forEach(addCommands)
    
    Yargs.demandCommand(1, "You need at least one command before moving on")
      .argv
  } catch (ex) {
    log.error(`Failed`,ex)
    console.error(ex)
  }
})

