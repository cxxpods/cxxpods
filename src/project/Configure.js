import GetLogger from "../Log"
import Project from "./Project"
import * as sh from "shelljs"
import File, {fixPath} from "../util/File"
import {getValue} from "typeguard"
import _ from 'lodash'
import {processTemplate} from "../util/Template"

import BuildType from "./BuiltType"
import DependencyBuilderCMake from "./DependencyBuilderCMake"
import DependencyBuilderManual from "./DependencyBuilderManual"

const
  log = GetLogger(__filename)
  





/**
 * Create a dependency cmake file
 *
 * @param project
 * @returns {Promise<void>}
 */
export async function makeCMakeFile(project) {
  const
    {buildTypes, projectDir, toolsRoot, config, android} = project
  
  
  const
    cmakeOutputDir = `${projectDir}/.cxxpods`,
    cmakeOutputFile = `${cmakeOutputDir}/cxxpods.cmake`,
    cmakeOutputToolchainFile = `${cmakeOutputDir}/cxxpods.toolchain.cmake`,
    
    cmakeBuildTypes = buildTypes.map(buildType => ({
      ...buildType,
      name: buildType.name.replace(/-/g, "_").toLowerCase(),
      nameUpper: buildType.name.replace(/-/g, "_").toUpperCase(),
      rootDir: fixPath(buildType.rootDir),
      toolchain: buildType.toolchain
    })),
    cmakeContext = {
      android: android === true,
      toolsRoot: fixPath(toolsRoot),
      defaultBuildTypeName: getValue(() => cmakeBuildTypes[0].name,""),
      buildTypes: cmakeBuildTypes,
      buildTypeNames: cmakeBuildTypes.map(buildType => buildType.name).join(";")
    }
  
  File.mkdirs(cmakeOutputDir)
  log.info(`Writing CMake file: ${cmakeOutputFile}`)
  processTemplate(File.readAsset("cxxpods.cmake.hbs"), cmakeContext, cmakeOutputFile)
  
  log.info(`Writing CMake Toolchain file: ${cmakeOutputToolchainFile}`)
  processTemplate(File.readAsset("cxxpods.toolchain.cmake.hbs"), cmakeContext, cmakeOutputToolchainFile)
}




/**
 * Build a dependency
 *
 * @param project
 * @param dep
 * @param buildConfig
 * @returns {Promise<void>}
 */
async function buildDependency(project, dep, buildConfig) {
  const
    {name, version, project: {config: {buildType = "cmake"}}} = dep,
    builder = buildType === 'cmake' ?
      new DependencyBuilderCMake(project,dep,buildConfig) :
      new DependencyBuilderManual(project,dep,buildConfig)
  
  if (!builder.hasChanged) {
    log.info(`${buildConfig.type}: Dependency ${name}@${version} has not changed, skipping`)
    return
  }
  
  // CHECKOUT+UPDATE DEPENDENCY SOURCE
  await builder.checkout()
  await builder.triggerHook("preconfigure")
  await builder.applyOverrides()
  await builder.build()
  builder.finish()
  
}



/**
 * Build dependencies
 * @param project
 */
async function buildTools(project) {
  const {toolDependencyGraph} = Project
  
  for (let dep of toolDependencyGraph) {
    log.info(`\t${dep.name}@${dep.version}`)
    
    await buildDependency(project, dep, dep.buildConfigs[0])
  }
}

/**
 * Build dependencies
 * @param project
 */
async function buildDependencies(project) {
  const {dependencyGraph} = Project
  
  for (let dep of dependencyGraph) {
    log.info(`\t${dep.name}@${dep.version}`)
    
    for (let buildConfig of dep.buildConfigs) {
      await buildDependency(project, dep, buildConfig)
    }
  }
}

/**
 * Load project from disk
 *
 * @param path
 * @returns {Project}
 */
function loadProject(path = sh.pwd()) {
  return new Project(path)
}

/**
 * Configure project command
 *
 * @param argv
 */
export async function configure(argv) {
  const
    project = loadProject()
  
  log.info(`Generating cmake file: ${project.name}`)
  await makeCMakeFile(project)
  
  log.info(`Building tools first`)
  await buildTools(project)
  
  // ANDROID CHECK
  if (project.android) {
    try {
      BuildType.makeAndroidBuildType(project, argv)
    } catch (ex) {
      log.info("Unable to create android tool chain for android app, returning - config will likely build when you run cmake")
      console.log(ex)
    }
  }
  
  log.info(`Configuring ${project.name} dependencies`)
  await buildDependencies(project)
}
