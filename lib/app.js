var express = require('express')
var through = require('through2')
var crypto = require('crypto')
var db = require('./db')
var door = require('./door')

var app = express()
app.use(require('morgan')('combined'))
app.use(express.static(__dirname + '/../public'))

var totalKeys
var progresses = {}
function Progress() {
    var id
    do {
        id = "" + Math.ceil(999999 * Math.random())
    } while(progresses.hasOwnProperty(id))
    progresses[id] = this
    this.id = id

    this.secret = ""
    for(var i = 0; i < 10; i++) {
        this.secret += Math.ceil(999999 * Math.random())
    }
    this.secretBuf = new Buffer(this.secret)
    console.log("Progress " + id + " secret: " + this.secret)

    process.nextTick(function() {
        // Start async encryption
        this.keys = 0
        db.pubkeys().
          pipe(through.obj(function(pubkey, enc, cb) {
              this.keys++
              this.pushNext(
                  crypto.publicEncrypt({ key: pubkey }, this.secretBuf).toString('hex'),
                  cb
              )
          }.bind(this), function(cb) {
              console.log("Done after", this.keys)
              totalKeys = this.keys
              this.pushNext(null, cb)
          }.bind(this)))
    }.bind(this))

    // TODO: setTimeout
}

Progress.prototype.pushNext = function(cipherText, cb) {
    this.nextCipherText = cipherText
    this.nextCb = cb
    if (this.pending) {
        var pending = this.pending
        delete this.pending
        pending.forEach(this.next.bind(this, null, cipherText))
        cb()
    }
}

Progress.prototype.next = function(cb) {
    if (this.nextCb) {
        var nextCb = this.nextCb
        this.nextCb = null
        var nextCipherText = this.nextCipherText
        this.nextCipherText = null
        cb(null, nextCipherText)
        nextCb()
    } else {
        if (!this.pending) this.pending = []
        this.pending.push(cb)
    }
}

Progress.prototype.remove = function() {
    if (!progresses.hasOwnProperty(this.id)) {
        console.warn("Removing non-existent progress", this.id)
        return
    }
    delete progresses[this.id]
}

app.post("/unlock", function(req, res) {
    try {
        var p = new Progress()
        res.json({
            poll: "/progress/" + p.id
        })
        res.end()
    } catch(e) {
        console.error(e.stack || e)
        res.status(500)
        res.type('txt')
        res.write("Invalid request")
        res.end()
    }
})

app.get("/progress/:id", function(req, res) {
    var p = progresses[req.params.id]
    if (!p) {
        res.status(404)
        res.end()
        return
    }

    p.next(function(err, cipherText) {
        if (err) {
            res.status(500)
            res.end()
            return
        }

        var json = { cipher: cipherText }
        if (totalKeys)
          json.progress = Math.ceil(100 * p.keys / totalKeys)
        res.json(json)
        // TODO: confirm + remove
    })
})

app.post("/progress/:id/:plain", function(req, res) {
    var p = progresses[req.params.id]
    if (!p) {
        res.status(404)
        res.end()
        return
    }

    console.log(req.params.plain, "==", p.secret, ":", req.params.plain === p.secret)
    if (req.params.plain === p.secret) {
        res.json({})
    } else {
        res.json({ error: "Challenge doesn't match" })
    }
    p.remove()
})

module.exports = app
