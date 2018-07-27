const
  lockfile = require("lockfile"),
  sh = require("shelljs"),
  Os = require("os"),
  Path = require("path"),
  pwd = sh.pwd(),
  _ = require('lodash')


function findRootPath() {
  let cxxRootPath = null
  let currentDir = pwd
  while (!_.isEmpty(currentDir)) {
    const testPath = `${currentDir}/cxxpods.yml`
    if (sh.test('-e', testPath)) {
      cxxRootPath = currentDir
      break
    }
    
    currentDir = Path.dirname(currentDir)
  }
  
  return cxxRootPath ? Promise.resolve(cxxRootPath) : Promise.reject(`Unable to find cxxpods.yml in ancestors from: ${pwd}`)
}


findRootPath()
  .then(async (cxxRootPath) => {
    
    const lockfilePath = Path.resolve(Os.platform().toLowerCase().startsWith("win") ? "c:/temp" : "/tmp", `${Buffer.from(cxxRootPath).toString('base64')}.lock`)
    sh.exec(`sleep ${Math.floor(Math.random() * 5)}`)
    
    console.log(`Using lock file: ${lockfilePath}`)
  
    lockfile.lock(lockfilePath, {wait: 1000 * 60 * 60}, async (err) => {
      console.log("Received lock")
  
  
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
        lockfile.unlock(lockfilePath, err => {
          err && log.error(`Failed to unlock: ${lockfilePath}`, err)
        })
      }
  
      // REPO
      const Repo = require('./repo/Repo')
  
      // START
      await Repo.updateReposIfNeeded()
  
      try {
        [
          "./commands/RepoCommands",
          "./commands/ProjectCommands",
          "./commands/InfoCommands"
        ].forEach(addCommands)
    
        Yargs.demandCommand(1, "You need at least one command before moving on")
          .argv
      } catch (ex) {
        log.error(`Failed`, ex)
        console.error(ex)
      } finally {
        unlock()
      }
    })
  })
  .catch(err => console.error(err))


