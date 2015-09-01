var zmq = require('zmq')

var sock = zmq.socket('req')
sock.connect("tcp://schalter.hq.c3d2.de:23456")

module.exports = {
    unlock: function(cb) {
        sock.send("L")
        sock.once('message', function(data) {
            data = data.toString()
            if (data == "Ok") {
                cb()
            } else {
                cb(new Error(data))
            }
        })
    }
}
