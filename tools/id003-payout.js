'use strict'

const device = process.argv[2]
const config = {
  currency: 'EUR',
  rs232: {device: device}
}

const id003 = require('../lib/id003/id003').factory(config)
id003.run(err => {
  if (err) throw err

  console.log('Bill validator connected.')
  id003.on('billStay', () => console.log('Bill presented'))
  id003.on('billPaid', () => console.log('Bill dispensed'))

  id003.setRecycleCurrency(5, 0, 1)

  delay200
  .then(() => id003.setCurrentCount(10, 1))
  .then(delay200)
  .then(() => id003.setRecycleCurrency(20, 0, 2))
  .then(delay200)
  .then(() => id003.payout(5, 1))
})

const delay200 = () => delay(200)

function delay (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
