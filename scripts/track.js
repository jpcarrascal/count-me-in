var counter = document.getElementById("counter");
var rounds = 0;
var inLobby = true;
//var noSleep = new NoSleep();
/*
if(screen.orientation.lock !== "undefined") {
    screen.orientation.lock('landscape');
}
*/

socket.on('step tick', function(msg) {
    if(inLobby) {
        console.log("in lobby");
        document.getElementById("paused").style.display = "none";
        document.getElementById("sequencer").style.display = "flex";
        inLobby = false;
    }
    if(msg.counter == 15 && counting) {
        rounds--;
        if(rounds >= 0)
            counter.innerText = rounds;
        else
            counter.innerText = ":o";
    }
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
    if(msg.track == undefined) restartSession( translate(lang, "No available tracks! Please wait a bit...") );
    var track = msg.track;
    fetch(soundsJson)
        .then((response) => response.json())
        .then((soundPreset) => {
            var sound = soundPreset[track];
            var imageURL = soundFolder + "images/" + sound.image;
            var icon = document.getElementById("big-instrument-icon");
            var preIcon = document.getElementById("instrument-icon-paused");
            icon.setAttribute("src",imageURL);
            preIcon.setAttribute("src",imageURL);
            counter.innerText = msg.maxNumRounds;
            var color = getColor(track);
            counter.style.color = color;
            rounds = msg.maxNumRounds;
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
            tr.style.backgroundColor = color;
            document.body.style.backgroundColor = color;
            var trackName = document.getElementById("track"+track+"-name");
            var bigInitials = document.getElementById("big-initials");
            var smallInitials = document.getElementById("small-initials");
            trackName.innerText = initials;
            bigInitials.innerText = initials;
            smallInitials.innerText = initials;
            var selector = ".fader";
            if(sound.type == "synth") selector = ".keyboard"
            document.querySelectorAll(selector).forEach(element => {
                element.style.display = "block";
            });
            console.log("asking for my notes!")
            socket.emit('give me my notes', { track: track, socketid: mySocketID } );
        });
});

socket.on('update track notes', function(msg) {
    console.log("receiving my notes :)")
    var notes = msg.notes;
    var trackID = "track"+msg.track;
    for(var i=0; i<notes.length; i++) {
        if(notes[i].vel > 0) {
            var stepID = trackID+"-step"+i;
            var value = notes[i].vel;
            var stepElem = document.getElementById(stepID);
            var fader = document.getElementById(stepID+"fader");
            var kb = document.getElementById(stepID+"kb");
            var swColor = stepElem.firstChild.getAttribute("color");
            stepElem.setAttribute("value", value);
            stepElem.style.backgroundColor = valueToBGColor(value);
            stepElem.firstChild.style.backgroundColor = valueToSWColor(value, swColor);
            fader.value = value;
            kb.setNote(notes[i].note);
        }
    }
});

socket.on('exit session', function(msg) {
    var reason = msg.reason;
    restartSession(reason);
});


function restartSession(r) {
    var reason = "";
    if(r && r!== "") reason = "&exitreason=" + r;
    window.location.href = "/track?room=" + room +
    "&sounds=" + findGetParameter("sounds")+
    "&lang=" + findGetParameter("lang") + reason;
}

