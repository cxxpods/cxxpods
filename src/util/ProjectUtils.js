import {CXXPodsExtensions} from "../Constants"
import Fs from 'fs'

/**
 * Real root project
 *
 * @param rootProject
 * @returns {*}
 */
export function realRootProject(rootProject) {
  let realRootProject = rootProject
  
  while(realRootProject && realRootProject.rootProject) {
    realRootProject = realRootProject.rootProject
  }
  
  return realRootProject
}


/**
 * Find a cxxpods config file
 *
 * @param path
 * @param name
 */
export function findCXXPodsConfigFile(path, name = 'cxxpods') {
  return CXXPodsExtensions.map(ext => `${path}/${name}${ext}`).find(filename => Fs.existsSync(filename))
}
