var child_process = require('child_process')

if (process.argv.length !== 3) {
    console.error("Pass name")
    process.exit(1)
} 
// Generate keys
var privKey = child_process.execSync("openssl genrsa 2048", {
    encoding: 'utf8'
})
var pubKey = child_process.execSync("openssl rsa -pubout", {
    input: privKey,
    encoding: 'utf8'
})

var db = require('../lib/db')
db.addKey(process.argv[2], pubKey, function(err) {
    if (err) {
        console.error(err.stack || err.message)
        process.exit(1)
    } else {
        console.log("Ok: " + privKey)
        process.exit(0)
    }
})
