
import {addRepo, removeRepo, updateRepos, listRepos, indexRepo} from "../repo/Repo"


module.exports = (Yargs) => {
  return Yargs.command({
    command: "repo",
    description: "Manage repos",
    builder: (Yargs) => {
      Yargs
        // ADD COMMAND
        .command({
          command: "add <url>",
          desc: "Add a new repo",
          builder: yargs => {
            yargs
              .positional("url", {
                describe: "Git repo for units",
                type: 'string'
              })
              .demand(0, "You must provide a url")
          },
          handler: argv => addRepo(argv.url)
        })
        
        // INDEX COMMAND
        .command({
          command: "index <url>",
          desc: "Index a repo",
          builder: yargs => {
            yargs
              .positional("url", {
                describe: "Git repo for pods",
                type: 'string'
              })
              .demand(0, "You must provide a url")
          },
          handler: argv => indexRepo(argv.url)
        })
        
        // REMOVE COMMAND
        .command({
          command: "remove <url>",
          desc: "Remove a repo",
          builder: yargs => {
            yargs
              .positional("url", {
                describe: "Git URL or short name for repo",
                type: 'string'
              })
              .demand(0, "You must provide a url")
          },
          handler: argv => removeRepo(argv.url)
        })
        
        // UPDATE COMMAND
        .command({
          command: "update [url]",
          desc: "Update a repo",
          builder: yargs => {
            yargs
              .positional("url", {
                describe: "If you only want to update a single repo, then provide it's url or name",
                type: 'string'
              })
          },
          handler: (argv) => updateRepos(argv.url)
        })
        .command({
          command: "list",
          desc: "List all repos",
          handler: listRepos
        })
        .demandCommand(1, "You need at least one command before moving on")
    }
  })
}