document.getElementById("instrument").style.display = "block";
var restart = document.getElementById("restart");
restart.style.display = "block";
restart.addEventListener("click", function(e){
  window.location.href = "/?room="+room;
});


function removeTrack() {
    console.log("Lost my track :(");
    document.querySelectorAll(".track").forEach(track => {
        track.remove();
    });
}

socket.on('create track', function(msg) {
    var icon = document.getElementById("instrument-icon");
    icon.setAttribute("src","images/"+msg.track+".png");
    removeTrack();
    console.log("Got my track: " + (msg.track));
    var track = msg.track;
    var tr = createTrack(track);
    document.getElementById("track-header").style.backgroundColor = colors[track];
    var matrix = document.getElementById("matrix");
    matrix.appendChild(tr);
    tr.style.backgroundColor = colors[track];
    var trackName = document.getElementById("track"+msg.track+"-name");
    var bigInitials = document.getElementById("big-initials");
    trackName.innerText = initials;
    bigInitials.innerText = initials;
    document.querySelectorAll(".fader").forEach(element => {
        element.style.display = "block";
    });

});

socket.on('update track', function(msg) {
    var notes = msg.notes;
    var trackID = "track"+msg.track;
    for(var i=0; i<notes.length; i++) {
        if(notes[i].vel > 0) {
            var value = notes[i].vel;
            var step = document.getElementById(trackID+"-step"+i);
            var fader = document.getElementById(trackID+"-step"+i+"fader");
            step.style.backgroundColor = valueToBGColor(value);
            var swColor = step.firstChild.getAttribute("color");
            step.firstChild.style.backgroundColor = valueToSWColor(value, swColor);
            fader.value = value;
        }
    }
});

socket.on('exit session', function(msg) {
    removeTrack();
    var reason = "";
    if(msg.reason)
    reason = "&exitreason=" + msg.reason;
    window.location.href = "/?room="+room+reason;
});

