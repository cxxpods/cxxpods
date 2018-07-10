

import File from '../util/File'
import GetLogger from '../Log'
import Path from 'path'

const log = GetLogger(__filename)

function showVersion() {
   log.info(`cxxpods version ${File.readFileJson(Path.resolve(__dirname,"..","..","package.json")).version}`)
}

export default function (Yargs) {
  return Yargs.command({
    command: "version",
    description: "cxxpods version",
    handler: () => showVersion()
  })
}