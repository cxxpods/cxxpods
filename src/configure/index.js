const
  {configure} = require("./Configure")


module.exports = {
  command: "configure",
  desc: "Configure a project from it's root",
  handler: configure
}