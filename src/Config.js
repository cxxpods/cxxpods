import {exists, mkdirs, readFileJSON, writeFileJSON} from "./util/File"
import * as _ from "lodash"
import Fs from "fs"
import OS from "os"
import * as sh from 'shelljs'

/**
 * Maximum time we can go without a repo update
 *
 * @type {number}
 */
const RepoUpdateTimeout = 1000 * 60 * 60 * 24




const
  IsWindows = OS.platform().startsWith("win"),
  Home = IsWindows ? process.env.USERPROFILE : process.env.HOME,
  Exe = IsWindows ? '.exe' : '',
  [CMake,Make,Git] = ["cmake",["make","mingw32-make"],"git"].map(appName => {
    const apps = typeof appName === 'string' ? [appName] : appName
    for (let app of apps) {
      const path = sh.which(`${app}${Exe}`)
      if (path && !_.isEmpty(path))
        return `"${path}"`
    }
    
    throw `Unable to find ${appName} in path`
  })

if (!Home || _.isEmpty(Home))
  throw "No HOME env variable found"

const
  CUnitRoot = `${Home}/.cunit`,
  CUnitRepo = `${CUnitRoot}/repos`,
  CUnitConfigFile = `${CUnitRoot}/cunit.json`,
  CUnitGithubURL = "https://github.com/cunit",
  CUnitsDefaultRepo = `${CUnitGithubURL}/cunits.git`
  
  

if (!mkdirs(CUnitRepo)) {
  throw `Unable to create repo path: ${CUnitRepo}`
}

/**
 * Default configuration
 *
 * @type {{repos: Array, ready: boolean, repoUpdateTimestamp: number}}
 */
const DefaultConfig = {
  repos: [],
  ready: false,
  repoUpdateTimestamp: 0
}

/**
 * Configuration
 */
class Config {
  
  
  constructor() {
    this.data = DefaultConfig
    this.load()
    this.firstTime = !this.data.ready
    this.data.ready = true
    this.save()
  }
  
  /**
   * Load configuration
   *
   * @returns {boolean}
   */
  load() {
    if (!exists(CUnitConfigFile)) {
      return false
    }
    
    this.data = readFileJSON(CUnitConfigFile)
  }
  
  /**
   * Save configuration
   */
  save() {
    writeFileJSON(CUnitConfigFile,this.data,true)
  }
  
  /**
   * Add a repo to the config
   *
   * @param url
   * @returns {Config}
   */
  addRepository(url) {
    this.data.repos =
      [
        ...this.data.repos.filter(repoUrl => repoUrl !== url),
        url
      ]
    this.save()
    return this
  }
  
  /**
   * Remove a repository from the config
   *
   * @param url
   * @returns {Config}
   */
  removeRepository(url) {
    this.data.repos = [
      ...this.data.repos.filter(repoUrl => repoUrl !== url),
      url
    ]
  
    this.save()
    return this
  }
  
  
  /**
   * Called after repo update to mark time
   */
  updatedRepositories() {
    this.data.repoUpdateTimestamp = Date.now()
    this.save()
  }
  
  /**
   * Get configured repos
   *
   * @returns {*[]}
   */
  get repos() {
    return [... this.data.repos, CUnitsDefaultRepo]
  }
  
  get isRepoUpdateNeeded() {
    return this.firstTime || !this.data.repoUpdateTimestamp || Date.now() - this.data.repoUpdateTimestamp > RepoUpdateTimeout
  }
}


module.exports = {
  Config: new Config(),
  IsWindows,
  Environment: {
    CUNIT_PROC_COUNT: OS.cpus().length
  },
  Paths: {
    CUnitRoot,
    CUnitRepo,
    CMake,
    Make,
    Git
  }
}