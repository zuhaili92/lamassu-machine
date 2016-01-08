'use strict'

const serialPort = require('serialport')
const SerialPort = serialPort.SerialPort
const EventEmitter = require('events')
const crc = require('../lib/id003/crc')

const serialOptions = {baudRate: 9600, parity: 'even', dataBits: 8, stopBits: 1}

class Emitter extends EventEmitter {}
const emitter = new Emitter()

var serial

function create (device) {
  serial = new SerialPort(device, serialOptions, false)

  return new Promise((resolve, reject) => {
    serial.open(error => {
      if (error) return reject(error)

      console.log('INFO Connected')
      serial.on('data', data => parse(data))
      serial.on('close', () => emitter.emit('disconnected'))
      resolve()
    })
  })
}

const STX = 0x02
const ETX = 0x03
const ENQ = 0x05
const ACK = 0x06
const NAK = 0x15
const DLE = 0x10

function parse (buf) {
  console.log(buf.toString('hex'))

}

const device = process.argv[2]
create(device)
.then(console.log)
