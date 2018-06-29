const
  {exists, mkdirs} = require("./util/File"),
  _ = require("lodash"),
  Fs = require("fs")

const
  sh = require("shelljs"),
  Home = process.env.HOME,
  [CMake,Make,Git] = ["cmake","make","git"].map(app => {
    const path = sh.which(app)
    if (!path || _.isEmpty(path))
      throw `Unable to find ${app} in path`
    
    return path
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
 * @type {{rootPath: string, repos: *[]}}
 */
const DefaultConfig = {
  repos: []
}

/**
 * Configuration
 */
class Config {
  
  
  
  constructor() {
    this.data = DefaultConfig
    this.load()
    this.save()
  }
  
  load() {
    if (!exists(CUnitConfigFile)) {
      return false
    }
    
    
    this.data = JSON.parse(Fs.readFileSync(CUnitConfigFile,'utf-8'))
  }
  
  save() {
    Fs.writeFileSync(CUnitConfigFile,JSON.stringify(this.data,null,4),'utf-8')
  }
  
  
  addRepository(url) {
    this.data.repos =
      [
        ...this.data.repos.filter(repoUrl => repoUrl !== url),
        url
      ]
    this.save()
    return this
  }
  
  removeRepository(url) {
    this.data.repos =
      [
        ...this.data.repos.filter(repoUrl => repoUrl !== url),
        url
      ]
  
    this.save()
    return this
  }
  
  get repos() {
    return [... this.data.repos, CUnitsDefaultRepo]
  }
}


module.exports = {
  Config: new Config(),
  Paths: {
    CUnitRoot,
    CUnitRepo,
    CMake,
    Make,
    Git
  }
}