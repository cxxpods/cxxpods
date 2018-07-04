const
  {GetLogger} = require("../Log"),
  sh = require("shelljs"),
  OS = require("os"),
  log = GetLogger(__filename),
  {Paths} = require("../Config"),
  File = require("../util/File"),
  Assert = require("../util/Assert"),
  _ = require('lodash'),
  {Dependency,DependencyManager} = require("./Dependency"),
  Tool = require("./Tool")


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
  constructor(triplet,toolchainFileOrObject = null) {
    this.triplet = triplet
    if (toolchainFileOrObject && typeof toolchainFileOrObject === 'object') {
      this.file =  toolchainFileOrObject.file
      this.name = toolchainFileOrObject.name
    } else {
      this.file = toolchainFileOrObject
    }
    
    if (this.file) {
      this.file = this.file.startsWith("/") ? this.file : `${sh.pwd()}/${this.file}`
    }
  }
  
  
  
  toBuildStamp() {
    return {
      triplet: this.triplet.toString(),
      file: this.file
    }
  }
  
  
  
  
  /**
   * Create toolchain environment config
   * from cmake toolchain export
   *
   * @returns {*}
   */
  toScriptEnvironment() {
    if (!this.file)
      return {}
      
    const outputFile = `${sh.tempdir()}/toolchain.properties`
    
    sh.env["CUNIT_EXPORT_FILE"] = outputFile
    
    const result = sh.exec(`${Paths.CMake} -DCUNIT_TOOLCHAIN_EXPORT=ON -P ${this.file}`)
    Assert.ok(result.code === 0,`Failed to get toolchain export: ${outputFile}`)
    
    sh.env["CUNIT_EXPORT_FILE"] = null
    
    return File.readFileProperties(outputFile)
  }
  
  /**
   * Create CMake command line options
   */
  toCMakeOptions() {
    const opts = {}
    if (this.file) {
      opts["CMAKE_TOOLCHAIN_FILE"] =this.file
    }
    
    return opts
  }
  
  toString() {
    return this.name || this.triplet.toString()
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
  constructor(project,toolchain,profile,isTool = false) {
    this.isTool = isTool
    this.profile = profile
    this.toolchain = toolchain
    this.dir = isTool ? project.toolsDir : `${project.projectDir}/.cunit/${this.toString()}`
    this.rootDir = isTool ? project.toolsRoot : `${this.dir}/root`
    
    File.mkdirs(this.rootDir)
  }
  
  get name() {
    return `${this.toolchain.toString()}_${this.profile.toLowerCase()}`
  }
  
  toScriptEnvironment() {
    return _.merge(
      {},
      this.toolchain.toScriptEnvironment(),
      {
        CUNIT_BUILD_ROOT: this.rootDir,
        CUNIT_BUILD_LIB: `${this.rootDir}/lib`,
        CUNIT_BUILD_INCLUDE: `${this.rootDir}/include`,
        CUNIT_BUILD_CMAKE: `${this.rootDir}/lib/cmake`,
      })
  }
  
  toCMakeOptions() {
    return _.merge({},
      this.toolchain.toCMakeOptions(),
      {
        CMAKE_INSTALL_PREFIX: this.rootDir,
        CMAKE_MODULE_PATH: `${this.rootDir}/lib/cmake`,
        CMAKE_C_FLAGS: `-I${this.rootDir}/include -fPIC -fPIE`,
        CMAKE_CXX_FLAGS: `-I${this.rootDir}/include -fPIC -fPIE`,
        CMAKE_EXE_LINKER_FLAGS: `-L${this.rootDir}/lib`
      })
  }
  
  toBuildStamp() {
    return {
      toolchain: this.toolchain.toBuildStamp(),
      cmakeOptions: this.toCMakeOptions(),
      profile: this.profile,
      dir: this.dir
    }
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


class Project {
  constructor(path = sh.pwd(), rootProject = null, isTool = false) {
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
  
  
    log.debug(`Assembling toolchains and build types: ${this.name}`)
    if (!this.buildTypes.length)
      configureBuildTypes(this)
  
    log.debug(`Loaded project: ${this.name}`)
    
    Dependency.configureProject(this, isTool)
    Tool.configureProject(this)
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

module.exports = Project