import * as _ from 'lodash'
import {
  CompilerType,
  Architecture,
  ProcessorNodeMap,
  System,
  ABI,
  findSystem,
  findArch,
  findABI
} from "./BuildConstants"
import Toolchain from "./Toolchain"
import Dependency from "./Dependency"
import Triplet from "./Triplet"
import File, {exists, fixPath} from "../util/File"
import GetLogger from "../Log"
import {Environment} from "../Config"
import * as Path from 'path'
import * as Assert from "assert"
import {getValue} from "typeguard"

const log = GetLogger(__filename)

export const AndroidArgs = [
  "CMAKE_TOOLCHAIN_FILE",
  "ANDROID_PLATFORM",
  "ANDROID_ABI",
  "ANDROID_NDK",
  "ANDROID_PLATFORM",
  "ANDROID_PIE",
  "ANDROID_STL",
  "ANDROID_NATIVE_API_LEVEL"
].reduce((args, nextArg) => {
  args[nextArg] = nextArg
  return args
}, {})


export const AndroidArgsRequired = [
  "CMAKE_TOOLCHAIN_FILE",
  "ANDROID_ABI",
  "ANDROID_NDK"
]


let androidToolchain = null
let androidBuildType = null

/**
 * Build type
 */
export default class BuildType {
  
  /**
   * Configure a project's build types
   *
   * @param project
   */
  static configureProject(project) {
    const
      {config} = project,
      {toolchains, android} = project.rootProject || project
    
    if (toolchains.length === 0) {
      if (!android && config.toolchainExcludeHost !== true) {
        toolchains.push(Toolchain.host)
      }
      
      Object
        .entries(config.toolchains || {})
        .map(([name, toolchainConfig]) => {
          // If name has exactly three parts then its a triplet
          if (name.split(_).length === 3) {
            const tripletStr = toolchainConfig
            
            const
              toolchainFileOrObject = config.toolchains[tripletStr],
              [processor, system, abi] = _.split(tripletStr, "-")
            
            toolchains.push(new Toolchain(
              new Triplet(
                Object.keys(System).find(it => it.toLowerCase() === system),
                Object.keys(Architecture).find(it => it.toLowerCase() === processor),
                Object.keys(ABI).find(it => it.toLowerCase() === abi)
              ),
              toolchainFileOrObject
            ))
          }
          // Otherwise, its just the name
          else {
            let {system, arch, abi, file, name} = toolchainConfig,
              triplet = new Triplet(
                findSystem(system),
                findArch(arch),
                findABI(abi)
              )
            
            const dir = getValue(() => project.rootProject.projectDir, project.projectDir).toString()
            if (!Path.isAbsolute(file)) {
              file = Path.join(dir, file)
            }
          
            log.info(`Toolchain (${name}) file ${file}`)
            Assert.ok(exists(file), `Toolchain (${name}) file ${file} does not exist`)
            
            toolchains.push(new Toolchain(
              triplet,
              {
                file,
                name: name || triplet.toString(),
                ...toolchainConfig
              }
            ))
          }
        })
      
    }
    
    
    Object.assign(project, {
      buildTypes: toolchains.map(toolchain =>
        new BuildType(project, toolchain)
      )
    })
  }
  
  
  static makeAndroidBuildType(project, argv) {
    if (androidBuildType)
      return androidBuildType
    
    const
      opts = Object.keys(AndroidArgs).reduce((opts, nextArg) => {
        opts[nextArg] = argv[nextArg]
        return opts
      }, {})
    
    const missingOpts = AndroidArgsRequired.filter(arg => [null, undefined].includes(opts[arg]))
    if (missingOpts.length)
      throw `Missing required args for android: ${_.join(missingOpts)}`
    
    const
      arch = Architecture[opts.ANDROID_ABI] || ProcessorNodeMap[opts.ANDROID_ABI],
      sys = System.Android,
      compilerType = CompilerType.Android
    
    // Object.entries(opts).forEach(([key,value]) => {
    //   console.log(`${key}=${value}`)
    // })
    
    androidToolchain = new Toolchain(new Triplet(sys, arch, ABI.ANDROID, compilerType), null, opts)
    androidToolchain.name = arch
    androidBuildType = new BuildType(project, androidToolchain)
    
    project.buildTypes = [androidBuildType]
    log.info(`Updating dependencies: ${Dependency.allDependencies.length}`)
    Dependency.updateAllBuildConfigs()
    
    log.info(`Made build type: ${androidBuildType}`)
    return androidBuildType
  }
  
  constructor(project, toolchain, isTool = false) {
    this.arch = toolchain.triplet.arch
    this.isTool = isTool
    this.toolchain = toolchain
    
    const
      rootProject = project.rootProject || project
    
    this.dir = fixPath(isTool ? project.toolsDir : `${rootProject.projectDir}/.cxxpods/${this.toString()}`)
    this.rootDir = fixPath(isTool ? project.toolsRoot : `${this.dir}/root`)
    
    File.mkdirs(this.rootDir)
  }
  
  /**
   * Build type name is the same as the toolchain
   * as they have become synonyms in the current version
   *
   * @returns {string}
   */
  get name() {
    return `${this.toolchain}`
  }
  
  /**
   * Convert to env variable map
   * that can be used by scripts, etc
   *
   * @param rootProject
   * @param project
   */
  toScriptEnvironment(rootProject, project) {
    return _.merge(
      {},
      Environment,
      this.toolchain.toScriptEnvironment(rootProject, project),
      {
        CXXPODS_BUILD_ROOT: this.rootDir,
        CXXPODS_BUILD_LIB: Path.join(this.rootDir,"lib"),
        CXXPODS_BUILD_INCLUDE: Path.join(this.rootDir,"include"),
        CXXPODS_BUILD_CMAKE: Path.join(this.rootDir, "lib","cmake")
      })
  }
  
  /**
   * Create a CMakeOptions map for the build type
   *
   * @param rootProject
   * @param project
   */
  toCMakeOptions(rootProject, project) {
    return _.merge({},
      this.toolchain.toCMakeOptions(rootProject, project),
      {
        CMAKE_INSTALL_PREFIX: this.rootDir,
        CMAKE_MODULE_PATH: `${this.rootDir}/lib/cmake`,
        CMAKE_FIND_ROOT_PATH: `${this.rootDir}/lib/cmake`,
        CMAKE_LIBRARY_PATH: `${this.rootDir}/lib`,
        CMAKE_INCLUDE_PATH: `${this.rootDir}/include`,
        CMAKE_C_FLAGS: `-I${this.rootDir}/include`,
        CMAKE_CXX_FLAGS: `-I${this.rootDir}/include`,
        CMAKE_EXE_LINKER_FLAGS: `-L${this.rootDir}/lib`
      })
  }
  
  /**
   * Create a build stamp (like eTag) for caching purposes
   *
   * @returns {{toolchain: ({toolchain, cmakeOptions, dir}|{triplet: string, file: *}|{name, version, dir, buildConfig, buildType, cmakeConfig, cmakeFindTemplateTimestamp}|{name, version, dir, buildConfig, buildType, cmakeConfig, srcTimestamp, dirTimestamp}), cmakeOptions: *, dir: *}}
   */
  toBuildStamp() {
    return {
      toolchain: this.toolchain.toBuildStamp(),
      cmakeOptions: this.toCMakeOptions(),
      dir: this.dir
    }
  }
  
  /**
   * Implement string representation of BuildType
   *
   * @returns {string}
   */
  toString() {
    return this.name
  }
}