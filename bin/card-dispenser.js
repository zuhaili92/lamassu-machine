var serialPort = require('serialport')
var SerialPort = serialPort.SerialPort
var machina = require('machina')
const R = require('ramda')

var device = process.argv[2]

var serial = new SerialPort(device,
{baudRate: 9600, parity: 'none', dataBits: 8, stopBits: 1})

var ACK = 0x06
var NAK = 0x15
var STX = 0xf2
var CMT = 0x43
var ETX = 0x03
var ADDR = 0x00
const PMT = 0x50
const EMT = 0x45

serial.on('error', function (err) { console.log(err) })
serial.on('open', function () {
  console.log('INFO dispenser connected')
  serial.on('data', function (data) { processFrame(data) })
  serial.on('close', function () { console.log('disconnected') })
  console.log('connected')

  initialize()
})

function computeBcc (packet) {
  var bcc = 0x00
  for (var i = 0; i < packet.length; i++) {
    bcc = packet[i] ^ bcc
  }
  return bcc
}

function buildFrame (cmd, param, data) {
  data = data || []
  const buf = Buffer.isBuffer(data) ? data : new Buffer(data)
  var txet = Buffer.concat([new Buffer([CMT, cmd, param]), buf])
  var txetLen = txet.length
  var prefix = new Buffer([STX, ADDR, 0x00, 0x00])
  prefix.writeUInt16BE(txetLen, 2)
  console.log(prefix)
  var packet = Buffer.concat([prefix, txet, new Buffer([ETX])])
  var bcc = computeBcc(packet)
  return Buffer.concat([packet, new Buffer([bcc])])
}

function sendFrame (frame) {
  console.log(frame)
  serial.write(frame)
}

function processFrame (txet) {
  console.log(txet.toString('hex'))
  const header = txet[0]

  if (header === EMT) {
    const err = new Error('Response error')
    err.codes = txet.slice(3, 4)
    throw err
  }

  if (header !== PMT) throw new Error('Bad header value')

  return {
    status: txet.slice(3, 6),
    data: txet.slice(6)
  }
}

function sendAck () {
  serial.write(ACK)
}

function sendNak () {
  serial.write(NAK)
}

var protocol = new machina.Fsm({
  initialState: 'idle',
  states: {
    idle: {
      _onEnter: () => {
        if (this.lastFrame) this.command(this.lastFrame)
      },
      command: frame => {
        this.transition('waitForAck')
        sendFrame(frame)
      }
    },
    waitForAck: {
      onEnter: () => this.timeout(),
      ack: 'waitForResponse',
      nak: 'idle',
      timeout: 'idle',
      _onExit: () => this.clearTimeout
    },
    waitForResponse: {
      _onEnter: () => {
        this.lastFrame = null
        this.incomingFrame = new Buffer(0)
        this.incomingTxetLength = 0x00
        this.timeout()
      },
      timeout: () => this.bail('response timeout'),
      data: this.ifByte(0, STX, 'addr')
    },
    addr: {
      timeout: () => this.bail('response timeout'),
      data: this.ifByte(1, 0x00, 'lenh')
    },
    lenh: {
      timeout: () => this.bail('response timeout'),
      data: () => {
        const b = this.incomingFrame[2]
        if (R.isNil(b)) return
        this.incomingFrameLength = b << 8
        this.transition('lenl')
      }
    },
    lenl: {
      timeout: () => this.bail('response timeout'),
      data: () => {
        const b = this.incomingFrame[3]
        if (R.isNil(b)) return
        this.incomingFrameLength |= b
        this.transition('txet')
      }
    },
    txet: {
      timeout: () => this.bail('response timeout'),
      data: () => {
        const txet = this.incomingFrame.slice(4, 4 + this.incomingFrameLength)
        if (txet.length < this.incomingFrameLength) return
        const etx = this.incomingFrame[this.incomingFrameLength + 4]
        if (etx !== ETX) return
        const bcc = this.incomingFrame[this.incomingFrameLength + 5]
        if (R.isNil(bcc)) return
        const bccPacket = this.incomingFrame.slice(0, -1)
        if (computeBcc(bccPacket) !== bcc) {
          this.transition('waitResponse')
          return sendNak()
        }
        sendAck()
        this.transition('idle')

        try {
          this.emit('response', processFrame(txet))
        } catch (err) {
          this.emit('error', err)
        }
      }
    }
  },
  timeout: () => {
    if (this.timeoutHandle) console.log('WARN: timeoutHandle is already set')
    this.timeoutHandle = setTimeout(() => this.transition('timeout'), 300)
  },
  clearTimeout: () => {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle)
      this.timeoutHandle = null
    }
  },
  ifByte: (index, expected, nextState) => {
    () => {
      if (this.incomingFrame[index] === expected) this.transition(nextState)
    }
  },
  idle: this.handle('idle'),
  command: frame => this.handle('command', frame)
})

function request (cmd, param, data) {
  return new Promise((resolve, reject) => {
    protocol.on('*', (eventName, data) => {
      protocol.off()
      if (eventName === 'response') return resolve(data)
      if (eventName === 'error') return reject(data)
      throw new Error('Shouldn\'t happen: unknown event: ' + eventName)
    })
    protocol.command(buildFrame(cmd, param, data))
  })
}

function initialize () {
  return request(0x30, 0x33)
}

function cardToChipReader () {
  return request(0x32, 0x31)
}

function cardPresentHold () {
  return request(0x32, 0x30)
}

function cardReset () {
  return request(0x51, 0x30, [0x33])
}

function cardApdu (apdu) {
  return request(0x51, 0x31)
}

function cardOff () {

}

const apdu0 = '00A4040006A00000000107'
const apdu1 = 'b0010000'

protocol.idle()

initialize()
.then(cardToChipReader)
.then(cardReset)
.then(r => {
  console.log('ATR: 0x' + r.data.slice(1).toString('hex'))
  return cardApdu(new Buffer(apdu0, 'hex'))
})
.then(r => {
  console.log('Card response: 0x' + r.data.toString('hex'))
  return cardApdu(new Buffer(apdu1, 'hex'))
})
.then(r => {
  console.log('Card response: 0x' + r.data.toString('hex'))
  return cardOff()
})
.then(cardPresentHold)
.catch(err => console.log(err.stack))
