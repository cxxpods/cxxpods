

export function realRootProject(rootProject) {
  let realRootProject = rootProject
  
  while(realRootProject && realRootProject.rootProject) {
    realRootProject = realRootProject.rootProject
  }
  
  return realRootProject
}