const
  {GetLogger} = require("../Log"),
  {resolveDependency} = require("../repo/Repo"),
  sh = require("shelljs"),
  OS = require("os"),
  log = GetLogger(__filename),
  File = require("../util/File"),
  _ = require('lodash'),
  SemVer = require("semver")

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
            !maxVersion || SemVer.gt(SemVer.coerce(version.version),SemVer.coerce(maxVersion.version)) ?
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
class Dependency {
  
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
  
  /**
   * Create a dependency instance
   *
   * @param rootProject
   * @param name
   * @param version
   * @param isTool
   */
  constructor(rootProject,name,version, isTool) {
    
    const
      Project = require("./Project"),
      Tool = require("./Tool")
    
    this.isTool = isTool
    this.name = name
    this.version = version
    this.resolved = false
    this.dir = resolveDependency(name)
    this.rootProject = rootProject
    this.project = new Project(this.dir, rootProject, isTool)
    this.buildConfigs = isTool ?
      // MAKE TOOL BUILD CONFIGS
      Tool.makeBuildConfigs(rootProject, name) :
      
      // NORMAL BUILD CONFIGS
      rootProject.buildTypes.map(buildType => ({
        type: buildType,
        src: `${buildType.dir}/${this.name}-src`,
        build: `${buildType.dir}/${this.name}-build`,
      }))
    
    if (isTool)
      Tool.registerTool(this)
    else
      DependencyManager.registerDependency(this)
  }
  
  toBuildStamp(buildConfig) {
    const cmakeConfig = _.get(this,'project.config.cmake',{})
    return {
      name: this.name,
      version: this.version,
      dir: this.dir,
      buildConfig: {
        src: buildConfig.src,
        build: buildConfig.build
      },
      buildType: buildConfig.type.toBuildStamp(),
      cmakeConfig,
      cmakeFindTemplateTimestamp: cmakeConfig.findTemplate ?
        File.getFileModifiedTimestamp(`${this.dir}/${cmakeConfig.findTemplate}`) :
        0
    }
  }
  
  
}





module.exports = {
  Dependency,
  DependencyManager
}