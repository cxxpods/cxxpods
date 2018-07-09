const
  lockfile = require("lockfile"),
  sh = require("shelljs"),
  Os = require("os"),
  Path = require("path"),
  pwd = sh.pwd(),
  lockfilePath = Path.resolve(Os.tmpdir(),`${Buffer.from(pwd).toString('base64')}.lock`)

lockfile.lock(lockfilePath, {wait: 1000 * 60 * 60 }, err => {
  
  // LOGGER
  const
    GetLogger = require("./Log").default,
    log = GetLogger(__filename)
  
  // CHECK ERROR
  if (err) {
    log.error(`Failed to get lock: ${lockfilePath}`, err)
    return
  }
  
  
  
  // ARGS
  let Yargs = require("yargs")
  
  
  /**
   * Add command files
   *
   * @param file
   */
  function addCommands(file) {
    const mod = require(file)
    Yargs = mod.default ? mod.default(Yargs) : mod(Yargs)
  }
  
  /**
   * Unlock the lock file
   */
  function unlock() {
    lockfile.unlock(lockfilePath,err => {
      err && log.error(`Failed to unlock: ${lockfilePath}`, err)
    })
  }
  
  // REPO
  const Repo = require('./repo/Repo')
  
  // START
  Repo.updateReposIfNeeded()
    .then(() => {
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
    .then(unlock)
    .catch(ex => {
      log.error("An error occurred", ex)
      console.log(ex)
      unlock()
    })
  
})


