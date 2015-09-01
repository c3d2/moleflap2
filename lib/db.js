var db = require('level')(__dirname + "/../tokens.db")

module.exports = {
    addKey: function(pubkey, cb) {
        // TODO: make sure it's not the previous
        db.put(pubkey, "{}", cb)
    },

    replaceKey: function(oldPubkey, newPubkey, cb) {
        this.addKey(newPubkey, function(err) {
            if (err) {
                return cb(err)
            }

            db.del(oldPubkey, "{}", cb)
        })
    },

    pubkeys: function() {
        return db.createKeyStream()
    }
}
