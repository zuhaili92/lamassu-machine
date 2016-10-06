const nfc = require('../lib/nfc')
const door = require('../lib/door')

nfc.emitter.on('cardInserted', () => {
  console.log('DEBUG1')
  door.open()
})
