const
  {GetLogger} = require("./Log"),
  {resolveDependency} = require("./repo/Repo"),
  sh = require("shelljs"),
  OS = require("os"),
  log = GetLogger(__filename),
  File = require("./util/File"),
  _ = require('lodash')


class Dependency {
  constructor(rootProject,name,version) {
    
    const Project = require("./Project")
    
    this.name = name
    this.version = version
    this.resolved = false
    this.dir = resolveDependency(name)
    this.rootProject = rootProject
    this.project = new Project(this.dir, rootProject)
    this.buildConfigs = rootProject.buildTypes.map(buildType => ({
      type: buildType,
      src: `${buildType.dir}/${this.name}-src`,
      build: `${buildType.dir}/${this.name}-build`,
    }))
  }
}


function configureDependencies(project) {
  const
    configuredDependencies = project.config.dependencies || {}
  
  project.dependencies = Object
    .keys(configuredDependencies)
    .map(name => new Dependency(project,name,configuredDependencies[name]))
}


module.exports = {
  configureDependencies,
  Dependency
}