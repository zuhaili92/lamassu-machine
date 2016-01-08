const serialPort = require('serialport')
const SerialPort = serialPort.SerialPort


const serialOptions = {baudRate: 9600, parity: 'even', dataBits: 8, stopBits: 1})

var serial

function create (device) {
  serial = new SerialPort(device, serialOptions)

  serial.on('error', function (err) { self.emit('error', err) })
  serial.on('open', function () {
    console.log('INFO puloon connected')
    serial.on('data', function (data) { self._process(data) })
    serial.on('close', function () { self.emit('disconnected') })
    self.emit('connected')
    callback()
  })
}
