
import File, {exists, isDirectory} from '../util/File'
import * as sh from "shelljs"
import * as Path from 'path'

import Assert from 'assert'
import GetLogger from '../Log'
import {Environment, Paths} from "../Config"
import * as Tmp from 'tmp'
import {processTemplate} from "../util/Template"
import {getValue} from "typeguard"
import {isDefined} from "../util/Checker"
import Triplet from "./Triplet"
import * as _ from 'lodash'
import {ArchToAndroidABIMap, System} from "./BuildConstants"
import Project from "./Project"
// import BuildType from "./BuiltType"
// import {loadProject, makeCMakeFile} from "./Configure"
// import Project from "./Project"
const log = GetLogger(__filename)

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


export async function getToolchainProperties(project) {
  return project.toolchains.map(it => it.toScriptEnvironment(project, project))
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
  
  
  constructor(triplet, toolchainFileOrObject = null, androidOpts = null) {
    this.android = androidOpts !== null
    this.androidOpts = androidOpts
    this.triplet = triplet
    this.system = ""
    this.arch = ""
    this.abi = ""
    
    this.cmake = {
      flags: {}
    }
    
    this.name = triplet.toString()
    
    if (toolchainFileOrObject && typeof toolchainFileOrObject === 'object') {
      Object.assign(this, toolchainFileOrObject)
    } else {
      this.file = toolchainFileOrObject
    }
    
    this.file = this.file || getValue(() => androidOpts.CMAKE_TOOLCHAIN_FILE)
  
    Object.assign(this, triplet)
    
    if (this.file) {
      this.file = Path.isAbsolute(this.file.toString()) ? this.file : Path.join(sh.pwd().toString(),this.file)
    }
  
    
  
  }
  
  
  /**
   * Build stamping for caching purposes
   *
   * @returns {{triplet: string, file: *}}
   */
  toBuildStamp() {
    return {
      //...this
      name: this.name,
      triplet: this.triplet.toString(),
      file: this.file
    }
  }
  
  /**
   * Calculate system overrides
   *
   * @param rootProject - project being built
   * @param project - current dependency
   * @param propertyPath - property make i.e. "cmake.options"
   * @returns {*}
   */
  toSystemOverrides(rootProject,project,propertyPath) {
    
    function getProp(o) {
      const parts = propertyPath.split('.')
      
      for (let part of parts) {
        o = !o ? null : o[part]
      }
      
      return o
    }
    const
      system = this.system.toLowerCase(),
      rootProjectOverrides = getValue(() => rootProject.config.dependencies[project.name]),
      allOverrides = [
        getValue(() => getProp(project.config.systems[system]), null),
        getValue(() => getProp(this), null),
        getValue(() => getProp(rootProjectOverrides),null),
        getValue(() => getProp(rootProjectOverrides.systems[system]), null)
      ].filter(Boolean)
    
    return allOverrides
      .reduce((overrideOpts,nextOverrideOpts) => Object.assign(overrideOpts,nextOverrideOpts),{})
  
  }
  
  /**
   * Create toolchain environment config
   * from cmake toolchain export
   *
   * @returns {*}
   */
  toScriptEnvironment(rootProject,project) {
    // GET SYSTEM OVERRIDES
    const props = {
      ...Environment,
      ...this.toSystemOverrides(rootProject,project,'build.options'),
      ARCH: this.arch,
      SYSTEM: this.system
    }
    
    if (this.system === System.IOS) {
      const xcodeResult = sh.exec("xcode-select --print-path")
      Assert.ok(xcodeResult.code === 0, `Unable to determine xcode path: ${xcodeResult.stderr}/${xcodeResult.stdout}`)
      
      const xcodeBinPath = `${xcodeResult.stdout.trim().replace("\n","")}/Toolchains/XcodeDefault.xctoolchain/usr/bin`
      Assert.ok(isDirectory(xcodeBinPath), `Invalid xcode bin ${xcodeBinPath}`)
      
      props.PATH = `${xcodeBinPath}:${process.env.PATH}`
    }
    
    if (!this.file)
      return props
    
    // RUN TOOLCHAIN EXPORT SCRIPT
    // noinspection JSCheckFunctionSignatures
    const
      outputFile = `${sh.tempdir()}/toolchain.properties`,
      toolchainArgs = Object.entries({
          ...(this.androidOpts || {}),
          ...this.toCMakeOptions()
      }).map(([key,value]) => `-D${key}=${value}`),
      cmakeContext = {
        toolchainFile: this.file,
        android: isDefined(this.androidOpts)
      },
      cmakeToolchainTmpFile = Tmp.fileSync({mode: 777, prefix: `${this.toString()}-`, postfix: '.cmake'})
  
    sh.exec(`chmod 777 ${cmakeToolchainTmpFile.name}`)
    processTemplate(File.readAsset("cxxpods.toolchain.cmake.hbs"),cmakeContext,cmakeToolchainTmpFile.name)
    
    sh.env["CXXPODS_EXPORT_FILE"] = outputFile
    
    const result = sh.exec(`${Paths.CMake} -DCXXPODS_TOOLCHAIN_EXPORT=ON ${toolchainArgs.join(" ")} -P ${cmakeToolchainTmpFile.name}`)
    Assert.ok(result.code === 0,`Failed to get toolchain export: ${outputFile}`)
    
    sh.env["CXXPODS_EXPORT_FILE"] = null
    
    
    // ASSIGN TO EXPORT PROPS
    Object.assign(props, File.readFileProperties(outputFile))
    if (!props.CMAKE_CROSS_PREFIX) {
      log.info(`No CMAKE_CROSS_PREFIX returned from tool chain`, props)
      return props
    }
    const
      makeCrossTool = (name,optional = false) => {
        let toolPath = `${props.CMAKE_CROSS_PREFIX}${name}${props.CMAKE_CROSS_SUFFIX || ""}`
        const exists = File.exists(toolPath)
        if (!exists) {
          if (!optional) {
            throw `Tool path for ${name} does not exist: ${toolPath}`
          } else {
            log.info(`Unable to find optional tool ${name} @ ${toolPath}`)
            toolPath = null
          }
        }
        return toolPath
      }
    
    Object.assign(props,{
      CC: makeCrossTool('gcc'),
      CXX: makeCrossTool('g++'),
      CPP: makeCrossTool('g++'),
      AR: makeCrossTool('ar'),
      RANLIB: makeCrossTool('ranlib'),
      OBJDUMP: makeCrossTool('objdump'),
      STRIP: makeCrossTool('strip'),
      NM: makeCrossTool('nm'),
      OBJCOPY: makeCrossTool('objcopy'),
      LD: makeCrossTool('ld'),
      LDD: makeCrossTool('ldd', true),
      STRINGS: makeCrossTool('strings', true),
      SYSROOT: props.SYSROOT || props.CMAKE_SYSROOT,
      ARCH: this.arch,
      SYSTEM: this.system
    })
    return props
  }
  
  isAndroidToolchain() {
    return this.system === System.Android || this.android
  }
  
  
  /**
   * Create CMake command line options
   */
  toCMakeOptions(rootProject,project) {
    const opts = {}
    
    if (this.androidOpts) {
      Object.assign(opts,this.androidOpts, { ANDROID: "ON" })
    } else if (this.file) {
      opts["CMAKE_TOOLCHAIN_FILE"] = this.file
    }
    
    // SYSROOT IF POSSIBLE
    let sysroot = !_.isEmpty(opts.CMAKE_SYSROOT) ? opts.CMAKE_SYSROOT : !_.isEmpty(opts.SYSROOT) ? opts.SYSROOT : null
    if (sysroot) {
      Object.assign(opts,{
        SYSROOT: sysroot,
        CMAKE_SYSROOT: sysroot
      })
    }
    
    if (this.isAndroidToolchain()) {
      Object.assign(opts, {
        ...this.toAndroidCMakeOptions(opts)
      })
    }
    
    // GET ALL TOP LEVEL & SYSTEM OVERRIDES
    let overrideOpts = this.toSystemOverrides(rootProject,project,'cmake.flags')
    
    // MERGE EVERYTHING TOGETHER
    return Object.assign(opts,overrideOpts)
  }
  
  toAndroidCMakeOptions(opts) {
    const androidNdk = process.env.ANDROID_NDK || opts["ANDROID_NDK"]
    Assert.ok(!!androidNdk, "Android NDK is not defined")
    
    const sysroot = Path.join(androidNdk, "sysroot")
    
    return {
      ANDROID_ABI: ArchToAndroidABIMap[this.arch],
      ANDROID_NDK: androidNdk,
      SYSROOT: sysroot,
      CMAKE_SYSROOT: sysroot,
      CMAKE_CROSS_SUFFIX: "",
      CMAKE_CROSS_PREFIX: "",
      ANDROID_SYSTEM_LIBRARY_PATH: "",
      ANDROID_PLATFORM: "",
      ANDROID_COMPILER_FLAGS: "",
      ANDROID_HEADER_TRIPLE: "",
      ANDROID_TOOLCHAIN_PREFIX: "",
      ANDROID_LLVM_TOOLCHAIN_PREFIX: "",
      ANDROID_C_COMPILER: "",
      ANDROID_CXX_COMPILER: "",
      ANDROID_ASM_COMPILER: ""
    }
  }
  
  /**
   * toString() is either an explicit name or triplet name
   *
   * @returns {*|string}
   */
  toString() {
    return this.triplet.tupleName
  }
}


/**
 * The host toolchain
 *
 * @type {Toolchain}
 */
Toolchain.host = Toolchain.makeHostToolchain(Triplet.host)
