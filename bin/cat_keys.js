var through = require('through2')
var db = require('../lib/db')

db.pubkeysWithNames()
    .pipe(through.obj(function(data, enc, cb) {
        console.log(data.key + " " + JSON.stringify(data.value))
        cb()
    }, function(cb) {
        cb()
        process.exit(0)
    }))
