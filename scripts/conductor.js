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
for(var i=0; i<NUM_TRACKS; i++) {
    createFader(i);
}

function createFader(i) {
    var cell = document.createElement("div");
    var trackID = "track"+i;
    cell.setAttribute("id",trackID);
    cell.classList.add("mix-fader-cell");

    var rail = document.createElement("rail");
    rail.classList.add("mix-fader-rail");
    rail.setAttribute("id","rail"+i);
    rail.setAttribute("track",i);
    rail.setAttribute("value",0);
    rail.addEventListener('mousedown', mixFaderClick);

    var cap = document.createElement("div");
    cap.classList.add("mix-fader-cap");
    cap.classList.add(trackID);
    cap.setAttribute("id","cap"+i);
    cap.setAttribute("track",i);
    rail.appendChild(cap);  
    cell.appendChild(rail);
    document.getElementById("mixer").appendChild(cell);
  }

  function mixFaderClick(e) {
      var railRect = this.getBoundingClientRect();
      var capRect = this.firstChild.getBoundingClientRect();
      var max = railRect.height - capRect.height;
      var track = this.getAttribute("track");
      var y = e.clientY - railRect.top - capRect.height/2;
      if(y < capRect.height/2) y = 0;
      if(y > max) y = max;
      this.firstChild.style.marginTop = y+"px";
      var value = 1-y/max;
      this.setAttribute("value",value);
      socket.emit('track volume', { track: track, value: value } );
  } 