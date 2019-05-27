import File, {exists, fixPath, isDirectory} from "../util/File"
import {getValue} from "typeguard"
import OS from 'os'
import * as Sh from 'shelljs'
import Git from "simple-git/promise"
import {processTemplate} from "../util/Template"
import _ from "lodash"
import GetLogger from "../Log"
import * as Path from 'path'
import * as Fs from "fs"

const
  log = GetLogger(__filename)

export default class DependencyBuilder {
  
  constructor(project,dep,buildConfig) {
    this.project = project
    this.dep = dep
    this.buildConfig = buildConfig
  }
  
  /**
   * Has the dependency changed since last built
   *
   * @returns {boolean}
   */
  get hasChanged() {
    const
      buildStampFile = `${this.buildDir}/.cxxpods-build-stamp`,
      exists = File.exists(buildStampFile),
      existingBuildStamp = exists ? File.readFile(buildStampFile) : null,
      newBuildStamp = JSON.stringify(this.dep.toBuildStamp(this.buildConfig))
  
    return !exists || existingBuildStamp !== newBuildStamp
  }
  
  /**
   * Source directory
   *
   * @returns {*}
   */
  get srcDir() {
    return this.buildConfig.src
  }
  
  /**
   * Build directory
   *
   * @returns {DependencyBuilder.build|string|*}
   */
  get buildDir() {
    return this.buildConfig.build
  }
  
  // noinspection JSMethodCanBeStatic
  /**
   * Type of builder
   */
  get type() {
    throw "Not implemented"
  }
  
  /**
   * Build type
   *
   * @returns {*}
   */
  get buildType() {
    return this.buildConfig.type
  }
  
  async applyOverrides() {
    const
      {dir} = this.dep,
      overrideDir = Path.join(dir, "override")
    
    log.debug(`Checking overrides: ${overrideDir}`)
    if (isDirectory(overrideDir)) {
      const {src} = this.buildConfig
      log.info("Applying overrides",overrideDir, "to", src)
      Sh.cp("-R", Path.join(overrideDir,"*"), src)
    }
  }
  
  async triggerHook(hook) {
    const
      {dir} = this.dep,
      {src} = this.buildConfig,
      hooksDir = Path.join(dir,"hooks"),
      hookDir = Path.join(hooksDir,hook)
    
    if (!isDirectory(hookDir)) {
      log.info("No hooks for", hook, "in", this.dep.name, dir, hooksDir, hookDir)
      return
    }
    
    const scripts = Fs.readdirSync(hookDir)
      .filter(file => !file.startsWith("."))
      .map(script => Path.join(hookDir, script))
    
    log.info("Scripts to run", scripts)
    
    scripts
      .forEach(script => {
        Sh.exec(script,{
          cwd: src
        })
      })
    
    
  }
  
  /**
   * Checkout the latest code
   *
   * @returns {Promise<void>}
   */
  async checkout() {
    const
      {name, version} = this.dep,
      {src, type} = this.buildConfig,
      {url} = getValue(() => this.dep.project.config.repository, {})
  
    if (!File.isDirectory(src)) {
      const parent = Path.dirname(src)
    
      File.mkdirs(parent)
    
      const git = Git(parent)
      await git.clone(url, src, {
        //"--depth": "1",
        //"--recurse-submodules": null
      })
    }
    // noinspection JSUnresolvedFunction
    const git = Git(src)
  
    try {
      await git.raw(['reset', '--hard'])
    } catch (err) {}
    
    // noinspection JSCheckFunctionSignatures
    await git.raw(['fetch', '--all', '--tags', '--prune'])
    await git.raw(['fetch'])
    
    // noinspection JSCheckFunctionSignatures
    const
      branchSummary = await git.branch(),
      tags = await git.tags()
    
    let
      realVersion = tags.all.find(tag => tag.includes(version)),
      fromBranch = false
    
    if (!realVersion) {
      //log.info(`All branches: ${JSON.stringify(branchSummary,null,2)}`)
      realVersion = branchSummary.all.find(branch => branch.includes(version))
      fromBranch = !!realVersion
    }
    
    if (!realVersion)
      throw `Unable to find TAG for version: ${version}`
  
    if (realVersion === branchSummary.current) {
      log.info(`${type} Source is already prepared`)
    } else {
      log.info(`${type} Preparing ${name}@${realVersion} for configuration`)
      await git.checkout([(fromBranch ? realVersion : `tags/${realVersion}`), '-b', `${realVersion}`])
      log.info(`${type} Ready to configure ${name}@${realVersion}`)
    }
  }
  
  // noinspection JSMethodCanBeStatic
  /**
   * Build fun - must be overridden
   */
  async build() {
    throw "Not implemented"
  }
  
  
  /**
   * Write a build-stamp or cache key
   */
  writeDependencyBuildStamp() {
    const buildStampFile = `${this.buildConfig.build}/.cxxpods-build-stamp`
    File.mkdirParents(buildStampFile)
    File.writeFileJSON(buildStampFile, this.dep.toBuildStamp(this.buildConfig))
  }
  
  
  /**
   * Finish the builder by creating CMake helper files, and stamp the build
   */
  finish() {
    const
      {type} = this.buildConfig,
      rootDir = fixPath(type.rootDir),
      cmakeConfig = getValue(() => this.dep.project.config.cmake, {}),
      {findTemplate: cmakeFindTemplate, toolTemplate: cmakeToolTemplate} = cmakeConfig,
    
      cmakeContext = {
        cxxpodsRootDir: rootDir,
        cxxpodsLibDir: `${rootDir}/lib`,
        cxxpodsIncludeDir: `${rootDir}/include`,
        cxxpodsCMakeDir: `${rootDir}/lib/cmake`
      },
    
      processCMakeTemplate = (cmakeTemplate) => {
        const
          templatePath = `${this.dep.dir}/${cmakeTemplate}`,
          findFilename = `${rootDir}/lib/cmake/${_.last(_.split(cmakeTemplate, "/")).replace(/\.hbs$/, "")}`
      
        log.info(`Writing file: ${findFilename}`)
        File.mkdirParents(findFilename)
      
        processTemplate(File.readFile(templatePath), cmakeContext, findFilename)
      }
  
  
    [cmakeFindTemplate, cmakeToolTemplate]
      .filter(it => !_.isEmpty(it))
      .forEach(processCMakeTemplate)
  
    // Write the build stamp at the very end
    this.writeDependencyBuildStamp()
  }
  
}