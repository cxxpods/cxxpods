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




export const IsWindows = OS.platform().startsWith("win")

export const ExeSuffix = IsWindows ? '.exe' : ''

const
  Home = IsWindows ? process.env.USERPROFILE : process.env.HOME,
  [CMake,Make,Git] = ["cmake",["make","mingw32-make"],"git"].map(appName => {
    const apps = typeof appName === 'string' ? [appName] : appName
    for (let app of apps) {
      const path = sh.which(`${app}${ExeSuffix}`)
      if (path && !_.isEmpty(path))
        return `"${path}"`
    }
    
    throw `Unable to find ${appName} in path`
  })

if (!Home || _.isEmpty(Home))
  throw "No HOME env variable found"

const
  CXXPodsRoot = `${Home}/.cxxpods`,
  CXXPodsRepo = `${CXXPodsRoot}/repos`,
  CXXPodsConfigFile = `${CXXPodsRoot}/cxxpods.json`,
  CXXPodsGithubURL = "https://github.com/cxxpods",
  CXXPodsDefaultRepo = `${CXXPodsGithubURL}/cxxpods-registry.git`
  
  

if (!mkdirs(CXXPodsRepo)) {
  throw `Unable to create repo path: ${CXXPodsRepo}`
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
class Configuration {
  
  
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
    if (!exists(CXXPodsConfigFile)) {
      return false
    }
    
    this.data = readFileJSON(CXXPodsConfigFile)
  }
  
  /**
   * Save configuration
   */
  save() {
    writeFileJSON(CXXPodsConfigFile,this.data,true)
  }
  
  /**
   * Add a repo to the config
   *
   * @param url
   * @returns {Configuration}
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
   * @returns {Configuration}
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
    return [... this.data.repos, CXXPodsDefaultRepo]
  }
  
  get isRepoUpdateNeeded() {
    return this.firstTime || !this.data.repoUpdateTimestamp || Date.now() - this.data.repoUpdateTimestamp > RepoUpdateTimeout
  }
}


export const Config = new Configuration()
export const Environment = {
  CXXPODS_PROC_COUNT: Math.max(1,Math.floor(OS.cpus().length))
}

export const Paths = {
  CXXPodsRoot,
  CXXPodsRepo,
  CMake,
  Make,
  Git
}

export default {
  IsWindows,
  Config,
  Paths,
  Environment
}