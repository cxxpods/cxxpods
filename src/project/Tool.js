const
  {GetLogger} = require("../Log"),
  {resolveDependency} = require("../repo/Repo"),
  sh = require("shelljs"),
  OS = require("os"),
  log = GetLogger(__filename),
  File = require("../util/File"),
  _ = require('lodash'),
  SemVer = require("semver"),
  allTools = []

class Tool {
  
  /**
   * Configure all the tools for a project
   *
   * @param project
   */
  static configureProject(project) {
    const
      configuredTools = {
        ...(project.config.tools || {}),
        ...(!project.isTool || project.rootProject === null ? {} : project.config.dependencies || {})
      }
  
    project.tools = Object
      .entries(configuredTools)
      .map(([name,version]) => new Tool(project,name,version))
  
  }
  
  static registerTool(tool) {
    allTools.push(tool)
  }
  
  static collectTools(project, tools = []) {
    tools = tools || []
  
    project.tools.forEach(dep => {
      if (!tools.includes(dep)) {
        tools.push(dep.name)
        Tool.collectTools(dep.project, tools)
      }
    })
  
    return tools
  }
  
  static toDependencyGraph() {
    return _.map(
      // FIND MAX UNIQUE VERSION FIRST
      _.groupBy(allTools,"name"), versionGroup =>
        versionGroup.reduce((maxVersion, version) =>
            !maxVersion || SemVer.gt(SemVer.coerce(version.version),SemVer.coerce(maxVersion.version)) ?
              version :
              maxVersion
          , null))
    
      // SORT BY INTER-DEPENDENCY
      .sort((toolA,toolB) => {
        const
          toolATools = Tool.collectTools(toolA.project),
          toolBTools = Tool.collectTools(toolB.project),
          toolARequiresB = toolATools.includes(toolB.name),
          toolBRequiresA = toolBTools.includes(toolA.name)
      
        if (toolARequiresB && toolBRequiresA)
          throw `Dependency circular requirement: ${toolA.name} <~> ${toolB.name}`
      
        return (!toolARequiresB && !toolARequiresB) ? 0 : toolARequiresB ? 1 : -1
      })
  }
  
  static makeBuildConfigs(rootProject,name) {
    return [{
      type: rootProject.toolsBuildType,
      src: `${rootProject.toolsDir}/${name}-src`,
      build: `${rootProject.toolsDir}/${name}-build`
    }]
  }
  
  constructor(rootProject,name,version) {
    const Project = require("./Project")
  
    this.name = name
    this.version = version
    this.resolved = false
    this.dir = resolveDependency(name)
    this.rootProject = rootProject
    this.project = new Project(this.dir, rootProject, true)
    
    this.buildConfigs = Tool.makeBuildConfigs(rootProject, name)
    
    Tool.registerTool(this)
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


module.exports = Tool