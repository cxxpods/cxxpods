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
          !maxVersion || SemVer.gt(version.version,maxVersion.version) ?
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
  constructor(rootProject,name,version) {
    
    const Project = require("./Project")
    
    this.name = name
    this.version = version
    this.resolved = false
    this.dir = resolveDependency(name)
    this.rootProject = rootProject
    this.project = new Project(this.dir, rootProject)
    this.buildConfigs = rootProject.buildTypes.map(buildType => ({
      type: buildType,
      src: `${buildType.dir}/${this.name}-src`,
      build: `${buildType.dir}/${this.name}-build`,
    }))
    
    DependencyManager.registerDependency(this)
  }
}


/**
 * Configure project dependencies
 *
 * @param project
 */
Dependency.configureProject = function (project) {
  const
    configuredDependencies = project.config.dependencies || {}
  
  project.dependencies = Object
    .keys(configuredDependencies)
    .map(name => new Dependency(project,name,configuredDependencies[name]))
}


module.exports = {
  Dependency,
  DependencyManager
}