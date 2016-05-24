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

    this.secret = crypto.randomBytes(32).toString('hex')
    this.secretBuf = new Buffer(this.secret)
    var hash = crypto.createHash('sha1')
    hash.update(this.secretBuf)
    this.sha1 = hash.digest('hex')
    console.log("Progress " + id + " secret: " + this.secret)

    this.buffer = []

    process.nextTick(function() {
        // Start async encryption
        this.keys = 0
        db.pubkeys().
          pipe(through.obj(function(pubkey, enc, cb) {
              this.keys++
              var cipherText =
                  crypto.publicEncrypt({ key: pubkey }, this.secretBuf).toString('hex')
              console.log("pubkey", pubkey.length, "cipherText", cipherText)
              this.pushNext(cipherText, cb)
          }.bind(this), function(cb) {
              console.log("Done after", this.keys)
              totalKeys = this.keys
              this.ended = true
              var pending = this.pending || []
              delete this.pending
              pending.forEach(this.next.bind(this))
              cb()
          }.bind(this)))
    }.bind(this))

    // TODO: setTimeout
}

Progress.prototype.pushNext = function(cipherText, cb) {
    this.buffer.push(cipherText)

    if (this.pending) {
        var pending = this.pending || []
        delete this.pending
        var buffer = this.buffer
        this.buffer = []
        pending.forEach(this.next.bind(this))
    }
    process.nextTick(function() {
        cb()
    })
}

Progress.prototype.next = function(cb) {
    if (this.buffer.length > 0) {
        var buffer = this.buffer
        this.buffer = []
        cb(null, buffer)
    } else if (!this.ended) {
        if (!this.pending) this.pending = []
        this.pending.push(cb)
    } else {
        cb(null, null)
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
            poll: "/progress/" + p.id,
            challengeHash: p.sha1
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

    p.next(function(err, cipherTexts) {
        if (err) {
            res.status(500)
            res.end()
            return
        }

        var json = {}
        if (cipherTexts)
            json.ciphers = cipherTexts
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
        door.unlock(function(err) {
            if (err) {
                console.error(err.stack || err)
                res.json({ error: "" + err.message })
                return
            }

            res.json({})
        })
    } else {
        res.json({ error: "Challenge doesn't match" })
    }
    p.remove()
})

module.exports = app
