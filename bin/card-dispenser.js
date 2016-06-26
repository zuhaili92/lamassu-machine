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
var REPOSITION = 0x30

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
  data = data || new Buffer(0)
  var txet = Buffer.concat([new Buffer([CMT, cmd, param]), data])
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

function initialize () {
  var frame = buildFrame(REPOSITION, 0x30)
  sendFrame(frame)
}

function processFrame (frame) {
  console.log(frame.toString('hex'))
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
        processFrame(txet)
        this.transition('idle')
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

protocol.idle()
