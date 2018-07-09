
import * as _ from 'lodash'
import {CompilerType, Processor, ProcessorNodeMap, System} from "./BuildConstants"
import Toolchain from "./Toolchain"
import Dependency from "./Dependency"
import Triplet from "./Triplet"
import File from "../util/File"
import GetLogger from "../Log"

const log = GetLogger(__filename)

export const AndroidArgs = [
  "CMAKE_TOOLCHAIN_FILE",
  "CMAKE_BUILD_TYPE",
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
},{})


export const AndroidArgsRequired = [
  "CMAKE_BUILD_TYPE",
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
      {toolchains,android} = project.rootProject || project,
      profiles = android ? [] : config.profiles ? config.profiles : ['Debug', 'Release']
  
    if (toolchains.length === 0) {
      if (!android && config.toolchainExcludeHost !== true) {
        toolchains.push(Toolchain.host)
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
  
  
  static makeAndroidBuildType(project, argv) {
    if (androidBuildType)
      return androidBuildType
    
    const
      opts = Object.keys(AndroidArgs).reduce((opts,nextArg) => {
        opts[nextArg] = argv[nextArg]
        return opts
      },{})
  
    const missingOpts = AndroidArgsRequired.filter(arg => [null,undefined].includes(opts[arg]))
    if (missingOpts.length)
      throw `Missing required args for android: ${_.join(missingOpts)}`
  
    const
      arch = Processor[opts.ANDROID_ABI] || ProcessorNodeMap[opts.ANDROID_ABI],
      sys = System.Android,
      compilerType = CompilerType.Unknown,
      profile = `${arch}_${opts.CMAKE_BUILD_TYPE}`
  
    // Object.entries(opts).forEach(([key,value]) => {
    //   console.log(`${key}=${value}`)
    // })
    
    androidToolchain = new Toolchain(new Triplet(sys,arch,compilerType),null,opts)
    androidToolchain.name = arch
    androidBuildType = new BuildType(project,androidToolchain,opts.CMAKE_BUILD_TYPE)
    
    project.buildTypes = [androidBuildType]
    log.info(`Updating dependencies: ${Dependency.allDependencies.length}`)
    Dependency.updateAllBuildConfigs()
    
    log.info(`Made build type: ${androidBuildType}`)
    return androidBuildType
  }
  
  constructor(project,toolchain,profile,isTool = false) {
    this.isTool = isTool
    this.profile = profile
    this.toolchain = toolchain
    
    const
      rootProject = project.rootProject || project
    
    this.dir = (isTool ? project.toolsDir : `${rootProject.projectDir}/.cunit/${this.toString()}`).replace(/\\/g,'/')
    this.rootDir = (isTool ? project.toolsRoot : `${this.dir}/root`).replace(/\\/g,'/')
    
    File.mkdirs(this.rootDir)
  }
  
  get name() {
    return `${this.toolchain.toString()}_${this.profile.toLowerCase()}`
  }
  
  toScriptEnvironment(rootProject,project) {
    return _.merge(
      {},
      this.toolchain.toScriptEnvironment(rootProject,project),
      {
        CUNIT_BUILD_ROOT: this.rootDir,
        CUNIT_BUILD_LIB: `${this.rootDir}/lib`,
        CUNIT_BUILD_INCLUDE: `${this.rootDir}/include`,
        CUNIT_BUILD_CMAKE: `${this.rootDir}/lib/cmake`,
      })
  }
  
  toCMakeOptions(rootProject,project) {
    return _.merge({},
      this.toolchain.toCMakeOptions(rootProject,project),
      {
        CMAKE_INSTALL_PREFIX: this.rootDir,
        CMAKE_MODULE_PATH: `${this.rootDir}/lib/cmake`,
        CMAKE_LIBRARY_PATH: `${this.rootDir}/lib`,
        CMAKE_INCLUDE_PATH: `${this.rootDir}/include`,
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