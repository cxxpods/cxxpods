

import File from '../util/File'
import {GetLogger} from '../Log'
import Path from 'path'

const log = GetLogger(__filename)

function showVersion() {
   log.info(`cunit version ${File.readFileJson(Path.resolve(__dirname,"..","..","package.json")).version}`)
}

export default function (Yargs) {
  return Yargs.command({
    command: "version",
    description: "cunit version",
    handler: () => showVersion()
  })
}