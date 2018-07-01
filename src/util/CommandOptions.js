const
  Assert = require("./Assert"),
  File = require("./File")

/**
 * Simple command options map, extended by cmake etc
 */
class CommandOptions {
  
  constructor(values = {}) {
    this.values = values || {}
    this.keyPrefix = ""
    this.useQuotes = true
    this.joinWith = "="
  }
  
  
  
  
  set(keyOrObject, value = null) {
    const keyOrObjectIsObject = typeof keyOrObject === 'object'
    if (!value) {
      Assert.ok(keyOrObjectIsObject,'Type of values must be object')
    }
    
    if (keyOrObjectIsObject) {
      Object.keys(keyOrObject).forEach(key => this.set(key,keyOrObject[key]))
    } else {
      this.values[key] = value
    }
    
    return this
  }
  
  get(key) {
    return this.values[key]
  }
  
  append(key,newValue,separator = " ") {
    const existingValue = this.values[key] || ""
    this.values[key] = `${existingValue.length ? separator : ""}${newValue}`
    return this
  }

  toArgs(options = {}) {
    return toString(options)
  }
  
  /**
   * Search and replace variables in both keys and values
   *
   * @param vars
   */
  replaceVariables(vars = {}) {
    Object
      .entries(vars)
      .forEach(([varName,varValue]) => {
        const varMatch = RegExp(varName,"g")
        
        Object
          .entries(this.values)
          .forEach(([name,value]) => {
            delete this.values[name]
            
            name = name.replace(varMatch,varValue)
            value = value.replace(varMatch,varValue)
            this.values[name] = value
          })
      })
    
    return this
  }
  
  /**
   * Replace variable with props from file
   *
   * @param path
   */
  replaceVariablesFromFile(path) {
    const props = File.readFileProperties(path)
    return this.replaceVariables(props)
  }
  
  /**
   * To string, same as toArgs()
   *
   * @param options
   * @returns {string}
   */
  toString(options = {}) {
    const
      {
        keyPrefix = this.keyPrefix || "",
        joinWith = this.joinWith || "=",
        useQuotes = this.useQuotes == null ? true : this.useQuotes
      } = options || {},
      args = []
    
    for (let key of Object.keys(this.values)) {
      const value = this.values[key]
      args.push(`${keyPrefix}${key}${joinWith}${useQuotes ? "\"" : ""}${value}${useQuotes ? "\"" : ""}`)
    }
    
    return args.join(" ")
  }
  
}

module.exports = CommandOptions