import File, {fixPath} from "../util/File"
import {getValue} from "typeguard"
import OS from 'os'
import Git from "simple-git/promise"
import {processTemplate} from "../util/Template"
import _ from "lodash"
import GetLogger from "../Log"
import Path from 'path'

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
        "--recurse-submodules": null
      })
    }
    // noinspection JSUnresolvedFunction
    const
      git = Git(src),
      branchSummary = await git.branchLocal()
  
    // noinspection JSCheckFunctionSignatures
    await git.raw(['fetch', '--all', '--tags', '--prune'])
  
    // noinspection JSCheckFunctionSignatures
    const
      tags = await git.tags(),
      realVersion = tags.all.find(tag => tag.includes(version))
  
    if (!realVersion)
      throw `Unable to find tag for version: ${version}`
  
    if (realVersion === branchSummary.current) {
      log.info(`${type} Source is already prepared`)
    } else {
      log.info(`${type} Preparing ${name}@${realVersion} for configuration`)
      await git.checkout([`tags/${realVersion}`, '-b', `${realVersion}`])
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