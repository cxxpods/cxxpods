import {exists, mkdirs} from "./FileUtil"

const
  sh = require("shelljs"),
  Home = process.env.HOME

if (!Home)
  throw "No HOME env variable found"

const
  CUnitRootPath = `${Home}/.cunit`,
  CUnitConfigFile = `${CUnitRootPath}/cunit.json`,
  CUnitGithubURL = "https://github.com/cunit",
  CUnitsDefaultRepo = `${CUnitGithubURL}/cunits.git`


if (!mkdirs('-p', CUnitRootPath)) {
  throw `Unable to create root path: ${CUnitRootPath}`
}

/**
 * Default configuration
 *
 * @type {{rootPath: string, repos: *[]}}
 */
const DefaultConfig = {
  repos: [
    CUnitsDefaultRepo
  ]
}

/**
 * Configuration
 */
class Config {
  
  data = DefaultConfig
  
  constructor() {
    this.load()
    this.save()
  }
  
  load() {
    if (!exists(CUnitConfigFile)) {
      return false
    }
    
    
    this.data = JSON.parse(sh.cat(CUnitConfigFile))
  }
  
  save() {
    sh.ShellString(JSON.stringify(this.data)).to(CUnitConfigFile)
  }

  
  addRepository(url) {
    this.data.repos =
      {
        ...this.data.repos.filter(repoUrl => repoUrl !== url),
        url
      }
    
      return this
  }
  
  removeRepository(url) {
    this.data.repos =
      {
        ...this.data.repos.filter(repoUrl => repoUrl !== url),
        url
      }
    
    return this
  }
}


const config = new Config()

module.exports = {
  getConfig() {
    return config
  }
}