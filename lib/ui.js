var crypto = require('crypto')

var Z = require('browserify-zepto')
Z('body').empty()

var keyEl = Z("<textarea cols='64' rows='28' style='display: block'></textarea>")
keyEl.attr('placeholder', "-----BEGIN RSA PRIVATE KEY-----\n[...]\n-----END RSA PRIVATE KEY-----\n")

if (localStorage && localStorage.moleflap_privkey)
  keyEl.val(localStorage.moleflap_privkey)
Z('body').append(keyEl)
var privkey
var plain
var serverSha1

var submitEl = Z("<button style='display: block'>Unlock</button>")
submitEl.click(function() {
    privkey = keyEl.val()
    plain = null

    status("Making initial request...")
    Z.ajax({
        type: 'POST',
        url: "/unlock",
        success: function(data, _status, xhr) {
            console.log("success", data, status)
            status("Awaiting verification...")
            serverSha1 = data.challengeHash
            poll(data.poll)
        },
        error: function(req, type, err) {
            status("Error: " + err.message)
        }
    })
})
Z('body').append(submitEl)

function poll(pollUrl) {
    Z.ajax({
        url: pollUrl,
        success: function(data, _status, xhr) {
            console.log("poll:", data)
            if (data.cipher) {
                status(plain ? "Success, waiting..." : "Picking...", data.progress)
                // async, for redrawing status
                setTimeout(function() {
                    var cipher = new Buffer(data.cipher, 'hex')
                    try {
                        plain = plain || crypto.privateDecrypt(privkey, cipher).toString()
                        var hash = crypto.createHash('sha1')
                        hash.update(plain)
                        var mySha1 = hash.digest('hex')
                        if (mySha1 !== serverSha1) {
                            // Don't send this to server, it would de-anonymize the client:
                            plain = undefined
                            console.warn("mySha1", mySha1, "!== serverSha1", serverSha1)
                        } else {
                            console.log("Challenge hash", mySha1, "matches!")
                        }
                    } catch(e) {
                        // Cannot decrypt
                        console.warn("Ignore", e)
                    }

                    // retry:
                    status("Polling server again...", data.progress)
                    poll(pollUrl)
                }, 10)
            } else if (!data.cipher) {
                if (plain) {
                    status("Ok, unlocking now...")
                    Z.ajax({
                        type: 'POST',
                        url: pollUrl + "/" + plain,
                        success: function(data, _status, xhr) {
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


/* Add Service Worker */
if (!navigator.serviceWorker.controller) {
    navigator.serviceWorker.register('service-worker.js', {
        scope: '/'
    })
}
