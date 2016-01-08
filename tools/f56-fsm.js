const machina = require('machina')
const crc = require('../lib/id003/crc')

const ETX = 0x03
const ENQ = 0x05
const ACK = 0x06
const NAK = 0x15
const DLE = 0x10
const DLE_ACK = new Buffer([DLE, ACK])
const DLE_NAK = new Buffer([DLE, NAK])
const DLE_ETX = new Buffer([DLE, ETX])
const DLE_ENQ = new Buffer([DLE, ENQ])

const fsm = new machina.Fsm({
  initialState: 'DLE_ENQ',
  states: {
    DLE_ENQ: {
      _onEnter: () => fsm.retryCount = 0,
      DLE: 'ENQ',
      LineError: nakEnq,
      '*': 'DLE_ENQ'
    },
    ENQ: {
      _onEnter: startTimer,
      ENQ: () => {
        fsm.emit('send', DLE_ACK)
        fsm.transition('DLE_STX')
      },
      Timeout: nakEnq,
      LineError: nakEnq,
      '*': 'DLE_ENQ',
      _onExit: clearTimer
    },
    DLE_STX: {
      _onEnter: () => {
        startTimer()
        fsm.dataLengthBuf = new Buffer()
        fsm.dataLength = null
        fsm.data = new Buffer()
        fsm.crc = new Buffer()
      },
      DLE: 'STX',
      Timeout: 'DLE_ENQ',
      LineError: nakEnq,
      '*': 'ENQ',
      _onExit: clearTimer
    },
    STX: {
      _onEnter: startTimer,
      DLE: 'DLE_STX',
      ENQ: () => {
        fsm.emit('send', DLE_ACK)
        fsm.transition('DLE_STX')
      },
      STX: 'Data',
      '*': nakEnq,
      _onExit: clearTimer
    },
    dataLength: {
      _onEnter: startTimer,
      Timeout: nakStx,
      LineError: nakStx,
      '*': byte => {
        fsm.dataLengthBuf = Buffer.concat([fsm.dataLengthBuf, new Buffer(byte)])
        if (fsm.dataLengthBuf.length === 2) {
          fsm.transition('Data')
        }
      },
      _onExit: clearTimer
    },
    Data: {
      _onEnter: startTimer,
      Timeout: nakStx,
      LineError: nakStx,
      Data: byte => {
        fsm.dataLength = fsm.dataLength || fsm.dataLengthBuf.readUInt16BE(0)
        fsm.data = Buffer.concat([fsm.data, new Buffer(byte)])
        if (fsm.data.length === fsm.dataLength) fsm.transition('DLE_ETX')
      },
      '*': 'DLE_ETX',
      _onExit: clearTimer
    },
    DLE_ETX: {
      _onEnter: startTimer,
      DLE: 'ETX',
      '*': nakStx,
      _onExit: clearTimer
    },
    ETX: {
      _onEnter: startTimer,
      ETX: 'CRC',
      '*': nakStx,
      _onExit: clearTimer
    },
    CRC: {
      _onEnter: startTimer,
      Timeout: nakStx,
      LineError: nakStx,
      '*': byte => {
        fsm.crc = Buffer.concat([fsm.crc, new Buffer(byte)])
        if (fsm.crc.length === 2) fsm.transition('CRC_Check')
      },
      _onExit: clearTimer
    },
    CRC_Check: {
      '*': () => {
        const buf = Buffer.concat([fsm.dataLengthBuf, fsm.data, DLE_ETX])
        const computedCrc = crc.compute(buf)

        if (fsm.crc.readUInt16LE(0) === computedCrc) {
          fsm.emit('send', DLE_ACK)
          fsm.emit('frame', fsm.data)
          fsm.transition('DLE_ENQ')
          return
        }

        nakStx()
      }
    },
    Send: {
      '*': data => {
        fsm.transmitData = data
        fsm.transition('DLE_ENQ_T')
      }
    },
    DLE_ENQ_T: {
      '*': () => {
        fsm.emit('send', DLE_ENQ)
        fsm.transition('DLE_ACK')
      }
    },
    DLE_ACK: {
      _onEnter: startTimer,
      DLE: 'ACK',
      Timeout: retryAck,
      LineError: retryAck,
      _onExit: clearTimer
    },
    ACK: {
      _onEnter: startTimer,
      ENQ: 'DLE_ACK',
      ACK: 'Transmit',
      Timeout: retryAck,
      LineError: retryAck,
      '*': 'DLE_ACK',
      _onExit: clearTimer
    },
    Transmit: {
      '*': () => {
        fsm.emit('send', fsm.transmitData)
        fsm.transition('DLE_ACK_2')
      }
    },
    DLE_ACK_2: {
      _onEnter: startTimer,
      DLE: 'ACK_2',
      Timeout: retryTransmit(),
      LineError: retryTransmit(),
      _onExit: clearTimer
    },
    ACK_2: {
      _onEnter: startTimer,
      ENQ: 'DLE_ENQ',
      ACK: () => {
        fsm.emit('transmissionComplete')
        fsm.transition('DLE_ENQ')
      },
      NAK: retryTransmit,
      Timeout: retryTransmit,
      LineError: retryTransmit,
      '*': 'DLE_ACK_2',
      _onExit: clearTimer
    }
  }
})

function retryTransmit () {
  fsm.retryCount++
  if (fsm.retryCount < 3) return fsm.transition('Transmit')
  fsm.emit('transmissionFailure')
  fsm.transition('DLE_ENQ')
}

function retryAck () {
  fsm.retryCount++
  if (fsm.retryCount < 3) return fsm.transition('DLE_ENQ_T')
  fsm.emit('transmissionFailure')
  fsm.transition('DLE_ENQ')
}

function nakStx () {
  fsm.emit('send', DLE_NAK)
  fsm.transition('DLE_STX')
}

function nakEnq () {
  fsm.emit('NAK')
  fsm.transition('DLE_ENQ')
}

function startTimer () {
  fsm.timerId = setTimeout(() => fsm.handle('Timeout'), 5000)
}

function clearTimer () {
  clearTimeout(fsm.timerId)
}

fsm.on('send', s => console.log('to: %s', s))
module.exports = fsm

/*
TODO

- add in line error handling
- fsm for transmission
*/
