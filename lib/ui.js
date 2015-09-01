var EC = require('elliptic').ec
var ec = new EC('ed25519')

var Z = require('browserify-zepto')
Z('body').empty()

var statusEl = Z("<p></p>")
Z('body').append(statusEl)
function status(s) {
    statusEl.text(s)
}

var keyEl = Z("<textarea cols='16' rows='4' style='display: block'></textarea>")
if (localStorage && localStorage.moleflap_privkey)
  keyEl.val(localStorage.moleflap_privkey)
Z('body').append(keyEl)

var submitEl = Z("<button style='display: block'>Unlock</button>")
submitEl.click(function() {
    var oldPrivkey = keyEl.val().
      replace(/[^0-9a-f]/g, "")
    var oldKey = ec.keyFromPrivate(oldPrivkey, 'hex')
    status("Generating new key...")
    // Yield to repaint
    setTimeout(function() {
        var newKey = ec.genKeyPair()
        var newPubkey = newKey.getPublic('hex')
        var newPrivkey = newKey.getPrivate('hex')

        status("Signing new key with old key...")
        // Yield to repaint
        setTimeout(function() {
            var sig = oldKey.sign(newPubkey).toDER('hex')

            status("Making initial request...")
            Z.ajax({
                type: 'POST',
                url: "/unlock/" + newPubkey + "/" + sig,
                success: function(data, _status, xhr) {
                    console.log("success", data, status)
                    status("Awaiting verification...")
                    poll(data.poll, newPrivkey)
                },
                error: function(req, type, err) {
                    status("Error: " + err.message)
                }
            })
        }, 1)
    }, 1)
})
Z('body').append(submitEl)

function poll(pollUrl, newPrivkey) {
    console.log("poll...", pollUrl)
    Z.ajax({
        url: pollUrl,
        success: function(data, _status, xhr) {
            console.log("poll:", data)
            if (!data.status) {
                if (data.progress)
                  status(data.progress + "% verified")
                // retry:
                poll(pollUrl, newPrivkey)
            } else if (data.status === 'not_found') {
                status("Your key was not found")
            } else if (data.status === 'error') {
                status("Error")
            } else if (data.status === 'ok') {
                status("Ok, unlocking now.")
                keyEl.val(newPrivkey)
                if (localStorage)
                  localStorage.moleflap_privkey = newPrivkey
            }
        },
        error: function(req, type, err) {
            status("Error: " + err.message)
        }
    })
}
