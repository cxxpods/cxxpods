import DependencyBuilder from "./DependencyBuilder"
import Tmp from "tmp"
import Assert from "../util/Assert"
import File from "../util/File"
import GetLogger from "../Log"
import Path from 'path'
import * as sh from 'shelljs'

const
  log = GetLogger(__filename),
  BuildSteps = ["preconfigure", "configure", "build", "install"]

export default class DependencyBuilderManual extends  DependencyBuilder {
  
  /**
   * Override type
   *
   * @returns {string}
   */
  get type() {
    return "Manual";
  }
  
  /**
   * Build a manual dependency (like ffmpeg)
   *
   * @returns {Promise<void>}
   */
  async build() {
    const
      {dir, name, project: {config: {build: buildStepConfigs}}} = this.dep,
      {type, src: srcDir} = this.buildConfig,
      scriptEnv = type.toScriptEnvironment()
  
  
    sh.pushd(srcDir)
    BuildSteps.forEach(stepName => {
      const stepConfig = buildStepConfigs[stepName]
      if (!stepConfig || (!stepConfig.script && !stepConfig.file))
        return
    
      log.info(`${name} - ${stepName} starting...`)
    
      let scriptFile, tmpFile
    
      // EXPLICIT SCRIPT
      if (stepConfig.script) {
        // noinspection JSCheckFunctionSignatures
        tmpFile = Tmp.fileSync({mode: 777, prefix: `${name}-${stepName}-`, postfix: '.sh'})
        sh.exec(`chmod 777 ${tmpFile.name}`)
        scriptFile = tmpFile.name
        const scriptContent = new sh.ShellString(`#!/bin/bash -e \n\n${stepConfig.script}`)
        scriptContent.to(scriptFile)
        //File.writeFile(scriptFile, `#!/bin/bash -e \n\n${stepConfig.script}`)
      } else {
        scriptFile = `${dir}/${stepConfig.file}`
      }
    
      log.info(`${name} - ${stepName} executing: ${scriptFile}`)
      Assert.ok(File.exists(scriptFile), `Unable to find: ${scriptFile}`)
      Object.assign(sh.env, scriptEnv)
    
      if (sh.exec(scriptFile).code !== 0) {
        throw `An error occurred while executing: ${scriptFile}`
      }
    
    
      // CLEANUP IF WE USED A TMP OBJECT
      if (tmpFile) {
        tmpFile.removeCallback()
      }
    })
    sh.popd()
  }
}