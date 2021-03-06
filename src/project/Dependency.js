import GetLogger from '../Log'
import {resolveDependency} from "../repo/Repo"
import * as sh from 'shelljs'
import OS from 'os'
import File from "../util/File"
import * as _ from 'lodash'
import * as SemVer from 'semver'
import {realRootProject} from "../util/ProjectUtils"
import {getValue} from "typeguard"

const
  log = GetLogger(__filename)

/**
 * Global dependency manager
 *
 * @type {{allDependencies: Array, registerDependency(*=): void}}
 */
const DependencyManager = {
  allDependencies: [],
  
  /**
   * Register a new dependency
   *
   * @param dependency
   */
  registerDependency(dependency) {
    this.allDependencies.push(dependency)
  },
  
  /**
   * Collection all project dependencies, recursively
   *
   * @param project
   * @param deps
   * @returns {Array}
   */
  collectDependencies(project, deps = []) {
    deps = deps || []
    
    project.dependencies.forEach(dep => {
      if (!deps.includes(dep)) {
        deps.push(dep.name)
        this.collectDependencies(dep.project, deps)
      }
    })
    
    return deps
  },
  
  /**
   * Create an ordered and sorted, unique dependency list
   */
  toDependencyGraph() {
    return _.map(
      // FIND MAX UNIQUE VERSION FIRST
      _.groupBy(this.allDependencies,"name"), versionGroup =>
        versionGroup.reduce((maxVersion, version) =>
            !maxVersion || getValue(() =>
              SemVer.gt(SemVer.coerce(version.version),SemVer.coerce(maxVersion.version)),
              version.version <= maxVersion.version
            ) ?
              version :
              maxVersion
          , null))
    
      // SORT BY INTER-DEPENDENCY
      .sort((depA,depB) => {
        const
          depADependencies = this.collectDependencies(depA.project),
          depBDependencies = this.collectDependencies(depB.project),
          depARequiresB = depADependencies.includes(depB.name),
          depBRequiresA = depBDependencies.includes(depA.name)
      
        if (depARequiresB && depBRequiresA)
          throw `Dependency circular requirement: ${depA.name} <~> ${depB.name}`
      
        return (!depARequiresB && !depARequiresB) ? 0 : depARequiresB ? 1 : -1
      })
  
  
  }
  
}

/**
 * All dependencies
 */
export default class Dependency {
  
  /**
   * Configure project dependencies
   *
   * @param project
   * @param isTool
   */
  static configureProject(project, isTool = false) {
    const
      configuredDependencies = project.config.dependencies || {}
    
    project.dependencies = Object
      .keys(configuredDependencies)
      .map(name => new Dependency(project,name,configuredDependencies[name], isTool))
  }
  
  static updateAllBuildConfigs() {
    DependencyManager.allDependencies.forEach(it => {
      log.info(`Updating build config for: ${it.name}, root project has ${it.project.rootProject.buildTypes.length} build types`)
      it.updateBuildConfigs()
    })
  }
  
  /**
   * Create a dependency instance
   *
   * @param rootProject
   * @param name
   * @param versionOrConfig
   * @param isTool
   */
  constructor(rootProject,name,versionOrConfig, isTool) {
    const
      [depConfig,version] = versionOrConfig && typeof versionOrConfig === 'object' ?
        [versionOrConfig, versionOrConfig.version] :
        [{}, versionOrConfig]
  
    rootProject = realRootProject(rootProject)
    
    const
      Project = require("./Project").default,
      Tool = require("./Tool").default
    
    this.isTool = isTool
    this.name = name
    this.version = version
    this.resolved = false
    this.dir = resolveDependency(name)
    this.rootProject = rootProject
    this.project = new Project(this.dir, rootProject, isTool, depConfig)
    this.updateBuildConfigs()
    
    if (isTool)
      Tool.registerTool(this)
    else
      DependencyManager.registerDependency(this)
  }
  
  updateBuildConfigs() {
    const Tool = require("./Tool").default
    
    this.buildConfigs = this.isTool ?
      
      // MAKE TOOL BUILD CONFIGS
      Tool.makeBuildConfigs(this.rootProject, this.name) :
    
      // NORMAL BUILD CONFIGS
      this.rootProject.buildTypes.map(buildType => ({
        type: buildType,
        src: `${buildType.dir}/${this.name}-src`,
        build: `${buildType.dir}/${this.name}-build`,
      }))
  }
  
  toBuildStamp(buildConfig) {
    const cmakeConfig = _.get(this,'project.config.cmake',{})
    return _.omit({
      name: this.name,
      version: this.version,
      dir: this.dir,
      buildConfig: {
        src: buildConfig.src,
        build: buildConfig.build
      },
      buildType: buildConfig.type.toBuildStamp(),
      cmakeConfig,
      srcTimestamp: File.getFileModifiedTimestamp(buildConfig.src),
      dirTimestamp: File.getFileModifiedTimestamp(this.dir)
    }, "CMAKE_BUILD_TYPE")
  }
  
  
}

/**
 * Assign all Dependency manager functions to
 * Dependency as static values
 */
Object.assign(Dependency,DependencyManager)