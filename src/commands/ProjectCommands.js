const
  {configure,makeCMakeFile} = require("../project/Configure"),
  Project = require("../project/Project"),
  {DependencyManager} = require("../project/Dependency"),
  {GetLogger} = require("../Log"),
  log = GetLogger(__filename)


module.exports = {
  command: "project",
  alias: "p",
  description: "Project management commands",
  builder: Yargs =>
    Yargs
      .command({
        command: "configure",
        desc: "Configure a project from it's root",
        handler: argv => configure()
      })
      .command({
        command: "dependencies",
        desc: "List all project dependencies, including nested",
        handler: argv => {
          const
            project = new Project(),
            graph = project.dependencyGraph
      
          log.info(`${project.name}: All dependencies in order they will be prepared`)
          graph.forEach(dep =>
            log.info(`${dep.name}@${dep.version} requires [${dep.project.dependencies.map(childDep => `${childDep.name}@${childDep.version}`).join(",")}]`)
          )
      
        }
      })
      .command({
        command: "generate-cmake",
        desc: "List all project dependencies, including nested",
        handler: async (argv) => {
          const
            project = new Project()
          
          log.info(`${project.name}: Generating cmake file`)
          await makeCMakeFile(project)
        }
      })
      .demandCommand(1, "You need at least one command before moving on")
}




