var room = findGetParameter("room") || DEFAULT_ROOM;
initials = findGetParameter("initials") || "?";
var socket = io("", {query:{initials:initials, room:room, conductor:"conductor"}});
var mySocketID;
socket.on("connect", () => {
  console.log("Connected, my socketid: " + socket.id);
  mySocketID = socket.id;
});

socket.on('exit session', function(msg) {
    var reason = "";
    if(msg.reason)
        reason = "?exitreason=" + msg.reason;
    window.location.href = "/conductor"+reason;
});

var mixer = document.getElementById("mixer");
for(var i=0; i<num_tracks; i++) {
    createChannelStrip(i);
}

function createChannelStrip(i) {
    var trackID = "track"+i;
    var strip = document.createElement("div");
    strip.setAttribute("id",trackID);
    strip.setAttribute("track",i);
    strip.classList.add(trackID);
    strip.classList.add("track");
    strip.setAttribute("vol", 1);
    strip.setAttribute("intVol", 127);
    strip.setAttribute("mute", 0);
    strip.setAttribute("solo", 0);

    var muteCell = document.createElement("div");
    muteCell.classList.add("strip-cell");
    var muteButton = document.createElement("div");
    muteButton.classList.add("mute");
    muteButton.classList.add(trackID);
    muteButton.setAttribute("id","mute"+i);
    muteButton.setAttribute("track",i);
    muteButton.setAttribute("value",0);
    muteButton.addEventListener('click', muteClick);
    var sw = document.createElement("div");
    sw.classList.add("mixSw");
    var mute = document.createTextNode("M");
    sw.appendChild(mute);
    muteButton.appendChild(sw);
    muteCell.appendChild(muteButton);

    var soloCell = document.createElement("div");
    soloCell.classList.add("strip-cell");
    var soloButton = document.createElement("div");
    soloButton.classList.add("solo");
    soloButton.classList.add(trackID);
    soloButton.setAttribute("id","solo"+i);
    soloButton.setAttribute("track",i);
    soloButton.setAttribute("value",0);
    soloButton.addEventListener('click', soloClick);
    var sw2 = document.createElement("div");
    sw2.classList.add("mixSw");
    var solo = document.createTextNode("S");
    sw2.appendChild(solo);
    soloButton.appendChild(sw2);
    soloCell.appendChild(soloButton);

    var faderCell = document.createElement("div");
    faderCell.classList.add("strip-cell");
    var rail = document.createElement("rail");
    rail.classList.add("mix-fader-rail");
    rail.setAttribute("id","rail"+i);
    rail.setAttribute("track",i);
    rail.addEventListener('mousedown', faderMouseDown);
    rail.addEventListener('mouseup', faderMouseUp);

    var cap = document.createElement("div");
    cap.classList.add("mix-fader-cap");
    cap.classList.add(trackID);
    cap.setAttribute("id","cap"+i);
    cap.setAttribute("track",i);
    rail.appendChild(cap);  
    faderCell.appendChild(rail);

    var img = document.createElement("img");
    if(i>7) img.setAttribute("src","images/8.png");
    else img.setAttribute("src","images/"+i+".png");
    img.setAttribute("track",trackID);
    img.setAttribute("id",trackID+"-icon");
    img.classList.add("track-icon");

    strip.appendChild(img);
    strip.appendChild(muteCell);
    strip.appendChild(soloCell);
    strip.appendChild(faderCell);
    document.getElementById("mixer").appendChild(strip);
}

function faderMove(e) {
    var track = this.getAttribute("track");
    updateVol(track, e);
}

function faderMouseDown(e) {
    this.addEventListener("mousemove",faderMove);
}

function faderMouseUp(e) {
    this.removeEventListener("mousemove",faderMove);
}

document.addEventListener("mouseup", function(e) {
    document.querySelectorAll(".mix-fader-rail").forEach( elem => {
        elem.removeEventListener("mousemove",faderMove);
    })
});

function updateVol(i, e) {
    var fader = document.getElementById("rail"+i);
    var railRect = fader.getBoundingClientRect();
    var capRect = fader.firstChild.getBoundingClientRect();
    var max = railRect.height - capRect.height;
    var track = document.getElementById("track"+i)
    var y = e.clientY - railRect.top - capRect.height/2;
    if(y < capRect.height/2) y = 0;
    if(y > max) y = max;
    fader.firstChild.style.marginTop = y+"px";
    var value = 1-y/max;
    var intValue = parseInt(value * 127);
    track.setAttribute("vol",value);
    if(intValue != track.getAttribute("intVol")) {
        track.setAttribute("intVol",intValue);
        console.log(intValue);
        socket.emit('track volume', { track: i, value: value } );
    }
}

function muteClick(e) {
    var track = this.getAttribute("track");
    muteTrack(track);
} 

function soloClick(e) {
    var track = this.getAttribute("track");
    soloTrack(track);
} 

function muteTrack(i, value) {
    var trackElem = document.getElementById("track"+i);
    var muteElem  = document.getElementById("mute"+i);
    if(value == undefined) {
        value = trackElem.getAttribute("mute")==0?1:0;
    }
    if(value == 1) {
        muteElem.firstChild.classList.add("mute-on");
        muteElem.parentNode.style.backgroundColor = "#666";
    } else {
        muteElem.firstChild.classList.remove("mute-on");
        muteElem.parentNode.style.backgroundColor = "white";
    }    

    trackElem.setAttribute("mute", value)
    socket.emit('track mute', { track: i, value: value } );
}

function soloTrack(i) {
    var value;
    var track = document.getElementById("track"+i);
    var solo = document.getElementById("solo"+i)
    if(track.getAttribute("solo") == 0) {
        value = 1;
        track.setAttribute("solo", 1);
        solo.firstChild.classList.add("solo-on");
        solo.parentNode.style.backgroundColor = "#666";
        muteTrack(i, 0);
        document.querySelectorAll(".track").forEach( elem => {
            var id = elem.getAttribute("track");
            var isMuted  = elem.getAttribute("mute");
            var isSoloed = elem.getAttribute("solo");
            if( isMuted == 0 && isSoloed == 0 && id != i )
                muteTrack(id, 1);
        });
    } else {
        value = 0;
        track.setAttribute("solo", 0);
        solo.firstChild.classList.remove("solo-on");
        solo.parentNode.style.backgroundColor = "white";
        var otherSolo = false;
        document.querySelectorAll(".track").forEach( elem => {
            var id = elem.getAttribute("track");
            if( elem.getAttribute("solo") == 1 && id != i ) {
                otherSolo = true;
                console.log("more solos")
            }
        });
        if(otherSolo)
            muteTrack(i, 1);
        else {
            document.querySelectorAll(".track").forEach( elem => {
                var id = elem.getAttribute("track");
                var isMuted  = elem.getAttribute("mute");
                var isSoloed = elem.getAttribute("solo");
                if( elem.getAttribute("track") != i )
                   muteTrack(id, 0);
            });
        }
    }
    socket.emit('track solo', { track: track, value: value } );
} 