const RedScale = require('../index')


const scaler = new RedScale()

scaler.updateJobStats = async () => {
  return {
    total: 11, active: 5, inactive: 6
  }
}


scaler.doScale = async (scaleTo) => {
 return console.log('scaling to ', scaleTo)
}

scaler.start()
