import GetLogger from "../Log"

const
  Handlebars = require("handlebars"),
  File = require("./File"),
  log = GetLogger(__filename)

function processTemplate(templateContent,context,outputFile) {
  const newContent = Handlebars.compile(templateContent)(context)
  if (File.exists(outputFile) && File.readFile(outputFile) === newContent) {
    log.info(`File is unchanged: ${outputFile}`)
    return
  }
  
  File.writeFile(outputFile,newContent)
}

module.exports = {
  processTemplate
}