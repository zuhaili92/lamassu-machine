const fsm = require('../../lib/f56/f56-fsm')

const STX = 0x02
const ETX = 0x03
const ENQ = 0x05
const ACK = 0x06
const NAK = 0x15
const DLE = 0x10

fsm.rx(DLE)
fsm.rx(ENQ)
fsm.rx(DLE)
fsm.rx(STX)
fsm.rx(0x00)
fsm.rx(0x02)
fsm.rx(0x01)
fsm.rx(0xa1)
fsm.rx(DLE)
fsm.rx(ETX)
fsm.rx(0x32)
fsm.rx(0xf8)
