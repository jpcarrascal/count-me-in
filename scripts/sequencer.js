// Am I a sequencer?
var isSeq = location.pathname.includes("sequencer");
var initials = "";
var room = findGetParameter("room");
if(!room) room = DEFAULT_ROOM;
if(isSeq)
  console.log("I am a sequencer");
else
  console.log("not a sequencer...");
if (!isSeq)
  initials = findGetParameter("initials") || "?";
else
  initials = "SQ";

// Node stuff:
var socket = io("", {query:{initials:initials, room:room, sequencer:isSeq}});
var mySocketID;
socket.on("connect", () => {
  console.log("Connected, socket.id:" + socket.id);
  mySocketID = socket.id;
});

socket.on('step value', function(msg) {
  console.log(msg);
  var stepID = "track"+msg.track+"-step"+msg.step;
  var step = document.getElementById(stepID);
  var fader = document.getElementById(stepID+"fader");
  step.setAttribute("value",msg.value);
  var value = step.getAttribute("value");
  step.style.backgroundColor = colorToValue(value);
  fader.value = value;
});

socket.on('clear track', function(msg) {
  var trackClass = ".track"+msg.track;
  var steps = document.querySelectorAll(trackClass);
  var name = document.getElementById("track"+msg.track+"-name");
  name.innerText = "---";
  steps.forEach(step =>{
    step.setAttribute("value",0);
    step.style.backgroundColor = offColor;
  });
});

socket.on('track initials', function(msg) {
  if(isSeq) {
    console.log("Got initials for track "+msg.track)
    var track = document.getElementById("track"+msg.track+"-name");
    track.innerText = msg.initials;
  }
});

socket.on('play', function(msg) {
    console.log("Remote play!" + msg.socketID)
    if(isSeq) playSequence();
});

socket.on('stop', function(msg) {
    console.log("Remote stop!" + msg.socketID)
    stopSequence();
});

socket.on('step tick', function(msg) {
    updateCursor(msg.counter, msg.prev);
});

function removeTrack() {
    console.log("Lost my track :(");
    document.querySelectorAll(".track").forEach(track => {
        track.remove();
    });
}

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

  // MIDI Stuff:
  var MIDIport = null;
  if (navigator.requestMIDIAccess) {
    console.log('Browser supports MIDI!');
    navigator.requestMIDIAccess().then(success, failure);
  }

  function success(midi) {
    var selectList = document.getElementById("device-select");
    selectList.addEventListener("change", function(e) {
      if(this.value != 0) {
        MIDIport = midi.outputs.get(this.value);
        console.log(MIDIport.name + " selected.");
        setCookie("MIDIdevice",this.value,1000);
      } else {
        MIDIport = null;
        console.log("Internal sounds selected.");
        setCookie("MIDIdevice",0,1000);
      }
    });
    var selectedDevice = getCookie("MIDIdevice");
    var outputs = midi.outputs.values();
    var numDevices = 0;
    // outputs is an Iterator
    for (var output = outputs.next(); output && !output.done; output = outputs.next()) {
        var option = document.createElement("option");
        option.value = output.value.id;
        option.text = output.value.name;
        if(selectedDevice == output.value.id) option.selected = true;
        selectList.appendChild(option);
        numDevices++;
    }
    let changeEvent = new Event('change');
    selectList.dispatchEvent(changeEvent);

    if(numDevices == 0) {
      var option = document.createElement("option");
      option.value = "";
      option.text = "No MIDI devices found...";
      selectList.appendChild(option);
    }
  }
  function failure(){ console.log("MIDI not supported :(")};
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

function playStepNotes(counter) {
  var stepPos = document.querySelectorAll(".step"+counter);
  var i = 0;
  stepPos.forEach(step => {
      var value = step.getAttribute("value");
      var note = parseInt(step.parentNode.parentNode.getAttribute("note"));
      if(value > 0) {
        if(MIDIport) MIDIplayNote(note, value, MIDIport);
        else AudioPlayDrum(i, value);
      }
      i++;
  });
}

function MIDIplayNote (note, vel, out) {
  out.send([NOTE_ON, note, vel]);
  setTimeout(out.send([NOTE_OFF, note, 0x00]), NOTE_DURATION);
}