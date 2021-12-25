
// Am I a sequencer?
var isSeq = location.pathname.includes("sequencer");
var initials = "";
var room = findGetParameter("room");
var method;
if(!room) room = DEFAULT_ROOM;
if(isSeq) {
  var drumSequencer = new DrumSequencer(NUM_TRACKS, NUM_STEPS, notes);
  method = findGetParameter("method") || "sequential";
}
else
  console.log("not a sequencer...");
if (!isSeq)
  initials = findGetParameter("initials") || "?";
else
  initials = "SQ";


// Node stuff:
var socket = io("", {query:{initials:initials, room:room, sequencer:isSeq, method:method}});
var mySocketID;
socket.on("connect", () => {
  //console.log("Connected, socket.id:" + socket.id);
  mySocketID = socket.id;
});

socket.on('step value', function(msg) {
  var stepID = "track"+msg.track+"-step"+msg.step;
  var step = document.getElementById(stepID);
  var fader = document.getElementById(stepID+"fader");
  step.setAttribute("value",msg.value);
  var value = step.getAttribute("value");
  step.style.backgroundColor = colorToValue(value);
  fader.value = value;
  if(isSeq) drumSequencer.tracks[msg.track].notes[msg.step].vel = value;
});

socket.on('clear track', function(msg) {
  var name = document.getElementById("track"+msg.track+"-name");
  name.innerText = "---";
  clearTrack(msg.track);
});

socket.on('track joined', function(msg) {
  if(isSeq) {
    console.log(msg.initials + " joined on track " + msg.track)
    var track = document.getElementById("track" + msg.track+"-name");
    track.innerText = msg.initials;
    drumSequencer.setTrackInitials(msg.track, msg.initials);
    clearTrack(msg.track);
  }
});

function clearTrack(track) {
  drumSequencer.clearTrack(track);
  var trackClass = ".track"+track;
  var steps = document.querySelectorAll(trackClass);
  steps.forEach(step =>{
    step.setAttribute("value",0);
    step.style.backgroundColor = offColor;
  });
}

socket.on('play', function(msg) {
    console.log("Remote play!" + msg.socketID)
    //if(isSeq) playSequence();
});

socket.on('stop', function(msg) {
    console.log("Remote stop!" + msg.socketID)
    stopSequence();
});

socket.on('step tick', function(msg) {
    updateCursor(msg.counter, msg.prev);
});



// UI stuff:
var matrix = document.getElementById("matrix");
createHeader(matrix);

if(isSeq) { // Stuff only for the full sequencer:
  document.getElementById("control-panel").style.display = "flex";
  // tracks:
  for(var i=NUM_TRACKS-1; i>=0; i--) {
    var tr = createTrack(i);
    matrix.appendChild(tr);
  }
} else {
  document.getElementById("instrument").style.display = "block";
  var restart = document.getElementById("restart");
  restart.style.display = "block";
  restart.addEventListener("click", function(e){
    window.location.href = "/?room="+room;
  });
}

// Seq stuff:
var tempo = document.getElementById("tempo").value;
var playing = false;
var interval = 60000/(4*tempo);
var timer;
var counter = 0;
var prev = 15;

if(isSeq) {
  document.addEventListener("keydown", event => {
    if (event.code == "Space") {
      event.preventDefault();
      e = new Event("click");
      if(playing)
      document.querySelector("#stop").dispatchEvent(e);
      else
        document.querySelector("#play").dispatchEvent(e);
    }
    // do something
  });
/*
  document.querySelector("#stop").addEventListener("click", function(e){
    if(playing) {
      socket.emit('stop', { socketID: mySocketID });
      document.querySelector("#play").classList.remove("playing");
      stopSequence();
    }
  });

  document.querySelector("#play").addEventListener("click", function(e){
    if(!playing) {
      socket.emit('play', { socketID: mySocketID });
      this.classList.add("playing");
      playSequence();
    }
  });*/
}

function stopSequence() {
  clearTimeout(timer);
  playing = false;
  updateCursor(-1, -1);
}

function playSequence() {
  counter = 0;
  prev = 15;
  updateCursor(counter, prev);
  playStepNotes(counter);
  socket.emit('step tick', { counter: counter, prev: prev } );
  timer = setTimeout(function next(){
    if(counter < NUM_STEPS-1) {
      counter++;
      prev = counter - 1;
    } else {
      counter = 0;
      prev = 15;
    }
    updateCursor(counter, prev);
    playStepNotes(counter);
    socket.emit('step tick', { counter: counter, prev: prev } );
    timer = setTimeout(next, interval);
  }, interval);
  playing = true;
}

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
      step.style.backgroundColor = colorToValue(step.getAttribute("value"));
    })
    stepPos.forEach(step => {
      var c = parseInt(step.getAttribute("track"))+1;
      if(c>7) c = 0;
      var hlColor = colors[c]
      step.parentElement.classList.add("cursor");
      if(step.getAttribute("value") > 0){
        step.style.backgroundColor = hlColor;
      }
    });
  } else {
    var all = document.querySelectorAll(".step");
    all.forEach(step => {
      step.parentElement.classList.remove("cursor");
    })
  }
}



