console.log("track functions")

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
    console.log("Got my track: " + (msg.track+1));
    var track = msg.track;
    var tr = createTrack(track);
    //document.querySelector("body").style.backgroundColor = colors[track];
    var matrix = document.getElementById("matrix");
    matrix.appendChild(tr);
    var track = document.getElementById("track"+msg.track+"-name");
    track.innerText = initials;
    document.querySelectorAll(".fader").forEach(element => {
        element.style.display = "block";
    });

});

socket.on('exit session', function(msg) {
    removeTrack();
    var reason = "";
    if(msg.reason)
    reason = "&exitreason=" + msg.reason;
    window.location.href = "/?room="+room+reason;
  });

