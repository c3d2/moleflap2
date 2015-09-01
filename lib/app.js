var express = require('express')
var through = require('through2')
var EC = require('elliptic').ec
var db = require('./db')
var door = require('./door')

var ec = new EC('ed25519')
var app = express()
app.use(require('morgan')('combined'))
app.use(express.static(__dirname + '/../public'))

var totalKeys
var progresses = {}
function Progress(newPubkey, signature) {
    var id
    do {
        id = "" + Math.ceil(999999 * Math.random())
    } while(progresses.hasOwnProperty(id))
    progresses[id] = this
    this.id = id

    process.nextTick(function() {
        // Start async validation
        var matchedPubkeys = []
        this.keys = 0
        db.pubkeys().
          pipe(through.obj(function(pubkey, enc, cb) {
              var key = ec.keyFromPublic(pubkey, 'hex')
              var valid = key.verify(newPubkey, signature)
              if (valid) {
                  matchedPubkeys.push(pubkey)
              }
              this.keys++
              setTimeout(cb, 1)
          }.bind(this), function(cb) {
              totalKeys = this.keys

              console.log("matched", matchedPubkeys)
              if (matchedPubkeys.length > 0) {
                  db.replaceKey(matchedPubkeys[0], newPubkey, function(err) {
                      if (err) {
                          console.error(err.stack || err)
                          this.status = 'error'
                          return
                      }
                      this.status = 'ok'
                  }.bind(this))
              } else {
                  this.status = 'not_found'
              }
              cb()
          }.bind(this)))
    }.bind(this))
}

Progress.prototype.remove = function() {
    if (!progresses.hasOwnProperty(this.id)) {
        console.warn("Removing non-existent progress", this.id)
        return
    }
    if (!progresses[this.id].status) {
        console.warn("Removing unfinished progress", this.id)
    }
    delete progresses[this.id]
}

app.post("/unlock/:newKey/:signature", function(req, res) {
    try {
        var p = new Progress(req.params.newKey, req.params.signature)

        res.json({ poll: "/progress/" + p.id })
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

    if (!p.status) {
        res.json({ progress: totalKeys && Math.round(100 * p.keys / totalKeys) })
        res.end()
    } else {
        res.json({ status: p.status })
        res.end()

        if (p.status === 'ok') {
            door.unlock()
        }
        p.remove()
    }
})

module.exports = app
