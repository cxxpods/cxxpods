import * as Path from 'path'
import {configure,makeCMakeFile} from "../project/Configure"
import Project from "../project/Project"
import GetLogger from "../Log"
import {AndroidArgs} from "../project/BuiltType"
import {getToolchainProperties} from "../project/Toolchain"
import {writeFile} from "../util/File"
//import {getToolchainProperties} from "../project/Toolchain"

const
  log = GetLogger(__filename)


const ConfigureCommand = {
  command: "configure",
  desc: "Configure a project from it's root",
  builder: Yargs => {
    Object.keys(AndroidArgs).forEach(arg => {
      Yargs.option(arg,{
        description: `${arg} CMake Cross option`,
        type: "string"
      })
    })
    
  },
  handler: argv => configure(argv)
}


module.exports = (Yargs) => {
  return Yargs.command({
      command: "project",
      alias: "p",
      description: "Project management commands",
      builder: Yargs =>
        Yargs
          .command({
            command: "toolchain-json",
            desc: "Print JSON of toolchain properties",
            // builder: Yargs => {
            //
            // },
            handler: async (argv) => {
              const
                project = Project.load(),
                json = JSON.stringify(await getToolchainProperties(project),null, 2),
                dir = project.projectDir.toString(),
                file = Path.join(dir,"toolchains.json")
              
              writeFile(file, json)
              console.log(`Wrote ${file}`)
            }

          })
          .command(ConfigureCommand)
          .command({
            command: "dependencies",
            desc: "List all project dependencies, including nested",
            handler: argv => {
              const
                project = new Project(),
                graph = Project.dependencyGraph
              
              log.info(`${project.name}: All dependencies in order they will be prepared`)
              graph.forEach(dep =>
                log.info(`${dep.name}@${dep.version} requires [${dep.project.dependencies.map(childDep => `${childDep.name}@${childDep.version}`).join(",")}]`)
              )
              
            }
          })
          .command({
            command: "tool-dependencies",
            desc: "Tool dependencies, including nested",
            handler: argv => {
              const
                project = new Project(),
                graph = Project.toolDependencyGraph
              
              log.info(`${project.name}: All dependencies in order they will be prepared`)
              graph.forEach(dep =>
                log.info(`${dep.name}@${dep.version} requires [${dep.project.tools.map(childDep => `${childDep.name}@${childDep.version}`).join(",")}]`)
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
          
          .command({
            command: "build-types",
            desc: "List all build types",
            handler: async (argv) => {
              const
                project = new Project(),
                {buildTypes} = project
              
              log.info(`${project.name}: Build types`)
              buildTypes.forEach(buildType =>
                log.info(`${buildType} -> ${buildType.toolchain.triplet}`)
              )
            }
          })
          .demandCommand(1, "You need at least one command before moving on")
    })
    .command(ConfigureCommand)
}




