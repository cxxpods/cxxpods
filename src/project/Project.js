import Toolchain from "./Toolchain"
import BuildType from "./BuiltType"
import {CompilerType, Processor, ProcessorNodeMap, System} from "./BuildConstants"
import GetLogger from '../Log'
import Tool from './Tool'
import {getValue} from "typeguard"

const
  sh = require("shelljs"),
  OS = require("os"),
  log = GetLogger(__filename),
  {Paths} = require("../Config"),
  File = require("../util/File"),
  Assert = require("../util/Assert"),
  _ = require('lodash'),
  {Dependency,DependencyManager} = require("./Dependency")
  




/**
 * Triplet
 */
export class Triplet {
  constructor(system,processor,compilerType) {
    if (!System[system]) throw `Unknown system: ${system}`
    if (!Processor[processor]) throw `Unknown processor: ${processor}`
    if (!CompilerType[compilerType]) throw `Unknown compiler type: ${compilerType}`
    
    this.system = system
    this.processor = processor
    this.compilerType = compilerType
  }
  
  toString() {
    return `${this.processor}-${this.system.toLowerCase()}-${this.compilerType.toLowerCase()}`
  }
}

/**
 * Create host triplet
 *
 * @returns {Triplet}
 */
function makeHostTriplet() {
  const
    platform = OS.platform(),
    arch = OS.arch(),
    system = platform.startsWith("win") ?
      System.Windows :
      Object.keys(System).find(sys => sys.toLowerCase() === platform)
  
  return new Triplet(
    system,
    ProcessorNodeMap[arch],
    system ===  System.Darwin ? CompilerType.AppleClang : CompilerType.GNU
  )
}

const HostTriplet = makeHostTriplet()




/**
 * The host toolchain
 *
 * @type {Toolchain}
 */
const HostToolchain = Toolchain.makeHostToolchain(HostTriplet)




/**
 * Configure build types
 *
 * @param project
 */
function configureBuildTypes(project) {
  const
    {config} = project,
    {toolchains,android} = project.rootProject || project,
    profiles = android ? [] : config.profiles ? config.profiles : ['Debug', 'Release']
  
  if (toolchains.length === 0) {
    if (!android && config.toolchainExcludeHost !== true) {
      toolchains.push(HostToolchain)
    }
  
    Object
      .keys(config.toolchains || {})
      .map(triplet => {
        const
          toolchainFileOrObject = config.toolchains[triplet],
          [processor,system,compilerType] = _.split(triplet,"-")
        
        toolchains.push(new Toolchain(
          new Triplet(
            Object.keys(System).find(it => it.toLowerCase() === system),
            Object.keys(Processor).find(it => it.toLowerCase() === processor),
            Object.keys(CompilerType).find(it => it.toLowerCase() === compilerType)
          ),
          toolchainFileOrObject
        ))
      })
    
  }
  
  
  Object.assign(project,{
    profiles,
    buildTypes: _.flatten(profiles.map(profile => toolchains.map(toolchain =>
      new BuildType(project,toolchain,profile)
    )))
  })
}



/**
 * Implement complex variable resolution
 *
 * @param project
 * @param context
 * @param processedConfigs
 */
function resolveConfigVariables(project,context = null, processedConfigs = []) {

}

/**
 * Main project structure
 */
export default class Project {
  constructor(path = sh.pwd(), rootProject = null, isTool = false, depConfig = {}) {
  
    let realRootProject = rootProject
    while(realRootProject && realRootProject.rootProject) {
      realRootProject = realRootProject.rootProject
    }
  
    rootProject = realRootProject
    
    this.rootProject = rootProject
    this.projectDir = path
    
    this.isTool = isTool
    this.toolsDir = `${path}/.cunit/tools`
    this.toolsRoot = `${this.toolsDir}/root`
    this.toolsBuildType = rootProject ? rootProject.toolsBuildType : new BuildType(this,HostToolchain,"Release",true)
    
    this.config = {}
    this.configFiles = []
    this.profiles = []
    this.toolchains = rootProject ? rootProject.toolchains : []
    this.buildTypes = rootProject ? rootProject.buildTypes : []
    
    // LOAD THE PROJECT CONFIGURATION
    const cunitFile = require("./Configure").findCUnitConfigFile(path)
    if (!cunitFile)
      throw `No cmake file found in: ${path}`
  
    const cunitFiles = [cunitFile,`${path}/cunit.local.yml`]
    
    cunitFiles.forEach(file => {
        if (File.exists(file)) {
          this.loadConfigFile(file)
        } else {
          log.info(`CUnit file (${file}) does not exist`)
        }
    })
  
    // MERGE DEPENDENCY CONFIG, THIS FORCES OPTIONS INTO THE DEPENDENCY
    // FROM A HIGHER LEVEL PROJECT
    _.merge(this.config,depConfig)
    
    // SET THE PROJECT NAME
    this.name = this.config.name || _.last(_.split(path,"/"))
    this.android = [true,"true"].includes(getValue(() => this.rootProject.config,this.config).android)
    
    resolveConfigVariables(this)
    
    if (this.android) {
      log.info("Android mode, will use dynamic toolchain")
    } else {
      log.debug(`Assembling toolchains and build types: ${this.name}`)
      if (!this.buildTypes.length)
        configureBuildTypes(this)
    }
    
    // CONFIGURE DEPENDENCIES
    Dependency.configureProject(this, isTool)
    
    // BUILD TOOLS UP NO MATTER WHAT
    Tool.configureProject(this)
  
    log.debug(`Loaded project: ${this.name}`)
  }
  
  loadConfigFile(path) {
    log.debug(`Loading: ${path}`)
    if (!File.exists(path)) {
      log.warn(`Unable to load: ${path}`)
      return
    }
    this.configFiles.push(path)
    _.merge(this.config,File.readFileYaml(path))
  }
  
  
  /**
   * Get sorted and ordered, unique dependencies
   * @returns {*|void}
   */

  static get dependencyGraph() {
    return DependencyManager.toDependencyGraph()
  }
  
  static get toolDependencyGraph() {
    return Tool.toDependencyGraph()
  }
  
  
}


Object.assign(Project, {
  BuildType,
  Triplet,
  Toolchain,
  System,
  Processor,
  CompilerType
})

