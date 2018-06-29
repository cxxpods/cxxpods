const
  {GetLogger} = require("./Log"),
  {resolveDependency} = require("./repo/Repo"),
  sh = require("shelljs"),
  OS = require("os"),
  log = GetLogger(__filename),
  File = require("./util/File"),
  _ = require('lodash')


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
  constructor(triplet,cc = "gcc", cxx = "g++",prefix = "",suffix = "", sysroot = "") {
    this.triplet = triplet
    this.prefix = prefix
    this.suffix = suffix
    this.sysroot = sysroot
    this.cc = requiredTool(`${prefix}${cc}${suffix}`)
    this.cxx = requiredTool(`${prefix}${cxx}${suffix}`)
  }
  
  toCMakeArgs() {
    const args = [
      `-DCMAKE_C_COMPILER=${this.cc}`,
      `-DCMAKE_CXX_COMPILER=${this.cxx}`
    ]
    
    if (!_.isEmpty(this.sysroot)) {
      args.push(`-DCMAKE_SYSROOT=${this.sysroot}`)
    }
    
    return args
  }
}

/**
 * Create the host toolchain
 */
function makeHostToolchain(triplet = HostTriplet) {
  const
    [cc,cxx] = triplet.system === System.Darwin ?
      ['clang','clang++'] :
      ['gcc','g++']
  
  return new Toolchain(triplet,cc,cxx)
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
  
  toString() {
    return `${this.toolchain.triplet}_${this.profile.toLowerCase()}`
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
  
  if (config.toolchainExcludeHost !== true) {
    toolchains.push(HostToolchain)
  }
  
  Object.assign(project,{
    profiles,
    buildTypes: _.flatten(profiles.map(profile => toolchains.map(toolchain =>
      new BuildType(project,toolchain,profile)
    )))
  })
}


class Dependency {
  constructor(rootProject,name,version) {
    this.name = name
    this.version = version
    this.resolved = false
    this.dir = resolveDependency(name)
    this.rootProject = rootProject
    this.project = new Project(this.dir)
    this.buildConfigs = rootProject.buildTypes.map(buildType => ({
      type: buildType,
      src: `${buildType.dir}/${this.name}-src`,
      build: `${buildType.dir}/${this.name}-build`,
    }))
  }
}


function configureDependencies(project) {
  const
    configuredDependencies = project.config.dependencies || {}
  
  project.dependencies = Object
    .keys(configuredDependencies)
    .map(name => new Dependency(project,name,configuredDependencies[name]))
}


class Project {
  constructor(path) {
    this.projectDir = path
    this.config = {}
    this.configFiles = []
    this.profiles = []
    this.toolchains = []
    this.buildTypes = []
    this.loadConfigFile(`${path}/cunit.yml`)
    
    const localConfigFile = `${path}/cunit.local.yml`
    if (File.exists(localConfigFile)) {
      this.loadConfigFile(localConfigFile)
    }
    
    // SET THE PROJECT NAME
    this.name = this.config.name || _.last(_.split(path,"/"))
    
    configureBuildTypes(this)
    configureDependencies(this)
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