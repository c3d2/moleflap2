var db = require('../lib/db')

function go(keys) {
    if (keys.length < 1) process.exit(0)

    db.removeKey(keys[0], function(err) {
        if (err) {
            console.error(err.stack || err)
            process.exit(1)
        }

        go(keys.slice(1))
    })
}
go(process.argv.slice(2))
