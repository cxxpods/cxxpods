const
  {GetLogger} = require("../Log"),
  {Paths} = require("../Config"),
  Project = require("./Project"),
  sh = require("shelljs"),
  Fs = require('fs'),
  log = GetLogger(__filename),
  File = require("../util/File"),
  Path = require("path"),
  OS = require('os'),
  Git = require("simple-git/promise"),
  {getValue} = require("typeguard"),
  _ = require('lodash'),
  {CUnitExtensions} = require("../Constants"),
  Handlebars = require("handlebars")


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
  
  log.info(`Configuring ${project.name} dependencies`)
  await buildDependencies(project)
  
  log.info(`Generating cmake file: ${project.name}`)
  await makeCMakeFile(project)
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
    cmakeTemplate = Handlebars.compile(File.readAsset("cunit.cmake.hbs")),
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
    },
    cmakeFileContent = cmakeTemplate(cmakeContext)
  
  log.info(`Writing CMake file: ${cmakeOutputFile}`)
  File.mkdirs(cmakeOutputDir)
  File.writeFile(cmakeOutputFile,cmakeFileContent)
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
    cmakeTemplate = Handlebars.compile(File.readAsset("cunit.dep.cmake.hbs")),
    cmakeContext = {
      cunitRootDir: type.rootDir
    },
    cmakeFileContent = cmakeTemplate(cmakeContext)
  
  log.info(`Writing CMake file: ${cmakeOutputFile}`)
  File.mkdirs(cmakeOutputDir)
  File.writeFile(cmakeOutputFile,cmakeFileContent)
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
    cmakeArgs = [
      ...Object.keys(cmakeFlags).map(flag => `-D${flag}=${cmakeFlags[flag]}`),
      ...type.toolchain.toCMakeArgs(),
      `-DCMAKE_INSTALL_PREFIX=${type.rootDir}`,
      `-DCMAKE_MODULE_PATH=${type.rootDir}/lib/cmake`,
      `-DCMAKE_C_FLAGS="-I${type.rootDir}/include -fPIC -fPIE"`,
      `-DCMAKE_CXX_FLAGS="-I${type.rootDir}/include -fPIC -fPIE"`,
      `-DCMAKE_EXE_LINKER_FLAGS="-L${type.rootDir}/lib"`
    ],
    cmakeCmd = `${Paths.CMake} ${cmakeArgs.join(" ")} ${cmakeRoot}`
  
  File.mkdirs(build)
  sh.cd(build)
  log.info(`Configuring with cmake root: ${cmakeRoot}`)
  log.info(`Using command: ${cmakeCmd}`)
  if (sh.exec(cmakeCmd).code !== 0) {
    throw `CMake config failed`
  }
  
  log.info(`CMake successfully configured`)
  
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
    {name,version} = dep
  
  // CHECKOUT+UPDATE DEPENDENCY SOURCE
  await checkoutDependencyAndUpdateSource(project,dep,buildConfig)
  
  
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
      template = Handlebars.compile(File.readFile(templatePath)),
      findContent = template({
        cunitRootDir: rootDir,
        cunitLibDir: `${rootDir}/lib`,
        cunitIncludeDir: `${rootDir}/include`,
        cunitCMakeDir: `${rootDir}/lib/cmake`
      }),
      findFilename = `${rootDir}/lib/cmake/${_.last(_.split(cmakeFindTemplate,"/")).replace(/\.hbs$/,"")}`
    
    log.info(`Writing find file: ${findFilename}`)
    File.mkdirParents(findFilename)
    File.writeFile(findFilename,findContent)
    
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