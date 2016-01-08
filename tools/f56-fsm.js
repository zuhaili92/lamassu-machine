const machina = require('machina')
const crc = require('../lib/id003/crc')

const DLE = 0x10
const ETX = 0x03

const DleEtxBuf = new Buffer([DLE, ETX])

const fsm = new machina.Fsm({
  initialState: 'DLE_ENQ',
  states: {
    DLE_ENQ: {
      DLE: 'ENQ',
      '*': 'DLE_ENQ'
    },
    ENQ: {
      'ENQ': () => {
        fsm.emit('send', 'ACK')
        fsm.transition('DLE_STX')
      },
      'Timeout': () => {
        fsm.emit('send', 'NAK')
        fsm.transition('DLE_ENQ')
      },
      '*': 'DLE_ENQ'
    },
    DLE_STX: {
      _onEnter: () => {
        fsm.dataLengthBuf = new Buffer()
        fsm.dataLength = null
        fsm.data = new Buffer()
        fsm.crc = new Buffer()
      },
      DLE: 'STX',
      Timeout: 'DLE_ENQ',
      '*': 'ENQ'
    },
    STX: {
      DLE: 'DLE_STX',
      ENQ: () => {
        fsm.emit('send', 'ACK')
        fsm.transition('DLE_STX')
      },
      STX: 'Data',
      '*': () => {
        fsm.emit('send', 'NAK')
        fsm.transition('DLE_ENQ')
      }
    },
    dataLength: {
      Timeout: nakStx,
      '*': byte => {
        fsm.dataLengthBuf = Buffer.concat([fsm.dataLengthBuf, new Buffer(byte)])
        if (fsm.dataLengthBuf.length === 2) {
          fsm.transition('Data')
        }
      }
    },
    Data: {
      Timeout: nakStx,
      Data: byte => {
        fsm.dataLength = fsm.dataLength || fsm.dataLengthBuf.readUInt16BE(0)
        fsm.data = Buffer.concat([fsm.data, new Buffer(byte)])
        if (fsm.data.length === fsm.dataLength) fsm.transition('DLE_ETX')
      },
      '*': 'DLE_ETX'
    },
    DLE_ETX: {
      DLE: 'ETX',
      '*': nakStx
    },
    ETX: {
      ETX: 'CRC',
      '*': nakStx
    },
    CRC: {
      Timeout: nakStx,
      '*': byte => {
        fsm.crc = Buffer.concat([fsm.crc, new Buffer(byte)])
        if (fsm.crc.length === 2) fsm.transition('CRC_Check')
      }
    },
    CRC_Check: {
      '*': () => {
        const buf = Buffer.concat([fsm.dataLengthBuf, fsm.data, DleEtxBuf])
        const computedCrc = crc.compute(buf)

        if (fsm.crc.readUInt16LE(0) === computedCrc) {
          fsm.emit('send', 'ACK')
          fsm.emit('frame', fsm.data)
          fsm.transition('DLE_ENQ')
          return
        }

        nakStx()
      }
    }
  }
})

function nakStx () {
  fsm.emit('NAK')
  fsm.transition('DLE_STX')
}

fsm.on('send', s => console.log('to: %s', s))
module.exports = fsm

/*
TODO

- add in line error handling
- fsm for transmission
*/
