const
  {GetLogger} = require("../Log"),
  {Paths} = require("../Config"),
  Project = require("../Project"),
  sh = require("shelljs"),
  log = GetLogger(__filename),
  File = require("../util/File"),
  Path = require("path"),
  OS = require('os'),
  Git = require("simple-git/promise"),
  {getValue} = require("typeguard"),
  _ = require('lodash')


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
    {name,version} = dep,
    {src,build,type} = buildConfig,
    {url} = getValue(() => dep.project.config.repository,{})
  
  if (!File.isDirectory(src)) {
    const parent = Path.dirname(src)
    
    File.mkdirs(parent)
    
    const git = Git(parent)
    await git.clone(url,src,{
      "--depth": "1"
    })
  }
  
  const
    git = Git(src),
    branchSummary = await git.branchLocal(),
    remotes = await git.getRemotes(true),
    remote = remotes[0].name
  
  await git.fetch(remote,branchSummary.current,['--all','--tags','--prune'])
  
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
  
  // NOW CONFIGURE THE BUILD
  const
    cmakeConfig = getValue(() => dep.project.config.cmake,{}),
    cmakeRoot = Path.resolve(src,cmakeConfig.root || ""),
    cmakeFlags = getValue(() => cmakeConfig.flags,{}),
    cmakeArgs = [
      ...Object.keys(cmakeFlags).map(flag => `-D${flag}=${cmakeFlags[flag]}`),
      ...type.toolchain.toCMakeArgs(),
      `-DCMAKE_INSTALL_PREFIX=${type.rootDir}`
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

/**
 * Build dependencies
 * @param project
 */
async function buildDependencies(project) {
  const {dependencies, buildTypes} = project
  for (let dep of dependencies) {
    log.info(`\t${dep.name}@${dep.version}`)
    
    const
      depConfig = dep.project.config || {},
      cmakeFlags = getValue(() => depConfig.cmake.flags,{})
    
    for (let buildConfig of dep.buildConfigs) {
      await buildDependency(project,dep,buildConfig)
    }
    
    //Object.keys(cmakeFlags).forEach(key => log.info(`\t\tCMAKE:\t${_.padEnd(key,24)}${cmakeFlags[key]}`))
  }
  
  // log.info("Build types")
  // buildTypes.forEach(buildType => log.info(`\t${buildType}`))
}


module.exports = {
  configure
}