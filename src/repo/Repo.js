import GetLogger from "../Log"
import {Config,Paths} from "../Config"
import * as File from "../util/File"
import * as Fs from 'fs'
import * as sh from 'shelljs'
import * as _ from 'lodash'
import Git from 'simple-git/promise'
import * as Yaml from 'js-yaml'

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

/**
 * Check if repo is local or Git backed
 *
 * @param url
 * @returns {boolean}
 */
export function isRepoLocal(url) {
  return /^file\:\/\//.test(url) && sh.test("-d",url.replace("file://",""))
}

/**
 * Get local path for repo, local or Git backed
 *
 * @param url
 * @returns {string}
 */
export function getRepoLocalPath(url) {
  return `${Paths.CXXPodsRepo}/${parseRepoName(url)}`
}

/**
 * Update a given url
 *
 * @param url
 * @returns {Promise<boolean>}
 */
export async function updateRepo(url) {
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
      
      
      await git.raw(["fetch","--all"])
      await git.raw(["reset","--hard","origin/master"])
      await git.pull(remotes[0].name, branchSummary.current,{
        "--depth": "1"
      })
      return true
    } else {
      const
        git = Git(Paths.CXXPodsRepo)
      
      log.info(`Cloning ${url} -> ${repoLocalPath}`)
      await git.clone(url,repoLocalPath,{
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
export async function updateRepos(url = null) {
  if (!_.isEmpty(url)) {
    await updateRepo(url)
  } else {
    const repoUrls = Config.repos
    for (url of repoUrls) {
      await updateRepo(url)
    }
    
    Config.updatedRepositories()
  }
}

/**
 * Add a new repository
 *
 * @param url
 */
export async function addRepo(url) {
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
export function removeRepo(url) {
  if (!Config.repos.includes(url)) {
    log.error(`Repo ${url} is not registered`)
  } else {
    Config.removeRepository(url)
    log.info(`Successfully removed ${url}`)
  }
}


/**
 * Create an index for a given repo
 *
 * @param url
 */
export function indexRepo(url) {
  const
    localPath = getRepoLocalPath(url),
    recipesFile = `${localPath}/PODS.json`
  
  log.info(`Indexing repo @ ${localPath}`)
  
  const recipes = Fs.readdirSync(localPath)
    .filter(name => !name.startsWith("."))
    .map(name => `${localPath}/${name}/cxxpods.yml`)
    .filter(File.exists)
    .map(File.readFileYaml)
    .reduce((recipes,recipe) => [...recipes,recipe],[])
  
  log.info(`Writing ${recipes.length} recipes to ${recipesFile}`)
  File.writeFileJSON(recipesFile,recipes)
}

/**
 * Get all repo configs
 *
 * @returns {*}
 */
export function getRepoConfigs() {
  return Config.repos.map(url => ({
    url,
    name: parseRepoName(url),
    localPath: getRepoLocalPath(url)
  }))
}

/**
 * List all configured repos
 */
export function listRepos() {
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
export function resolveDependency(name, required = true) {
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
export function getRepoLocalPaths() {
  return Config.repos.map(url => getRepoLocalPath(url))
}


/**
 * Update repos if first time init or
 * last update was more than a set amount
 * of time ago
 *
 * @returns {Promise<void>}
 */
export async function updateReposIfNeeded() {
  const {Config} = require("../Config")
  if (Config.isRepoUpdateNeeded) {
    await updateRepos()
  }
}
