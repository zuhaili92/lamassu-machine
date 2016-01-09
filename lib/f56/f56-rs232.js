'use strict'

const serialPort = require('serialport')
const SerialPort = serialPort.SerialPort
const EventEmitter = require('events')
const fsm = require('./f56-fsm')

const serialOptions = {baudRate: 9600, parity: 'even', dataBits: 8, stopBits: 1}

var serial

class Emitter extends EventEmitter {}
const emitter = new Emitter()

function create (device) {
  serial = new SerialPort(device, serialOptions, false)

  return new Promise((resolve, reject) => {
    serial.open(error => {
      if (error) return reject(error)

      console.log('INFO F56 Connected')
      serial.on('data', data => parse(data))
      serial.on('close', () => emitter.emit('disconnected'))
      resolve()
    })
  })
}

function parse (buf) {
  for (let byte of buf) {
    fsm.rx(byte)
  }
}

function initialize () {
  const ODR = 0x00  // Change for Australia and shutter options
  const LENGTHS = [0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00]
  const THICKNESSES = [0xff, 0xff, 0x00, 0x00]
  fsm.tx(new Buffer([ODR].concat(LENGTHS, THICKNESSES)))
}

function prettyHex (buf) {
  const pairs = []
  for (let i = 0; i < buf.length; i++) {
    pairs.push((buf.slice(i, i + 1).toString('hex')))
  }

  return pairs.join(' ')
}

fsm.on('send', s => {
  console.log('sending: %s', prettyHex(s))
  serial.write(s)
})
fsm.on('status', r => console.log)
fsm.on('frame', r => console.log('frame: %s', prettyHex(r)))

create(process.argv[2])
.then(initialize)
