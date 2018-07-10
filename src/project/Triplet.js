import {CompilerType, Architecture, ABI, ProcessorNodeMap, System} from "./BuildConstants"
import OS from 'os'
import * as sh from 'shelljs'
import {ExeSuffix} from "../Config"
import * as _ from 'lodash'
import GetLogger from "../Log"

const
  log = GetLogger(__filename),
  {IsWindows} = require("../Config")

/**
 * Triplet
 */
export class Triplet {
  constructor(system,arch,abi,compilerType = CompilerType.GCC) {
    if (!System[system]) throw `Unknown system: ${system}`
    if (!Architecture[arch]) throw `Unknown processor: ${arch}`
    if (!ABI[abi]) throw `Unknown abi type: ${abi}`
    if (!CompilerType[compilerType]) throw `Unknown compiler type: ${compilerType}`
    
    this.abi = abi
    this.system = system
    this.arch = arch
    this.compilerType = compilerType
  }
  
  get tupleName() {
    return `${this.arch}-${this.system.toLowerCase()}`
  }
  
  toString() {
    return `${this.arch}-${this.system.toLowerCase()}-${this.abi.toLowerCase()}`
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
      Object.keys(System).find(sys => sys.toLowerCase() === platform),
    ccExe = sh.which(`cc${ExeSuffix}`)
  
  let compilerType = IsWindows ? CompilerType.MSVC : CompilerType.GCC
  
  try {
    if (!_.isEmpty(ccExe)) {
      const
        result = sh.exec(`${ccExe} --version`, {silent: true})
    
      if (result.code === 0) {
        if (result.stdout.toLowerCase().indexOf("clang") > -1)
          compilerType = CompilerType.Clang
        else
          log.info(`Unable to detect compiler type, using: ${compilerType}`)
      }
    }
  } catch (ex) {
    log.warn(`Unable to autodetect compiler, using defaults`, ex)
  }
  
  return new Triplet(
    system,
    ProcessorNodeMap[arch],
    IsWindows ? ABI.WINDOWS : ABI.GNU,
    compilerType
  )
}

/**
 * Host triplet
 *
 * @type {Triplet}
 */
Triplet.host = makeHostTriplet()

export default Triplet