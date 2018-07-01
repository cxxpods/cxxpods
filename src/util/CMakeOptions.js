
const CommandOptions = require("./CommandOptions")

class CMakeOptions extends CommandOptions {
  constructor(values = {}) {
    super(values || {})
    
    this.useQuotes = true
    this.joinWith = "="
    this.keyPrefix = "-D"
  }
}

module.exports = CMakeOptions