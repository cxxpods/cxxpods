

const
  lockfile = require("lockfile"),
  sh = require("shelljs"),
  Os = require("os"),
  Path = require("path"),
  pwd = sh.pwd(),
  _ = require('lodash')


/**
 * Find the project root folder
 *
 * @returns {any}
 */
function findRootPath() {
  let cxxRootPath = null
  let currentDir = pwd
  while (!_.isEmpty(currentDir)) {
    const testPath = `${currentDir}/cxxpods.yml`
    if (sh.test('-e', testPath)) {
      cxxRootPath = currentDir
      break
    }
    
    
    try {
      currentDir = Path.dirname(currentDir)
    } catch (err) {
      console.warn("Unable to find cxxpods.yml", err)
      break
    }
  }
  
  return Promise.resolve(cxxRootPath) // : Promise.reject(`Unable to find cxxpods.yml in ancestors from: ${pwd}`)
}



findRootPath()
  .then(async (cxxRootPath) => {
    
    const disposers = []
    
    async function run() {
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
      
      // REPO
      const Repo = require('./repo/Repo')
  
      // START
      await Repo.updateReposIfNeeded()
  
      try {
        [
          "./commands/RepoCommands",
            ...(!cxxRootPath ? [] : [
              "./commands/ProjectCommands",
              "./commands/InfoCommands"
            ])
        ].forEach(addCommands)
    
        Yargs.demandCommand(1, "You need at least one command before moving on")
          .argv
      } catch (ex) {
        log.error(`Failed`, ex)
        console.error(ex)
      } finally {
        disposers.forEach(fn => fn())
      }
    }
    
    if (cxxRootPath) {
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
    
    
        /**
         * Unlock the lock file
         */
        const unlock = () => {
          lockfile.unlock(lockfilePath, err => {
            err && log.error(`Failed to unlock: ${lockfilePath}`, err)
          })
        }
    
        disposers.push(unlock)
    
        await run()
      })
    } else {
      await run()
    }
  })
  .catch(err => console.error(err))


