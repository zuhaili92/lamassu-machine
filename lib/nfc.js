'use strict'

const EventEmitter = require('events')
const util = require('util')
const pcsc = require('pcsclite')()

function Emitter () {
  EventEmitter.call(this)
}

util.inherits(Emitter, EventEmitter)
const emitter = new Emitter()

pcsc.on('reader', function (reader) {
  reader.on('error', function (err) {
    console.log(err)
  })

  reader.on('status', function (status) {
    /* check what has changed */
    var changes = this.state ^ status.state
    if (changes) {
      if ((changes & this.SCARD_STATE_EMPTY) && (status.state & this.SCARD_STATE_EMPTY)) {
        reader.disconnect(reader.SCARD_LEAVE_CARD, function (err) {
          if (err) {
            console.log(err)
          } else {
          }
        })
      } else if ((changes & this.SCARD_STATE_PRESENT) && (status.state & this.SCARD_STATE_PRESENT)) {
        reader.connect({ share_mode: this.SCARD_SHARE_SHARED }, function (err, protocol) {
          if (err) {
            // console.log(err)
          } else {
            reader.transmit(new Buffer([0x00, 0xB0, 0x00, 0x00, 0x20]), 40, protocol, function (err, data) {
              if (err) {
                console.log(err)
              } else {
                emitter.emit('cardInserted')
                // reader.close()
                // pcsc.close()
              }
            })
          }
        })
      }
    }
  })

  reader.on('end', function () {
  })
})

pcsc.on('error', function (err) {
  console.log('PCSC error', err.message)
})

module.exports = {
  emitter
}
