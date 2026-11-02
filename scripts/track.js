var experiment = findGetParameter("experiment") || false;
var counter = document.getElementById("counter");
var pausedMessage = document.getElementById("lang-paused");
var pausedIcon = document.getElementById("instrument-icon-paused");
var hasTrack = false;
var turnOver = false;
// Fix these:
var myNotes = [];
var myTrack = -1;
var myColor = "white";
//var noSleep = new NoSleep();
/*
if(screen.orientation.lock !== "undefined") {
    screen.orientation.lock('landscape');
}
*/

document.getElementById("small-initials").innerText = initials;

function showPaused(message) {
    document.getElementById("sequencer").style.display = "none";
    document.getElementById("paused").style.display = "flex";
    pausedMessage.innerText = message;
}

function showSequencer() {
    document.getElementById("paused").style.display = "none";
    document.getElementById("sequencer").style.display = "flex";
}

// The sequencer (Play/Stop, or the device's Audience toggle) opens and
// closes the session; core tells everyone with veil-off/veil-on, and tells
// joiners the current state before their track arrives. People waiting in
// line only note it, so they keep their queue message.
socket.on('veil-off', function() {
    sessionOpen = true;
    if(hasTrack) showSequencer();
});

// The server counts rounds (once we've interacted) and evicts on its count.
socket.on('rounds update', function(msg) {
    counter.innerText = msg.remaining;
});

// The session closed, or the sequencer closed or is reloading: we keep our
// track, but go back to the paused screen until it reopens.
socket.on('veil-on', function() {
    sessionOpen = false;
    if(!hasTrack) return;
    showPaused(translate(lang, "The session will start in a bit."));
});

socket.on('slot-expired', function() {
    console.log("Turn over, moved to the line.");
    removeTrack();
    hasTrack = false;
    turnOver = true;
    showPaused(translate(lang, "Your turn is over!"));
});

socket.on('queue-status', function(msg) {
    hasTrack = false;
    pausedIcon.style.display = "none";
    var line = translate(lang, "You are #{n} in line.").replace("{n}", msg.position);
    var intro = turnOver ? translate(lang, "Your turn is over!") : translate(lang, "All tracks are taken.");
    showPaused(intro + " " + line);
});

socket.on('hide toggle track', function(msg) {
    if(msg.value > 63)
        document.getElementById("matrix").classList.toggle("invisible");
});

var restart = document.getElementById("restart");
restart.addEventListener("click", function(e){
    restartSession();
});


function removeTrack() {
    console.log("Lost my track :(");
    document.querySelectorAll(".track").forEach(track => {
        track.remove();
    });
}

socket.on('create track', function(msg) {
    removeTrack();
    console.log("Got my track: " + (msg.track));
    var track = msg.track;
    myTrack = track;
    myNotes = stepSequencer.tracks[track].notes;
    hasTrack = true;
    turnOver = false;
    var trackID = "track"+track;
    fetch(soundsJson)
        .then((response) => response.json())
        .then((soundPreset) => {
            var sound = soundPreset[track];
            var imageURL = soundFolder + "images/" + sound.image;
            var icon = document.getElementById("big-instrument-icon");
            var preIcon = document.getElementById("instrument-icon-paused");
            icon.setAttribute("src",imageURL);
            preIcon.setAttribute("src",imageURL);
            preIcon.style.display = "";
            pausedMessage.innerText = translate(lang, "The session will start in a bit.");
            counter.innerText = msg.maxNumRounds;
            var color = getColor(track);
            // Fix this:
            myColor = color;
            //counter.style.color = color;
            var tr = createTrack(track, sound);
            document.getElementById("track-header").style.backgroundColor = color;
            if(color == "black") {
                document.getElementById("track-header").style.color = "white";
                document.getElementById("paused").style.color = "white";
                document.getElementById("big-instrument-icon").style.filter = "invert(1)";
                document.getElementById("instrument-icon-paused").style.filter = "invert(1)";
            }
            var matrix = document.getElementById("matrix");
            matrix.appendChild(tr);
            setTrackMetaColor(track, color);
            document.body.style.backgroundColor = color;
            var trackName = document.getElementById("track"+track+"-name");
            var bigInitials = document.getElementById("big-initials");
            trackName.innerText = initials;
            bigInitials.innerText = initials;
            var selector = ".fader";
            if(sound.type == "synth") selector = ".keyboard"
            document.querySelectorAll(selector).forEach(element => {
                element.style.display = "none";
            });
            // Expert mode switch:
            var expertCheckbox = document.getElementById("expert-mode");
            document.getElementById("expert-mode").setAttribute("track", trackID);
            expertCheckbox.style.setProperty("--track-color", color);
            expertCheckbox.checked = false;
            // Assigned (not added) so a re-promoted track doesn't stack handlers.
            expertCheckbox.onchange = function(e){
                socket.emit('expert-mode', { track: track, socketid: mySocketID, value: this.checked } );
                showStepControls(trackID, sound.type);
            };
            // Fill the track from the server's Pattern grid (handled in
            // sequencer.js). Unlike other events, this request doesn't count
            // as interaction, so rounds only start once we edit a step.
            socket.emit('request-pattern-snapshot');
            if(sessionOpen) showSequencer();
        });
});

socket.on('exit session', function(msg) {
    var reason = msg.reason;
    restartSession(reason);
});

// Core refusals: session missing/not ready, or torn down.
socket.on('session-unavailable', function(msg) {
    restartSession(msg && msg.reason);
});
socket.on('session-ended', function() {
    restartSession("The session has ended."); // core sends a code, not text
});


function restartSession(r) {
    var reason = "";
    if(r && r!== "") reason = "&exitreason=" + encodeURIComponent(r);
    window.location.href = "/track?session=" + session +
    "&sounds=" + findGetParameter("sounds")+
    "&lang=" + findGetParameter("lang") + reason;
}

