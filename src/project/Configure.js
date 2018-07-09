import GetLogger from "../Log"
import {IsWindows,Paths} from "../Config"
import Project from "./Project"
import * as sh from "shelljs"
import Fs from 'fs'
import File from "../util/File"
import Assert from "../util/Assert"
import CMakeOptions from "../util/CMakeOptions"
import Path from "path"
import OS from 'os'
import Git from "simple-git/promise"
import {getValue} from "typeguard"
import _ from 'lodash'
import {CUnitExtensions} from "../Constants"
import {processTemplate} from "../util/Template"
import Tmp from "tmp"
import BuildType from "./BuiltType"
import {printObject} from "../util/Debug"

const
  log = GetLogger(__filename),
  BuildSteps = ["preconfigure", "configure", "build", "install"]


/**
 * Checkout and update dependency source code
 *
 * @param project
 * @param dep
 * @param buildConfig
 * @returns {Promise<void>}
 */
async function checkoutDependencyAndUpdateSource(project, dep, buildConfig) {
  const
    {name, version} = dep,
    {src, type} = buildConfig,
    {url} = getValue(() => dep.project.config.repository, {})
  
  if (!File.isDirectory(src)) {
    const parent = Path.dirname(src)
    
    File.mkdirs(parent)
    
    const git = Git(parent)
    await git.clone(url, src, {
      "--depth": "1",
      "--recurse-submodules": null
    })
  }
  // noinspection JSUnresolvedFunction
  const
    git = Git(src),
    branchSummary = await git.branchLocal(),
    remotes = await git.getRemotes(true),
    remote = remotes[0].name
  
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

/**
 * Find a cunit config file
 *
 * @param path
 * @param name
 */
export function findCUnitConfigFile(path, name = 'cunit') {
  return CUnitExtensions.map(ext => `${path}/${name}${ext}`).find(filename => Fs.existsSync(filename))
}


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
    cmakeOutputDir = `${projectDir}/.cunit`,
    cmakeOutputFile = `${cmakeOutputDir}/cunit.cmake`,
    cmakeOutputToolchainFile = `${cmakeOutputDir}/cunit.toolchain.cmake`,
    
    cmakeBuildTypes = buildTypes.map(buildType => ({
      ...buildType,
      name: buildType.name.replace(/-/g, "_").toLowerCase(),
      nameUpper: buildType.name.replace(/-/g, "_").toUpperCase(),
      rootDir: buildType.rootDir.replace(/\\/g,'/'),
      toolchain: buildType.toolchain
    })),
    cmakeContext = {
      android: android === true,
      toolsRoot: toolsRoot.replace(/\\/g,'/'),
      defaultBuildTypeName: cmakeBuildTypes[0].name,
      buildTypes: cmakeBuildTypes,
      buildTypeNames: cmakeBuildTypes.map(buildType => buildType.name).join(";")
    }
  
  File.mkdirs(cmakeOutputDir)
  log.info(`Writing CMake file: ${cmakeOutputFile}`)
  processTemplate(File.readAsset("cunit.cmake.hbs"), cmakeContext, cmakeOutputFile)
  
  log.info(`Writing CMake Toolchain file: ${cmakeOutputToolchainFile}`)
  processTemplate(File.readAsset("cunit.toolchain.cmake.hbs"), cmakeContext, cmakeOutputToolchainFile)
}


/**
 * Create a dependency cmake file
 *
 * @param project
 * @param buildConfig
 * @returns {Promise<void>}
 */
async function makeDependencyCMakeFile(project, buildConfig) {
  const
    {src, type: buildType} = buildConfig,
    configFile = findCUnitConfigFile(src),
    {toolsRoot} = project
  
  if (!configFile) {
    return
  }
  
  const
    cmakeOutputDir = `${src}/.cunit`,
    cmakeOutputFile = `${cmakeOutputDir}/cunit.cmake`,
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
  processTemplate(File.readAsset("cunit.dep.cmake.hbs"), cmakeContext, cmakeOutputFile)
}

/**
 * Configure a dependency
 *
 * @param project
 * @param dep
 * @param buildConfig
 * @returns {Promise<void>}
 */
async function configureDependency(project, dep, buildConfig) {
  const
    {src, build, type} = buildConfig
  
  // MAKE CUNIT CMAKE FILE IF REQUIRED
  await makeDependencyCMakeFile(project, buildConfig)
  
  // NOW CONFIGURE THE BUILD
  const
    cmakeConfig = getValue(() => dep.project.config.cmake, {}),
    cmakeRoot = Path.resolve(src, cmakeConfig.root || ""),
    cmakeFlags = getValue(() => cmakeConfig.flags, {}),
    cmakeOptionsObj = _.merge(
      {},
      cmakeFlags,
      type.toCMakeOptions(project,dep.project)),
    cmakeOptions = new CMakeOptions(cmakeOptionsObj),
    cmakeCmd = `${Paths.CMake} ${cmakeOptions} ${cmakeRoot}`
  
  
  printObject(cmakeOptionsObj, `CMake Option (${dep.name})\t`)
  
  File.mkdirs(build)
  sh.pushd(build)
  log.info(`Configuring with cmake root: ${cmakeRoot}`)
  log.info(`Using command: ${cmakeCmd}`)
  if (sh.exec(cmakeCmd).code !== 0) {
    throw `CMake config failed`
  }
  sh.popd()
  log.info(`CMake successfully configured`)
  return cmakeOptions  
}

/**
 * Build a CMake Dependency
 *
 * @param project
 * @param dep
 * @param buildConfig
 * @returns {Promise<void>}
 */
async function buildDependencyCMake(project, dep, buildConfig) {
  const
    {name, version} = dep,
    {src, build, type:buildType} = buildConfig,
    {toolchain} = buildType
  
  
  const cmakeOpts = await configureDependency(project, dep, buildConfig)
  
  // BUILD IT BIGGER
  sh.pushd(build)
  const 
    cmakeBuildType = cmakeOpts.get("CMAKE_BUILD_TYPE","Release"),
    makeCmd = `${Paths.CMake} --build . ${!IsWindows ? `-- -j${OS.cpus().length}` : ` -- /P:Configuration=${cmakeBuildType}`}`
  
    log.info(`Making ${name}@${version} with: ${makeCmd}`)
  if (sh.exec(makeCmd).code !== 0) {
    throw `Make failed`
  }
  sh.popd()
  log.info("Make completed successfully")
  
  // INSTALL 
  sh.pushd(build)
  const 
    installCmd = IsWindows ?
      `${Paths.CMake} --build . --target INSTALL -- /P:Configuration=${cmakeBuildType}` : 
      `${Paths.Make} -j${OS.cpus().length} install`
  log.info(`Installing ${name}@${version} with: ${installCmd}`)
  if (sh.exec(installCmd).code !== 0) {
    throw `Install failed`
  }
  sh.popd()
  
  log.info("Installed successfully")
  
}

/**
 * Build a manual dependency
 *
 * @param project
 * @param dep
 * @param buildConfig
 * @returns {Promise<void>}
 */
async function buildDependencyManual(project, dep, buildConfig) {
  const
    {dir, name, version, project: {config: {build: buildStepConfigs}}} = dep,
    {type, src: srcDir, build: buildDir} = buildConfig,
    scriptEnv = type.toScriptEnvironment()
  
  
  sh.pushd(srcDir)
  BuildSteps.forEach(stepName => {
    const stepConfig = buildStepConfigs[stepName]
    if (!stepConfig || (!stepConfig.script && !stepConfig.file))
      return
    
    log.info(`${name} - ${stepName} starting...`)
    
    let scriptFile, tmpFile
    
    // EXPLICIT SCRIPT
    if (stepConfig.script) {
      // noinspection JSCheckFunctionSignatures
      tmpFile = Tmp.fileSync({mode: 777, prefix: `${name}-${stepName}-`, postfix: '.sh'})
      sh.exec(`chmod 777 ${tmpFile.name}`)
      scriptFile = tmpFile.name
      File.writeFile(scriptFile, `#!/bin/bash -e \n\n${stepConfig.script}`)
    } else {
      scriptFile = `${dir}/${stepConfig.file}`
    }
    
    log.info(`${name} - ${stepName} executing: ${scriptFile}`)
    Assert.ok(File.exists(scriptFile), `Unable to find: ${scriptFile}`)
    Object.assign(sh.env, scriptEnv)
    
    if (sh.exec(scriptFile).code !== 0) {
      throw `An error occurred while executing: ${scriptFile}`
    }
    
    
    // CLEANUP IF WE USED A TMP OBJECT
    if (tmpFile) {
      tmpFile.removeCallback()
    }
  })
  sh.popd()
}

/**
 * Read a build stamp
 *
 * @param buildConfig
 * @param dep
 * @return {boolean}
 */
function hasDependencyChanged(dep, buildConfig) {
  const
    buildStampFile = `${buildConfig.build}/.cunit-build-stamp`,
    exists = File.exists(buildStampFile),
    existingBuildStamp = exists ? File.readFile(buildStampFile) : null,
    newBuildStamp = JSON.stringify(dep.toBuildStamp(buildConfig))
  
  return !exists || existingBuildStamp !== newBuildStamp
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
    changed = hasDependencyChanged(dep, buildConfig)
  
  if (!changed) {
    log.info(`${buildConfig.type}: Dependency ${name}@${version} has not changed, skipping`)
    return
  }
  
  // CHECKOUT+UPDATE DEPENDENCY SOURCE
  await checkoutDependencyAndUpdateSource(project, dep, buildConfig)
  
  
  switch (buildType) {
    case "manual":
      await buildDependencyManual(project, dep, buildConfig)
      break;
    default:
      await buildDependencyCMake(project, dep, buildConfig)
      break;
  }
  
  postDependencyInstall(project, dep, buildConfig)
}

/**
 * Post installation steps
 *
 * @param project
 * @param dep
 * @param buildConfig
 */
function postDependencyInstall(project, dep, buildConfig) {
  const
    {type, build: buildDir} = buildConfig,
    rootDir = type.rootDir.replace(/\\/g,'/'),
    cmakeConfig = getValue(() => dep.project.config.cmake, {}),
    {findTemplate: cmakeFindTemplate, toolTemplate: cmakeToolTemplate} = cmakeConfig,
    
    cmakeContext = {
      cunitRootDir: rootDir,
      cunitLibDir: `${rootDir}/lib`,
      cunitIncludeDir: `${rootDir}/include`,
      cunitCMakeDir: `${rootDir}/lib/cmake`
    },
    
    processCMakeTemplate = (cmakeTemplate) => {
      const
        templatePath = `${dep.dir}/${cmakeTemplate}`,
        findFilename = `${rootDir}/lib/cmake/${_.last(_.split(cmakeTemplate, "/")).replace(/\.hbs$/, "")}`
      
      log.info(`Writing file: ${findFilename}`)
      File.mkdirParents(findFilename)
      
      processTemplate(File.readFile(templatePath), cmakeContext, findFilename)
    }
  
  
  [cmakeFindTemplate, cmakeToolTemplate]
    .filter(it => !_.isEmpty(it))
    .forEach(processCMakeTemplate)
  
  // Write the build stamp at the very end
  writeDependencyBuildStamp(dep, buildConfig)
}

function writeDependencyBuildStamp(dep, buildConfig) {
  const buildStampFile = `${buildConfig.build}/.cunit-build-stamp`
  File.mkdirParents(buildStampFile)
  File.writeFileJSON(buildStampFile, dep.toBuildStamp(buildConfig))
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
