import Toolchain from "./Toolchain"
import BuildType from "./BuiltType"
import {CompilerType, Architecture, ProcessorNodeMap, System} from "./BuildConstants"
import GetLogger from '../Log'
import Tool from './Tool'
import {getValue} from "typeguard"
import Dependency from "./Dependency"
import {findCXXPodsConfigFile, realRootProject} from "../util/ProjectUtils"

const
  sh = require("shelljs"),
  log = GetLogger(__filename),
  File = require("../util/File"),
  _ = require('lodash')


/**
 * Implement complex variable resolution
 *
 * @param project
 * @param context
 * @param processedConfigs
 */
function resolveConfigVariables(project, context = null, processedConfigs = []) {

}

/**
 * Main project structure
 */
export default class Project {
  constructor(path = sh.pwd(), rootProject = null, isTool = false, depConfig = {}) {
    
   
    rootProject = realRootProject(rootProject)
    
    this.rootProject = rootProject
    this.projectDir = path
    
    this.isTool = isTool
    this.toolsDir = `${path}/.cxxpods/tools`
    this.toolsRoot = `${this.toolsDir}/root`
    this.toolsBuildType = rootProject ?
      rootProject.toolsBuildType :
      new BuildType(this, Toolchain.host, true)
    
    this.config = {}
    this.configFiles = []
    this.toolchains = getValue(() => rootProject.toolchains, [])
    this.buildTypes = getValue(() => rootProject.buildTypes, [])
    
    // LOAD THE PROJECT CONFIGURATION
    const cxxpodsFile = findCXXPodsConfigFile(path)
    if (!cxxpodsFile)
      throw `No cmake file found in: ${path}`
    
    // BUILD CONFIGURATION
    const cxxpodsFiles = [cxxpodsFile, `${path}/cxxpods.local.yml`]
    
    cxxpodsFiles.forEach(file => {
      if (File.exists(file)) {
        this.loadConfigFile(file)
      } else {
        log.info(`CXXPods file (${file}) does not exist`)
      }
    })
    
    // MERGE DEPENDENCY CONFIG, THIS FORCES OPTIONS INTO THE DEPENDENCY
    // FROM A HIGHER LEVEL PROJECT
    _.merge(this.config, depConfig)
    
    // SET THE PROJECT NAME
    this.name = this.config.name || _.last(_.split(path, "/"))
    this.android = [true, "true"].includes(getValue(() => this.rootProject.config, this.config).android)
    
    resolveConfigVariables(this)
    
    if (this.android) {
      log.info("Android mode, will use dynamic toolchain")
    } else {
      log.debug(`Assembling toolchains and build types: ${this.name}`)
      if (!this.buildTypes.length)
        BuildType.configureProject(this)
    }
    
    // CONFIGURE DEPENDENCIES
    Dependency.configureProject(this, isTool)
    
    // BUILD TOOLS UP NO MATTER WHAT
    Tool.configureProject(this)
    
    log.debug(`Loaded project: ${this.name}`)
  }
  
  /**
   * Load config file
   *
   * @param path
   */
  loadConfigFile(path) {
    log.debug(`Loading: ${path}`)
    if (!File.exists(path)) {
      log.warn(`Unable to load: ${path}`)
      return
    }
    this.configFiles.push(path)
    this.config = _.defaultsDeep(File.readFileYaml(path),this.config)
  }
  
  
  /**
   * Get sorted and ordered, unique dependencies
   * @returns {*|void}
   */
  
  static get dependencyGraph() {
    return Dependency.toDependencyGraph()
  }
  
  static get toolDependencyGraph() {
    return Tool.toDependencyGraph()
  }
  
  
}


Object.assign(Project, {
  System,
  Processor: Architecture,
  CompilerType
})

