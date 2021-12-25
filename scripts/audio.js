window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext = new AudioContext();
 
var drumSamples = ["BD.WAV",
            "SD.WAV",
            "CP.WAV",
            "HC.WAV",
            "LC.WAV",
            "LT.WAV",
            "CH.WAV",
            "OH.WAV"];
/*
            "CY.WAV",
            "HT.WAV",
            "CB.WAV",
            "MT.WAV",
*/
var drums = new Array();
for(var i=0; i<drumSamples.length; i++) {
    var a = document.getElementById(drumSamples[i]);
    drums[i] = a;
    track = audioContext.createMediaElementSource(a);
    const gainNode = audioContext.createGain();
    track.connect(gainNode);
    gainNode.connect(audioContext.destination);
}


function loadSample(url) {
  let xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.responseType = 'arraybuffer';
  xhr.onload = function() {
    audioContext.decodeAudioData(xhr.response, decoded => {
      kickBuffer = decoded;
    });
  }
  xhr.send();
}


function playStepNotes(counter) {
  var notesToPlay = drumSequencer.getStepNotes(counter);
  for(var i=0; i<drumSequencer.nTracks; i++) {
    var value = notesToPlay[i].vel;
    var note = notesToPlay[i].note;
    if(value > 0) {
      if(MIDIport) MIDIplayNote(note, value, MIDIport);
      else AudioPlayDrum(i, value);
    }
  }
}

function AudioPlayDrum(i, vel) {
    //var drum = document.getElementById(drumSamples[i]);
    //drum.currentTime = 0;
    //drum.play();
    drums[i].currentTime = 0
    drums[i].volume = vel/127;
    drums[i].play();
}

var nextNote = document.getElementById("debug");

var nextNotetime = audioContext.currentTime;
var clock = document.getElementById("debug1");
var nextNote = document.getElementById("debug2");
var startBtn = document.getElementById("play");
var stopBtn = document.getElementById("stop");
var timerID;
var playTime = 0;
var osc;

//setInterval(function(){ clock.innerHTML = audioContext.currentTime; }, 500);

function playSound(time) {
  osc = audioContext.createOscillator();
  osc.connect(audioContext.destination);
  osc.frequency.value = 0;
  osc.start(time);
  osc.stop(time + 0.01);
};

function scheduler() {
    while(nextNotetime < audioContext.currentTime + 0.1) {
        nextNotetime += (interval/1000);
        console.log(counter)
        //nextNote.innerHTML = nextNotetime;
        if(counter < NUM_STEPS-1) {
            counter++;
            prev = counter - 1;
        } else {
            counter = 0;
            prev = 15;
        }
        playStepNotes(counter);
        socket.emit('step tick', { counter: counter, prev: prev } );
        console.log(audioContext.currentTime)
        playSound(nextNotetime);
        updateCursor(counter, prev);
    }
    timerID = window.setTimeout(scheduler, 0);
}

startBtn.addEventListener('click', function() {
  nextNotetime = audioContext.currentTime;
  counter = 0;
  prev = 15;
  socket.emit('play', { socketID: mySocketID });
  this.classList.add("playing");
  updateCursor(counter, prev);
  playStepNotes(counter);
  socket.emit('step tick', { counter: counter, prev: prev } );
  playing = true;
  scheduler();
});

stopBtn.addEventListener('click', function() {
  socket.emit('stop', { socketID: mySocketID });
  document.querySelector("#play").classList.remove("playing");
  clearTimeout(timerID);
  playing = false;
  updateCursor(-1, -1);
});

if(audioContext.state === 'suspended'){
  audioContext.resume();
};

