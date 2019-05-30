import {isFunction} from "typeguard"

const
  Assert = require("./Assert"),
  File = require("./File")

/**
 * Simple command options map, extended by cmake etc
 */
export default class CommandOptions {
  
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
  
  get(key, defaultValue = "") {
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
   * By default does nothing
   * 
   * @param {string} value - process a given value
   */
  processValue(value) {
    return value
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
      const 
        value = this.values[key],
        quoteValue = value && isFunction(value.indexOf) && value.indexOf(" ") > -1 && useQuotes

      args.push(`${keyPrefix}${key}${joinWith}${quoteValue ? "\"" : ""}${this.processValue(value)}${quoteValue ? "\"" : ""}`)
    }
    
    return args.join(" ")
  }
  
}
