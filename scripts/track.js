var counter = document.getElementById("counter");
var rounds = 0;
socket.on('step tick', function(msg) {
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
  window.location.href = "/track?room="+room;
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
    var icon = document.getElementById("big-instrument-icon");
    if(track>7) icon.setAttribute("src","images/8.png");
    else icon.setAttribute("src","images/"+track+".png");
    counter.innerText = msg.maxNumRounds;
    counter.style.color = colors[track];
    rounds = msg.maxNumRounds;
    var tr = createTrack(track);
    document.getElementById("track-header").style.backgroundColor = colors[track];
    if(track>7) {
        document.getElementById("track-header").style.color = "white";
        document.getElementById("big-instrument-icon").style.filter = "invert(1)";
    }
    var matrix = document.getElementById("matrix");
    matrix.appendChild(tr);
    tr.style.backgroundColor = colors[track];
    var trackName = document.getElementById("track"+msg.track+"-name");
    var bigInitials = document.getElementById("big-initials");
    trackName.innerText = initials;
    bigInitials.innerText = initials;
    var selector = ".fader";
    if(track>7) selector = ".keyboard"
    document.querySelectorAll(selector).forEach(element => {
        element.style.display = "block";
    });

});

socket.on('update track', function(msg) {
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
    //removeTrack();
    var reason = "";
    if(msg.reason)
        reason = "&exitreason=" + msg.reason;
    window.location.href = "/track?room="+room+reason;
});

