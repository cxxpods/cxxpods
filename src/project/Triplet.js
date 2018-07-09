import {CompilerType, Processor, ProcessorNodeMap, System} from "./BuildConstants"
import {IsWindows} from "../Config"
import OS from 'os'

/**
 * Triplet
 */
export class Triplet {
  constructor(system,processor,compilerType) {
    if (!System[system]) throw `Unknown system: ${system}`
    if (!Processor[processor]) throw `Unknown processor: ${processor}`
    if (!CompilerType[compilerType]) throw `Unknown compiler type: ${compilerType}`
    
    this.system = system
    this.processor = processor
    this.compilerType = compilerType
  }
  
  toString() {
    return `${this.processor}-${this.system.toLowerCase()}-${this.compilerType.toLowerCase()}`
  }
}

/**
 * Create host triplet
 *
 * @returns {Triplet}
 */
function makeHostTriplet() {
  const
    platform = OS.platform(),
    arch = OS.arch(),
    system = IsWindows ?
      System.Windows :
      Object.keys(System).find(sys => sys.toLowerCase() === platform)
  
  return new Triplet(
    system,
    ProcessorNodeMap[arch],
    system ===  System.Darwin ? CompilerType.AppleClang : CompilerType.GNU
  )
}

/**
 * Host triplet
 *
 * @type {Triplet}
 */
Triplet.host = makeHostTriplet()

export default Triplet