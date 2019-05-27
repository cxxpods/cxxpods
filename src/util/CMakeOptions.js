
import CommandOptions from "./CommandOptions"
import {isFunction, isString} from "typeguard"

export default class CMakeOptions extends CommandOptions {
  constructor(values = {}) {
    super(values || {})
    
    this.useQuotes = true
    this.joinWith = "="
    this.keyPrefix = "-D"
  }

  /**
   * Swap \ to /
   * 
   * @param {string} value - process a given value
   */
  processValue(value) {
    return isString(value) && isFunction(value.replace) ? value.replace(/\\/g,'/') : value
  }
}

