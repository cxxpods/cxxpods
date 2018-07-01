
const
  {Config,Paths} = require("../Config"),
  {GetLogger} = require("../Log"),
  File = require("../util/File"),
  Fs = require('fs'),
  sh = require("shelljs"),
  _ = require('lodash'),
  Git = require('simple-git/promise')

const log = GetLogger(__filename)

/**
 * Parse name from repo url
 *
 * @param url
 * @returns {*}
 */
function parseRepoName(url) {
  if (_.isEmpty(url))
    return null
  
  const
    parts = _.split(url,"/"),
    name = parts[parts.length - 1]
  
  return name.replace(".git","")
}

/**
 * Get repo url from url or name
 *
 * @param urlOrName
 * @returns {*}
 */
function getRepoUrl(urlOrName) {
  const repoUrls = Config.repos
  if (repoUrls.includes(urlOrName))
    return urlOrName
  else
    return repoUrls.find(url => parseRepoName(url) === urlOrName) || urlOrName
}

function isRepoLocal(url) {
  return /^file\:\/\//.test(url) && sh.test("-d",url.replace("file://",""))
}

function getRepoLocalPath(url) {
  return `${Paths.CUnitRepo}/${parseRepoName(url)}`
}

/**
 * Update a given url
 *
 * @param url
 * @returns {Promise<boolean>}
 */
async function updateRepo(url) {
  const
    name = parseRepoName(url),
    repoUrl = getRepoUrl(url),
    repoLocalPath = getRepoLocalPath(url)
  
  if (_.isEmpty(repoUrl)) {
    throw `Unknown repo: ${url}`
  }
  
  log.info(`Updating repo: ${name}@${url}`)
  
  try {
    if (isRepoLocal(url)) {
      const filePath = url.replace("file://","")
      if (sh.test("-L",repoLocalPath)) {
        log.info(`Repo ${name} is up-to-date ${repoLocalPath} -> ${filePath}`)
        return true
      } else if (sh.test("-e",repoLocalPath)) {
        log.error(`Path (${repoLocalPath}) exists, but is not a link to ${url}`)
        return false
      } else {
        sh.ln("-s",filePath,repoLocalPath)
        return true
      }
    } else if (Fs.existsSync(repoLocalPath)) {
      const
        git = Git(repoLocalPath),
        branchSummary = await git.branchLocal(),
        remotes = await git.getRemotes(true)
      
      if (!remotes.length) {
        log.error(`No remotes for ${url}`)
        return false
      }
      
      await git.pull(remotes[0].name, branchSummary.current,{
        "--depth": "1"
      })
      return true
    } else {
      const
        git = Git(Paths.CUnitRepo)
      
      log.info(`Cloning ${url} -> ${repoLocalPath}`)
      const result = await git.clone(url,repoLocalPath,{
        "--depth": "1"
      })
      
      return true
    }
  } catch (ex) {
    log.error("Unable to update repo", ex)
    return false
  }
}

/**
 * Update repositories
 *
 * @param url
 */
async function updateRepos(url) {
  if (!_.isEmpty(url)) {
    await updateRepo(url)
  } else {
    const repoUrls = Config.repos
    for (url of repoUrls) {
      await updateRepo(url)
    }
  }
}

/**
 * Add a new repository
 *
 * @param url
 */
async function addRepo(url) {
  const
    name = parseRepoName(url)
  
  log.info(`Adding repo ${name}@${url}`)
  
  const
    updated = await updateRepo(url)
  
  if (updated) {
    Config.addRepository(url)
    log.info(`Successfully added ${name}@${url}`)
  } else {
    log.error(`Failed to added ${name}@${url}`)
  }
}

/**
 * Remove a repo
 *
 * @param url
 */
function removeRepo(url) {
  const
    name = parseRepoName(url)
  
  if (!Config.repos.includes(url)) {
    log.error(`Repo ${url} is not registered`)
  } else {
    Config.removeRepository(url)
    log.info(`Successfully removed ${url}`)
  }
}

/**
 * Get all repo configs
 *
 * @returns {*}
 */
function getRepoConfigs() {
  return Config.repos.map(url => ({
    url,
    name: parseRepoName(url),
    localPath: getRepoLocalPath(url)
  }))
}

/**
 * List all configured repos
 */
function listRepos() {
  const repos = getRepoConfigs()
  
  console.log("NAME\t\t\t\tURL")
  repos.forEach(repo =>
    console.log(`${repo.name}\t\t\t\t${repo.url}`))
}

/**
 * Resolve a dependency
 *
 * @param name
 * @param required
 */
function resolveDependency(name, required = true) {
  const repoConfigs = getRepoConfigs()
  
  for (let repoConfig of repoConfigs) {
    const depPath = `${repoConfig.localPath}/${name}`
    if (File.isDirectory(depPath))
      return depPath
  }
  
  if (required) {
    throw `Required dependency could not be resolved: ${name}`
  }
  
  return null
}

/**
 * Get repo local paths
 *
 * @returns {*}
 */
function getRepoLocalPaths() {
  return Config.repos.map(url => getRepoLocalPath(url))
}

// updateRepos()
//   .then(() => log.info("Updated repos"))

module.exports = {
  updateRepos,
  addRepo,
  removeRepo,
  listRepos,
  getRepoLocalPaths,
  resolveDependency
}