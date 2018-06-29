const
  winston = require("winston"),
  _ = require("lodash")

const alignedWithColorsAndTime = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp(),
  winston.format.align(),
  winston.format.printf((info) => {
    const {
      timestamp, level, message, ...args
    } = info
    
    const ts = timestamp.slice(0, 19).replace('T', ' ')
    return `${ts} [${level}]: ${message} ${Object.keys(args).length ? JSON.stringify(args, null, 2) : ''}`
  })
)

const ConsoleLogger = new winston.transports.Console({
  level: 'info',
  format: alignedWithColorsAndTime
})


module.exports = {
  GetLogger(filename) {
    const logger = winston.createLogger({
      transports: [ConsoleLogger]
    })
    
    return ['debug','verbose','info','warn','error'].reduce((wrapped,level) => {
      wrapped[level] = (...args) => {
        logger[level]([`[${_.last(_.split(filename,"/"))}]`,...args].join(" "))
      }
      return wrapped
    },{})
  }
}