import DependencyBuilder from "./DependencyBuilder"
import Tmp from "tmp"
import Assert from "../util/Assert"
import File, {writeFile} from "../util/File"
import GetLogger from "../Log"
import Path from 'path'
import * as sh from 'shelljs'
import * as _ from 'lodash'

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
      {type, src: srcDir, build: buildDir} = this.buildConfig,
      scriptEnv = {
        ...type.toScriptEnvironment(),
        CXXPODS_DEP_DIR: dir,
        CXXPODS_SRC_DIR: srcDir,
        CXXPODS_BUILD_DIR: buildDir
      }
  
    sh.mkdir("-p", buildDir)
    sh.pushd(srcDir)
    
    let tmpFiles = []
    try {
      
      BuildSteps.forEach(stepName => {
        const stepConfig = buildStepConfigs[stepName]
        if (!stepConfig || (!stepConfig.script && !stepConfig.file))
          return
  
        const makeTmpFile = () => {
          tmpFiles.push(Tmp.fileSync({
            mode: 777,
            prefix: `${name}-${stepName}-`,
            postfix: '.sh',
            discardDescriptor: true
          }))
          
          const tmpFile = _.last(tmpFiles).name
    
          //writeFile(tmpFile,"")
          sh.exec(`touch ${tmpFile} && chmod 777 ${tmpFile}`)
    
          
          return tmpFile
        }
  
  
        const tmpFile = makeTmpFile()
        log.info(`${name} - ${stepName} starting...`)
    
    
        // EXPLICIT SCRIPT
        if (stepConfig.script) {
          // noinspection JSCheckFunctionSignatures
          
          
          
          // const scriptContent = new sh.ShellString(`#!/bin/bash -e \n\n${stepConfig.script}`)
          // scriptContent.to(scriptFile)
          File.writeFile(tmpFile, `#!/bin/bash -e \n\n${stepConfig.script}`)
        } else {
          
          sh.cp(Path.join(dir, stepConfig.file),tmpFile)
        }
    
        log.info(`${name} - ${stepName} executing: ${tmpFile}`)
        Assert.ok(File.exists(tmpFile), `Unable to find: ${tmpFile}`)
        Object.assign(sh.env, scriptEnv)
    
        if (sh.exec(tmpFile, {
          env: {...process.env, ...scriptEnv}
        }).code !== 0) {
          throw `An error occurred while executing: ${tmpFile}`
        }
        
      })
    } finally {
      // CLEANUP IF WE USED A TMP OBJECT
      tmpFiles.forEach(tmpFile => {
        tmpFile.removeCallback()
      })
    }
    sh.popd()
  }
}