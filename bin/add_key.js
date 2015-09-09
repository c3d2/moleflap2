var child_process = require('child_process')

if (process.argv.length !== 3 && process.argv.length !== 4) {
    console.error("Pass name and optional cert")
    process.exit(1)
}
var privKey
var pubKey
if (process.argv.length == 4) {
    pubKey = process.argv[3]
} else {
    // Generate keys
    privKey = child_process.execSync("openssl genrsa 2048 2>/dev/null", {
        encoding: 'utf8'
    })
    pubKey = child_process.execSync("openssl rsa -pubout 2>/dev/null", {
        input: privKey,
        encoding: 'utf8'
    })
}

var db = require('../lib/db')
db.addKey(process.argv[2], pubKey, function(err) {
    if (err) {
        console.error(err.stack || err.message)
        process.exit(1)
    } else {
        if (privKey) {
            console.log(privKey)
        }
        process.exit(0)
    }
})
