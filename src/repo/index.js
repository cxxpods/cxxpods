

module.exports = (Yargs) => {
  // ADD COMMAND
  Yargs
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
      handler: argv => {
        console.log(`Add repo: ${argv.url}`)
      }
    })
    .demandCommand(1, "You need at least one command before moving on")
}