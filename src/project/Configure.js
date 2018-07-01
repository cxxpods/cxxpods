const
  {GetLogger} = require("../Log"),
  {Paths} = require("../Config"),
  Project = require("./Project"),
  sh = require("shelljs"),
  Fs = require('fs'),
  log = GetLogger(__filename),
  File = require("../util/File"),
  Assert = require("../util/Assert"),
  CMakeOptions = require("../util/CMakeOptions"),
  ChildProcess = require("child_process"),
  Path = require("path"),
  OS = require('os'),
  Git = require("simple-git/promise"),
  {getValue} = require("typeguard"),
  _ = require('lodash'),
  {CUnitExtensions} = require("../Constants"),
  {processTemplate} = require("../util/Template"),
  BuildSteps = ["preconfigure","configure","build","install"],
  Tmp = require("tmp")


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
async function configure(argv) {
  const
    project = loadProject()
  
  log.info(`Generating cmake file: ${project.name}`)
  await makeCMakeFile(project)
  
  log.info(`Configuring ${project.name} dependencies`)
  await buildDependencies(project)
  
  
}


/**
 * Checkout and update dependency source code
 *
 * @param project
 * @param dep
 * @param buildConfig
 * @returns {Promise<void>}
 */
async function checkoutDependencyAndUpdateSource(project,dep,buildConfig) {
  const
    {name,version} = dep,
    {src,type} = buildConfig,
    {url} = getValue(() => dep.project.config.repository,{})
  
  if (!File.isDirectory(src)) {
    const parent = Path.dirname(src)
    
    File.mkdirs(parent)
    
    const git = Git(parent)
    await git.clone(url,src,{
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
  await git.fetch(remote,branchSummary.current,['--all','--tags','--prune'])
  
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
 */
function findCUnitConfigFile(path) {
  return CUnitExtensions.map(ext => `${path}/cunit${ext}`).find(filename => Fs.existsSync(filename))
}



/**
 * Create a dependency cmake file
 *
 * @param project
 * @returns {Promise<void>}
 */
async function makeCMakeFile(project) {
  const
    {buildTypes,projectDir} = project
  
  
  const
    cmakeOutputDir = `${projectDir}/.cunit`,
    cmakeOutputFile = `${cmakeOutputDir}/cunit.cmake`,
    cmakeOutputToolchainFile = `${cmakeOutputDir}/cunit.toolchain.cmake`,
    
    cmakeBuildTypes = buildTypes.map(buildType => ({
      ...buildType,
      name: buildType.name.replace(/-/g,"_").toLowerCase(),
      nameUpper: buildType.name.replace(/-/g,"_").toUpperCase(),
      rootDir: buildType.rootDir,
      toolchain: buildType.toolchain
    })),
    cmakeContext = {
      buildTypes: cmakeBuildTypes,
      buildTypeNames: cmakeBuildTypes.map(buildType => buildType.name).join(";")
    }
  
  File.mkdirs(cmakeOutputDir)
  log.info(`Writing CMake file: ${cmakeOutputFile}`)
  processTemplate(File.readAsset("cunit.cmake.hbs"),cmakeContext,cmakeOutputFile)
  
  log.info(`Writing CMake Toolchain file: ${cmakeOutputToolchainFile}`)
  processTemplate(File.readAsset("cunit.toolchain.cmake.hbs"),cmakeContext,cmakeOutputToolchainFile)
}


/**
 * Create a dependency cmake file
 *
 * @param buildConfig
 * @returns {Promise<void>}
 */
async function makeDependencyCMakeFile(buildConfig) {
  const {src,type} = buildConfig
  const configFile = findCUnitConfigFile(src)
  if (!configFile) {
    return
  }
  
  const
    cmakeOutputDir = `${src}/.cunit`,
    cmakeOutputFile = `${cmakeOutputDir}/cunit.cmake`,
    cmakeContext = {
      cunitRootDir: type.rootDir
    }
  
  log.info(`Writing CMake file: ${cmakeOutputFile}`)
  File.mkdirs(cmakeOutputDir)
  processTemplate(File.readAsset("cunit.dep.cmake.hbs"),cmakeContext,cmakeOutputFile)
}

/**
 * Configure a dependency
 *
 * @param project
 * @param dep
 * @param buildConfig
 * @returns {Promise<void>}
 */
async function configureDependency(project,dep,buildConfig) {
  const
    {src,build,type} = buildConfig
  
  // MAKE CUNIT CMAKE FILE IF REQUIRED
  await makeDependencyCMakeFile(buildConfig)
  
  // NOW CONFIGURE THE BUILD
  const
    cmakeConfig = getValue(() => dep.project.config.cmake,{}),
    cmakeRoot = Path.resolve(src,cmakeConfig.root || ""),
    cmakeFlags = getValue(() => cmakeConfig.flags,{}),
    cmakeOptions = new CMakeOptions(_.merge(
      {},
      cmakeFlags,
      type.toCMakeOptions())),
    cmakeCmd = `${Paths.CMake} ${cmakeOptions} ${cmakeRoot}`
  
  File.mkdirs(build)
  sh.cd(build)
  log.info(`Configuring with cmake root: ${cmakeRoot}`)
  log.info(`Using command: ${cmakeCmd}`)
  if (sh.exec(cmakeCmd).code !== 0) {
    throw `CMake config failed`
  }
  
  log.info(`CMake successfully configured`)
  
}


async function buildDependencyCMake(project,dep,buildConfig) {
  const
    {name,version} = dep
  
  
  
  await configureDependency(project,dep,buildConfig)
  
  // BUILD IT BIGGER
  const makeCmd = `${Paths.Make} -j${OS.cpus().length}`
  log.info(`Making ${name}@${version} with: ${makeCmd}`)
  if (sh.exec(makeCmd).code !== 0) {
    throw `Make failed`
  }
  
  log.info("Make completed successfully")
  
  const installCmd = `${Paths.Make} -j${OS.cpus().length} install`
  log.info(`Installing ${name}@${version} with: ${installCmd}`)
  if (sh.exec(installCmd).code !== 0) {
    throw `Install failed`
  }
  
  log.info("Installed successfully")
  
}


async function buildDependencyManual(project,dep,buildConfig) {
  const
    {dir,name,version,project:{config:{build:buildStepConfigs}}} = dep,
    {type,src:srcDir,build:buildDir} = buildConfig,
    scriptEnv = type.toScriptEnvironment()
    
  
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
      File.writeFile(scriptFile,`#!/bin/bash -e \n\n${stepConfig.script}`)
    } else {
      scriptFile = `${dir}/${stepConfig.file}`
    }
  
    log.info(`${name} - ${stepName} executing: ${scriptFile}`)
    Assert.ok(File.exists(scriptFile),`Unable to find: ${scriptFile}`)
    Object.assign(sh.env,scriptEnv)
    sh.cd(srcDir)
    if (sh.exec(scriptFile).code !== 0) {
      throw `An error occurred while executing: ${scriptFile}`
    }
    
    // CLEANUP IF WE USED A TMP OBJECT
    if (tmpFile) {
      tmpFile.removeCallback()
    }
  })
}


/**
 * Build a dependency
 *
 * @param project
 * @param dep
 * @param buildConfig
 * @returns {Promise<void>}
 */
async function buildDependency(project,dep,buildConfig) {
  const
    {project:{config:{buildType = "cmake"}}} = dep
  
  // CHECKOUT+UPDATE DEPENDENCY SOURCE
  await checkoutDependencyAndUpdateSource(project,dep,buildConfig)
  
  
  switch (buildType) {
    case "manual":
      await buildDependencyManual(project,dep,buildConfig)
      break;
    default:
      await buildDependencyCMake(project,dep,buildConfig)
      break;
  }
  
  postDependencyInstall(project,dep,buildConfig)
}

function postDependencyInstall(project, dep, buildConfig) {
  const
    {type} = buildConfig,
    rootDir = type.rootDir,
    cmakeConfig = getValue(() => dep.project.config.cmake,{}),
    cmakeFindTemplate = cmakeConfig.findTemplate
  
  if (cmakeFindTemplate) {
    const
      templatePath = `${dep.dir}/${cmakeFindTemplate}`,
      findFilename = `${rootDir}/lib/cmake/${_.last(_.split(cmakeFindTemplate,"/")).replace(/\.hbs$/,"")}`
  
    log.info(`Writing find file: ${findFilename}`)
    File.mkdirParents(findFilename)
    
    processTemplate(File.readFile(templatePath),{
      cunitRootDir: rootDir,
      cunitLibDir: `${rootDir}/lib`,
      cunitIncludeDir: `${rootDir}/include`,
      cunitCMakeDir: `${rootDir}/lib/cmake`
    },findFilename)
    
    
  }
  
}

/**
 * Build dependencies
 * @param project
 */
async function buildDependencies(project) {
  const {dependencyGraph} = project
  
  for (let dep of dependencyGraph) {
    log.info(`\t${dep.name}@${dep.version}`)
    
    for (let buildConfig of dep.buildConfigs) {
      await buildDependency(project,dep,buildConfig)
    }
  }
}


module.exports = {
  configure,
  findCUnitConfigFile,
  makeCMakeFile
}