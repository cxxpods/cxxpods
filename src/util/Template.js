const
  Handlebars = require("handlebars"),
  File = require("./File")

function processTemplate(templateContent,context,outputFile) {
  File.writeFile(outputFile,Handlebars.compile(templateContent)(context))
}

module.exports = {
  processTemplate
}