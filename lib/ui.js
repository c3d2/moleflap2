var crypto = require('crypto')

var Z = require('browserify-zepto')
Z('body').empty()

var keyEl = Z("<textarea cols='64' rows='28' style='display: none'></textarea>")
keyEl.attr('placeholder', "-----BEGIN RSA PRIVATE KEY-----\n[…]\n-----END RSA PRIVATE KEY-----\n")

if (localStorage && localStorage.moleflap_privkey) {
    // Automatically fill key
    keyEl.val(localStorage.moleflap_privkey)
} else {
    // Prompt the user to paste key
    editKey()
}
var privkey
var plain
var serverSha1

var submitEl = Z("<button>Unlock</button>")
submitEl.click(function() {
    privkey = keyEl.val()
    plain = null

    status("Making initial request…")
    Z.ajax({
        type: 'POST',
        url: "/unlock",
        success: function(data, _status, xhr) {
            console.log("init", data)
            status("Awaiting verification…")
            serverSha1 = data.challengeHash
            poll(data.poll)
        },
        error: function(req, type, err) {
            status("Error: " + err.message)
        }
    })
})
Z('body').append(submitEl)

var editKeyButton = Z("<button>Edit key</button>");
editKeyButton.click(function editKey() {
    keyEl.css('display', 'block')
    editKeyButton.css('display', 'none')
});
Z('body').append(editKeyButton);

function poll(pollUrl) {
    Z.ajax({
        url: pollUrl,
        success: function(data, _status, xhr) {
            console.log("poll:", data)
            if (data.ciphers) {
                status(plain ? "Success, waiting…" : "Picking…", data.progress)

                var ciphers = [].concat(data.ciphers)
                console.log("ciphers", ciphers)
                function next() {
                    console.log("next", ciphers.length)
                    if (ciphers.length < 1) {
                        // retry:
                        status("Polling server again…", data.progress)
                        return poll(pollUrl)
                    }

                    status("Decrypting…", 100 - Math.ceil(100 * ciphers.length / data.ciphers.length));
                    var cipher = new Buffer(ciphers.shift(), 'hex')
                    try {
                        plain = plain || crypto.privateDecrypt(privkey, cipher).toString()
                        var hash = crypto.createHash('sha1')
                        hash.update(plain)
                        var mySha1 = hash.digest('hex')
                        if (mySha1 !== serverSha1) {
                            // Don't send this to server, it would de-anonymize the client:
                            plain = undefined
                            console.log("mySha1", mySha1, "!== serverSha1", serverSha1)
                        } else {
                            console.log("Challenge hash", mySha1, "matches!")
                        }
                    } catch(e) {
                        // Cannot decrypt
                        console.warn("Ignore", e)
                    }

                    // Iterate
                    // async, for redrawing status
                    setTimeout(next, 1)
                }
                // async, for redrawing status
                setTimeout(next, 10)

            } else {
                if (plain) {
                    status("Ok, unlocking now…")
                    Z.ajax({
                        type: 'POST',
                        url: pollUrl + "/" + plain,
                        success: function(data, _status, xhr) {
                            console.log("unlock success:", data)
                            if (!data.error) {
                                status("Unlocked. Welcome!")
                                if (localStorage)
                                  localStorage.moleflap_privkey = keyEl.val()
                            } else {
                                status("Error: " + data.error)
                            }
                        },
                        error: function(req, type, err) {
                            status("Error: " + err.message)
                        }
                    })
                } else {
                    status("Cannot decrypt.")
                }
            }
        },
        error: function(req, type, err) {
            status("Error: " + err.message)
        }
    })
}

var statusEl = Z("<p></p>")
Z('body').append(statusEl)
var progressEl
function status(s, progress) {
    statusEl.text(s)

    if (typeof progress == 'number') {
        if (!progressEl) {
            progressEl = Z('<progress max="100"></progress>')
            progressEl.insertBefore(statusEl)
        }
        progressEl.attr('value', progress)
    } else if (progressEl) {
        progressEl.remove()
        progressEl = undefined
    }
}

Z('body').append(keyEl)


/* Add Service Worker */
if (!navigator.serviceWorker.controller) {
    navigator.serviceWorker.register('service-worker.js', {
        scope: '/'
    })
}
