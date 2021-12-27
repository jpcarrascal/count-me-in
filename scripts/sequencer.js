
// Am I a sequencer?
var isSeq = location.pathname.includes("sequencer");
var initials = "";
var room = findGetParameter("room");
var method;
if(!room) room = DEFAULT_ROOM;
if(isSeq) {
  var drumSequencer = new DrumSequencer(NUM_TRACKS, NUM_STEPS, notes);
  method = findGetParameter("method") || "sequential";
  initials = "SQ";
} else {
  console.log("not a sequencer...");
  initials = findGetParameter("initials") || "?";
}

// Node stuff:
var socket = io("", {query:{initials:initials, room:room, sequencer:isSeq, method:method}});
var mySocketID;
socket.on("connect", () => {
  //console.log("Connected, socket.id:" + socket.id);
  mySocketID = socket.id;
});

socket.on('play', function(msg) {
  console.log("Remote play!" + msg.socketID)
});

socket.on('stop', function(msg) {
  console.log("Remote stop!" + msg.socketID)
});

socket.on('step tick', function(msg) {
  updateCursor(msg.counter, msg.prev);
});

socket.on('step value', function(msg) {
  var stepID = "track"+msg.track+"-step"+msg.step;
  var step = document.getElementById(stepID);
  if(step) {
    var fader = document.getElementById(stepID+"fader");
    step.setAttribute("value",msg.value);
    var value = step.getAttribute("value");
    step.style.backgroundColor = valueToBGColor(value);
    var swColor = step.firstChild.getAttribute("color");
    step.firstChild.style.backgroundColor = valueToSWColor(value, swColor);
    fader.value = value;
    if(drumSequencer) drumSequencer.tracks[msg.track].notes[msg.step].vel = value;
  }
});

// UI stuff:
var matrix = document.getElementById("matrix");
createHeader(matrix);

if(isSeq) {

  socket.on('clear track', function(msg) {
    var trackName = document.getElementById("track"+msg.track+"-name");
    var track = document.getElementById("track"+msg.track);
    track.style.backgroundColor = EMPTY_COLOR;
    trackName.innerText = "---";
    clearTrack(msg.track);
  });

  socket.on('track joined', function(msg) {
    console.log(msg.initials + " joined on track " + msg.track)
    var trackName = document.getElementById("track" + msg.track+"-name");
    var track = document.getElementById("track" + msg.track);
    trackName.innerText = msg.initials;
    track.style.backgroundColor = colors[msg.track];
    drumSequencer.setTrackInitials(msg.track, msg.initials);
    clearTrack(msg.track);
  });

  document.addEventListener("keydown", event => {
    if (event.code == "Space") {
      event.preventDefault();
      e = new Event("click");
      if(playing)
      document.querySelector("#stop").dispatchEvent(e);
      else
        document.querySelector("#play").dispatchEvent(e);
    }
  });

  document.getElementById("control-panel").style.display = "flex";
  // tracks:
  for(var i=NUM_TRACKS-1; i>=0; i--) {
    var tr = createTrack(i);
    matrix.appendChild(tr);
  }

}

function clearTrack(track) {
  drumSequencer.clearTrack(track);
  var trackClass = ".track"+track;
  var steps = document.querySelectorAll(trackClass);
  steps.forEach(step =>{
    step.setAttribute("value",0);
    step.style.backgroundColor = offColor;
    step.firstChild.style.backgroundColor = "transparent";
  });
}

// Seq stuff:
var tempo = document.getElementById("tempo").value;
var playing = false;
var interval = 60000/(4*tempo);
var timer;
var counter = 0;
var prev = 15;

document.getElementById("tempo").addEventListener("change",function(e){
  this.setAttribute('value', this.value);
  tempo = this.value;
  interval = 60000/(4*tempo);
});

function updateCursor(counter, prev) {
  if(counter >=0) {
    var stepPos = document.querySelectorAll(".step"+counter);
    var prevPos = document.querySelectorAll(".step"+prev);
    prevPos.forEach(step => {
      step.parentElement.classList.remove("cursor");
      step.style.backgroundColor = valueToBGColor(step.getAttribute("value"));
      //step.style.borderColor = "white";
    });
    stepPos.forEach(step => {
      var c = parseInt(step.getAttribute("track"))+1;
      if(c>7) c = 0;
      var hlColor = colors[c]
      step.parentElement.classList.add("cursor");
      if(step.getAttribute("value") > 0){
        step.style.backgroundColor = hlColor;
        //step.style.borderColor = hlColor;
      }
    });
  } else {
    var all = document.querySelectorAll(".step");
    all.forEach(step => {
      step.parentElement.classList.remove("cursor");
    })
  }
}



