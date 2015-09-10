var db = require('level')(__dirname + "/../tokens.db")

module.exports = {
    addKey: function(name, pubkey, cb) {
        db.put(name, pubkey, cb)
    },

    pubkeys: function() {
        return db.createValueStream()
    },

    pubkeysWithNames: function() {
        return db.createReadStream()
    },

    removeKey: function(name, cb) {
        db.del(name, cb)
    }
}
