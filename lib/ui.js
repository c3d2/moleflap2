var crypto = require('crypto')

var Z = require('browserify-zepto')
Z('body').empty()

var statusEl = Z("<p></p>")
Z('body').append(statusEl)
var progressEl
function status(s, progress) {
    statusEl.text(s)

    if (typeof progress == 'number') {
        if (!progressEl) {
            progressEl = Z('<progress max="100"></progress>')
            progressEl.insertAfter(statusEl)
        }
        progressEl.attr('value', progress)
    } else if (progressEl) {
        progressEl.remove()
        progressEl = undefined
    }
}

var keyEl = Z("<textarea cols='16' rows='4' style='display: block'></textarea>")
if (localStorage && localStorage.moleflap_privkey)
  keyEl.val(localStorage.moleflap_privkey)
Z('body').append(keyEl)
var privkey
var plain

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
            poll(data.poll)
        },
        error: function(req, type, err) {
            status("Error: " + err.message)
        }
    })
})
Z('body').append(submitEl)

function poll(pollUrl) {
    console.log("poll...", pollUrl)
    Z.ajax({
        url: pollUrl,
        success: function(data, _status, xhr) {
            console.log("poll:", data)
            if (data.cipher) {
                var cipher = new Buffer(data.cipher, 'hex')
                console.log("cipher", cipher, "privkey", privkey)
                try {
                    plain = crypto.privateDecrypt(privkey, cipher).toString()
                } catch(e) {
                    // Cannot decrypt
                    console.warn("Ignore", e)
                }

                if (data.progress) {
                  status("Picking...", data.progress)
                }
                // retry:
                poll(pollUrl)
            } else if (!data.cipher) {
                if (plain) {
                    status("Ok, unlocking now.")
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
