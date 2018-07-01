
const Assert = {
  ok(test, msg) {
    let result = false
    if (typeof test === 'function') {
      result = test()
    } else {
      result = test
    }
    
    if (!result) {
      throw msg
    }
  }
}

module.exports = Assert