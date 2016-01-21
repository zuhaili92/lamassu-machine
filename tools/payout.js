const Rs232 = require('../lib/id003/id003rs232')
const pp = require('../lib/pp')

var initialized = false

const denoms = {
  '98': 5,
  '99': 10,
  '100': 20,
  '101': 50,
  '102': 100,
  '103': 200,
  '104': 500
}

const device = process.argv[2]
const config = {
  currency: 'EUR',
  device: device
}

const rs232 = Rs232.factory(config, denoms)

rs232.on('message', function (cmd, data) {
  if (cmd === 'invalid') {
    console.log('ERROR: invalid command')
    poll()
    return
  }

  if (cmd === 'enq') return poll()

  console.log('Response: %s', cmd)
  if (data) pp(data)

  if (cmd === 'escrow') {
    d()
    .then(s('stack'))
  }

  if (cmd === 'vendValid') {
    d()
    .then(s('ack'))
    .then(poll)
  }

  if (cmd === 'initialize' && !initialized) {
  }

  if (cmd === 'payValid') {
    d()
    .then(s('ack'))
    .then(poll)
  }
})

rs232.on('unknownCommand', function (code) {
  throw new Error('unknown code: ' + code.toString(16))
})

rs232.on('error', function (err) {
  console.log('ERROR DEBUG1')
  console.log(err)
})

rs232.on('badFrame', function () {
  console.log('Bad frame')
  poll()
})

function delay (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const d = () => delay(1000)

function open () {
  return new Promise((resolve, reject) => rs232.open(err => {
    if (err) return reject(err)
    resolve()
  }))
}

function send (cmd, data) {
  console.log('sending: %s', cmd)
  rs232.send(cmd, data)
  return d()
}

function s (cmd, data) {
  return function () {
    return send(cmd, data)
  }
}

function poll () {
  return send('status')
}

const recycleBuf = new Buffer(6)
recycleBuf.writeUInt8(0x02, 0)
recycleBuf.writeUInt8(0, 1)
recycleBuf.writeUInt8(1, 2)
recycleBuf.writeUInt8(0x08, 3)
recycleBuf.writeUInt8(0, 4)
recycleBuf.writeUInt8(2, 5)

const payoutBuf1 = new Buffer(2)
payoutBuf1.writeUInt8(3, 0)
payoutBuf1.writeUInt8(2, 1)

const payoutBuf2 = new Buffer(2)
payoutBuf2.writeUInt8(1, 0)
payoutBuf2.writeUInt8(1, 1)

open()
// .then(s('setRecycleCurrency', recycleBuf))

// .then(s('reset'))
// .then(s('inhibit'))
// .then(d)
// .then(d)

.then(s('unInhibit'))
.then(poll)

// .then(s('inhibit'))
// .then(poll)
// .then(d)
// .then(s('payout', payoutBuf2))
