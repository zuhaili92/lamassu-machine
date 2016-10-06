const nfc = require('./nfc')
const door = require('./door')

nfc.emitter.on('cardInserted', () => {
  door.open()
})
