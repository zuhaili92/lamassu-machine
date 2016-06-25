var serialPort = require('serialport')
var SerialPort = serialPort.SerialPort
var machina = require('machina')

var device = process.argv[2]

var serial = new SerialPort(device,
{baudRate: 9600, parity: 'none', dataBits: 8, stopBits: 1})

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

var protocol = new machina.Fsm({
  initialState: 'idle',
  states: {
    idle: {
    }
  }
})
