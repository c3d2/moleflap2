var request = require('request')

module.exports = {
    unlock: function(cb) {
        request({
            method: 'POST',
            url: "http://schalter.hq.c3d2.de/door/unlock"
        }, err => cb(err))
    }
}
