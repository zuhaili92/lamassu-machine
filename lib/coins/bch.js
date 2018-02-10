const bchaddr = require('bchaddrjs')

module.exports = {depositUrl, parseUrl, formatAddress}

function pullAddress (url) {
  const res = /^bitcoincash:([a-zA-Z0-9]+)/.exec(url)
  return res && res[1]
}

function parseUrl (network, url) {
  const address = pullAddress(url)
  console.log('DEBUG16: [%s] *%s*', network, address)

  if (!validate(network, address)) return null

  return address
}

function depositUrl (address, amount) {
  const displayAddress = bchaddr.toCashAddress(address)
  return `${displayAddress}?amount=${amount}`
}

function validate (network, address) {
  try {
    if (!network) throw new Error('No network supplied.')
    if (!address) throw new Error('No address supplied.')

    // Will throw error if not a valid bch address
    bchaddr.detectAddressFormat(address)

    const addrNetwork = bchaddr.detectAddressNetwork(address)
    const isCorrectNetwork = network === 'main' && addrNetwork === bchaddr.Network.Mainnet ||
      network === 'test' && addrNetwork === bchaddr.Network.Testnet
    if (!isCorrectNetwork) throw new Error('Network doesn\'t match for BCH address')

    return true
  } catch (err) {
    console.log(err)
    console.log('Invalid bitcoin cash address: [%s] %s', network, address)
    return false
  }
}
