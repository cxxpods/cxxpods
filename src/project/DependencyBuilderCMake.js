import DependencyBuilder from "./DependencyBuilder"
import {Environment, IsWindows, Paths} from "../Config"
import {processTemplate} from "../util/Template"
import {findCXXPodsConfigFile} from "../util/ProjectUtils"
import File from "../util/File"
import Path from 'path'
import {printObject} from "../util/Debug"
import {getValue} from "typeguard"
import CMakeOptions from "../util/CMakeOptions"
import * as _ from "lodash"
import GetLogger from "../Log"
import * as sh from 'shelljs'
import * as Fs from 'fs'

const log = GetLogger(__filename)

export default class DependencyBuilderCMake extends DependencyBuilder {
  
  /**
   * Override type
   *
   * @returns {string}
   */
  get type() {
    return "CMake";
  }
  
  /**
   * Make dependency cmake file
   *
   * @returns {Promise<void>}
   */
  async makeDependencyCMakeFile() {
    const
      {src, type: buildType} = this.buildConfig,
      configFile = findCXXPodsConfigFile(src),
      {toolsRoot} = this.project
  
    if (!configFile) {
      return
    }
  
    const
      cmakeOutputDir = `${src}/.cxxpods`,
      cmakeOutputFile = `${cmakeOutputDir}/cxxpods.cmake`,
      cmakeContext = {
        ...buildType,
        name: buildType.name.replace(/-/g, "_").toLowerCase(),
        nameUpper: buildType.name.replace(/-/g, "_").toUpperCase(),
        rootDir: buildType.rootDir.replace(/\\/g,'/'),
        toolsRoot,
        toolchain: buildType.toolchain
      }
  
    log.info(`Writing CMake file: ${cmakeOutputFile}`)
    File.mkdirs(cmakeOutputDir)
    processTemplate(File.readAsset("cxxpods.dep.cmake.hbs"), cmakeContext, cmakeOutputFile)
  }
  
  /**
   * Configure a dependency
   *
   * @returns {Promise<CMakeOptions>}
   */
  async configureDependency() {
    const
      {src, build, type} = this.buildConfig
    
    // MAKE CXXPODS CMAKE FILE IF REQUIRED
    await this.makeDependencyCMakeFile()
    
    // NOW CONFIGURE THE BUILD
    const
      cmakeConfig = getValue(() => this.dep.project.config.cmake, {}),
      cmakeRoot = Path.resolve(src, cmakeConfig.root || ""),
      cmakeFlags = getValue(() => cmakeConfig.flags, {})
    
    let
      cmakeOptionsObj = _.merge(
        {},
        cmakeFlags,
        type.toCMakeOptions(this.project,this.dep.project)),
      cmakeEnv = type.toScriptEnvironment(this.project,this.dep.project)
  
  
    const
      ccacheExe = sh.which("ccache") || "",
      distccExe = sh.which("distcc") || ""
  
    let
      CMAKE_CXX_COMPILER_LAUNCHER = "",
      CMAKE_C_COMPILER_LAUNCHER = ""
  
    if (ccacheExe.length && Fs.existsSync(ccacheExe)) {
      CMAKE_CXX_COMPILER_LAUNCHER = ccacheExe
      CMAKE_C_COMPILER_LAUNCHER = ccacheExe
    }
  
    if (distccExe.length && Fs.existsSync(distccExe)) {
      if (CMAKE_CXX_COMPILER_LAUNCHER.length) {
        CMAKE_CXX_COMPILER_LAUNCHER = ` ${ccacheExe}`
        CMAKE_C_COMPILER_LAUNCHER = ` ${ccacheExe}`
      }
    
      CMAKE_CXX_COMPILER_LAUNCHER = `${distccExe} ${CMAKE_CXX_COMPILER_LAUNCHER}`
      CMAKE_C_COMPILER_LAUNCHER = `${distccExe} ${CMAKE_C_COMPILER_LAUNCHER}`
    }
  
    cmakeOptionsObj = {
      ...cmakeOptionsObj,
      ...(
        !CMAKE_CXX_COMPILER_LAUNCHER.length ?
          {} :
          {
            CMAKE_CXX_COMPILER_LAUNCHER,
            CMAKE_C_COMPILER_LAUNCHER
          })
    }
    const
      cmakeOptions = new CMakeOptions(cmakeOptionsObj),
      cmakeCmd = `${Paths.CMake} ${cmakeOptions} ${cmakeRoot}`
    
    
    printObject(cmakeOptionsObj, `CMake Option (${this.dep.name})\t`)
    
    File.mkdirs(build)
    sh.pushd(build)
    log.info(`Configuring with cmake root: ${cmakeRoot}`)
    log.info(`Using command: ${cmakeCmd}`)
    if (sh.exec(cmakeCmd, {
      cwd: build,
      env: {
        ...process.env,
        ...cmakeEnv
      }
    }).code !== 0) {
      throw `CMake config failed`
    }
    sh.popd()
    log.info(`CMake successfully configured`)
    return cmakeOptions
  }
  
  /**
   * Build dependency
   *
   * @returns {Promise<void>}
   */
  async build() {
    const
      {name, version} = this.dep
  
    const cmakeOpts = await this.configureDependency()
  
    // BUILD IT BIGGER
    sh.pushd(this.buildDir)
    
    const
      cmakeBuildType = cmakeOpts.get("CMAKE_BUILD_TYPE","Release"),
      makeCmd = `${Paths.CMake} --build . ${!IsWindows ? `-- -j${Environment.CXXPODS_PROC_COUNT}` : ` -- /P:Configuration=${cmakeBuildType}`}`,
      cmakeEnv = this.buildConfig.type.toScriptEnvironment(this.project,this.dep.project)
  
    log.info(`Making ${name}@${version} with: ${makeCmd}`)
    if (sh.exec(makeCmd, {
      env: {
        ...process.env,
        ...cmakeEnv
      }
    }).code !== 0) {
      throw `Make failed`
    }
    sh.popd()
    log.info("Make completed successfully")
  
    // INSTALL
    sh.pushd(this.buildDir)
    log.info(`Proc count for build: ${Environment.CXXPODS_PROC_COUNT}`)
    const
      installCmd = IsWindows ?
        `${Paths.CMake} --build . --target INSTALL -- /P:Configuration=${cmakeBuildType}` :
        `${Paths.Make} -j${Environment.CXXPODS_PROC_COUNT} install`
    log.info(`Installing ${name}@${version} with: ${installCmd}`)
    if (sh.exec(installCmd, {
      env: {
        ...process.env,
        ...cmakeEnv
      }}).code !== 0) {
      throw `Install failed`
    }
    sh.popd()
  
    log.info("Installed successfully")
  }
}