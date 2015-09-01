var EC = require('elliptic').ec
var ec = new EC('ed25519')
 
// Generate keys 
var key = ec.genKeyPair()
// console.log("key", key.getPublic('hex'), key.getPublic('hex'))
// var key2 = ec.keyFromPublic(key.getPublic('hex'), 'hex')
// console.log("key2", key2.getPublic('hex'), key2.getPublic('hex'))

var db = require('../lib/db')
db.addKey(key.getPublic('hex'), function(err) {
    if (err) {
        console.error(err.stack || err.message)
        process.exit(1)
    } else {
        console.log("Ok: " + key.getPrivate('hex'))
        process.exit(0)
    }
})
