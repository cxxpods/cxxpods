import GetLogger from "../Log"
import * as _ from 'lodash'

const log = GetLogger(__filename)

export function printObject(o, prefix = '') {
  Object.entries(o).forEach(([key,value]) => {
    log.info(`${prefix} ${_.padStart(key,20,' ')}: ${value}`)
  })
}