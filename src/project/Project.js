const
  {GetLogger} = require("../Log"),
  sh = require("shelljs"),
  OS = require("os"),
  log = GetLogger(__filename),
  File = require("../util/File"),
  _ = require('lodash'),
  {Dependency,DependencyManager} = require("./Dependency")


const System = {
  Darwin: "Darwin",
  Linux: "Linux",
  Windows: "Windows"
}

const Processor = {
  x86: "x86",
  x86_64: "x86_64",
  arm: "arm",
  aarch64: "aarch64"
}

const ProcessorNodeMap = {
  [Processor.arm]: Processor.arm,
  "arm64": Processor.aarch64,
  "x64": Processor.x86_64,
  "x32": Processor.x86
}

const CompilerType = {
  GNU: "GNU",
  AppleClang: "AppleClang"
}

/**
 * Triplet
 */
class Triplet {
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
 * Required tool
 *
 * @param toolPath
 * @returns {*}
 */
function requiredTool(toolPath) {
  if (!File.exists(toolPath)) {
    const altToolPath = sh.which(toolPath)
    if (!File.exists(altToolPath))
      throw `Unable to find tool: ${altToolPath}`
    
    toolPath = altToolPath
  }
  
  return toolPath
}

/**
 * Toolchain
 */
class Toolchain {
  constructor(triplet,toolchainFile = null) {
    this.triplet = triplet
    this.file = toolchainFile
  }
  
  toCMakeArgs() {
    const args = []
    if (this.file) {
      args.push(
        `-DCMAKE_TOOLCHAIN_FILE=${this.file}`
      )
    }
    
    return args
  }
}

/**
 * Create the host toolchain
 */
function makeHostToolchain(triplet = HostTriplet) {
  return new Toolchain(triplet)
}

const HostToolchain = makeHostToolchain()

/**
 * Build type
 */
class BuildType {
  constructor(project,toolchain,profile) {
    this.profile = profile
    this.toolchain = toolchain
    this.dir = `${project.projectDir}/.cunit/${this.toString()}`
    this.rootDir = `${this.dir}/root`
    
    File.mkdirs(this.rootDir)
  }
  
  get name() {
    return `${this.toolchain.triplet}_${this.profile.toLowerCase()}`
  }
  
  toString() {
    return this.name
  }
}


/**
 * Configure build types
 *
 * @param project
 */
function configureBuildTypes(project) {
  const
    {config,toolchains} = project,
    profiles = config.profiles ? config.profiles : ['Debug', 'Release']
  
  if (toolchains.length === 0) {
    if (config.toolchainExcludeHost !== true) {
      toolchains.push(HostToolchain)
    }
  
    Object
      .keys(config.toolchains || {})
      .map(triplet => {
        const
          toolchainFile = config.toolchains[triplet],
          [processor,system,compilerType] = _.split(triplet,"-")
        
        toolchains.push(new Toolchain(
          new Triplet(
            Object.keys(System).find(it => it.toLowerCase() === system),
            Object.keys(Processor).find(it => it.toLowerCase() === processor),
            Object.keys(CompilerType).find(it => it.toLowerCase() === compilerType)
          ),
          toolchainFile.startsWith("/") ? toolchainFile : `${project.projectDir}/${toolchainFile}`
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


class Project {
  constructor(path = sh.pwd(), rootProject = null) {
    this.rootProject = rootProject
    this.projectDir = path
    this.config = {}
    this.configFiles = []
    this.profiles = []
    this.toolchains = rootProject ? rootProject.toolchains : []
    this.buildTypes = rootProject ? rootProject.buildTypes : []
    
    const cunitFile = require("./Configure").findCUnitConfigFile(path)
    if (!cunitFile)
      throw `No cmake file found in: ${path}`
    
    this.loadConfigFile(cunitFile)
    
    const localConfigFile = `${path}/cunit.local.yml`
    if (File.exists(localConfigFile)) {
      this.loadConfigFile(localConfigFile)
    }
    
    // SET THE PROJECT NAME
    this.name = this.config.name || _.last(_.split(path,"/"))
  
  
    log.info(`Assembling toolchains and build types: ${this.name}`)
    if (!this.buildTypes.length)
      configureBuildTypes(this)
  
    log.info(`Loaded project: ${this.name}`)
    Dependency.configureProject(this)
    
  }
  
  loadConfigFile(path) {
    log.info(`Loading: ${path}`)
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
  
  get dependencyGraph() {
    return DependencyManager.toDependencyGraph()
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

module.exports = Project