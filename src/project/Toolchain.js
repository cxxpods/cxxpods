
import File from '../util/File'
import * as sh from "shelljs"
import Assert from 'assert'
import {Paths} from "../Config"

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
export default class Toolchain {
  
  /**
   * Create the host toolchain
   */
  static makeHostToolchain(triplet) {
    return new Toolchain(triplet)
  }
  
  
  constructor(triplet,toolchainFileOrObject = null, androidOpts = null) {
    this.android = androidOpts !== null
    this.androidOpts = androidOpts
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
    
    const
      props = File.readFileProperties(outputFile),
      makeCrossTool = (name) => {
        const toolPath = `${props.CMAKE_CROSS_PREFIX}${name}${props.CMAKE_CROSS_SUFFIX || ""}`
        if (!File.exists(toolPath))
          throw `Tool path for ${name} does not exist: ${toolPath}`
        
        return toolPath
      }
    
    Object.assign(props,{
      CC: props.CMAKE_C_COMPILER,
      CXX: props.CMAKE_CXX_COMPILER,
      CPP: props.CMAKE_CXX_COMPILER,
      AR: makeCrossTool('ar'),
      RANLIB: makeCrossTool('ranlib'),
      OBJDUMP: makeCrossTool('objdump'),
      STRIP: makeCrossTool('strip'),
      NM: makeCrossTool('nm'),
      OBJCOPY: makeCrossTool('objcopy'),
      LD: makeCrossTool('ld'),
      LDD: makeCrossTool('ldd'),
      STRINGS: makeCrossTool('strings'),
    })
    return props
  }
  
  /**
   * Create CMake command line options
   */
  toCMakeOptions() {
    const opts = {}
    if (this.androidOpts) {
     Object.assign(opts,this.androidOpts)
    } else if (this.file) {
      opts["CMAKE_TOOLCHAIN_FILE"] =this.file
    }
    
    
    return opts
  }
  
  toString() {
    return this.name || this.triplet.toString()
  }
}


