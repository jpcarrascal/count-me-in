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
var bassOsc = audioContext.createOscillator();
bassOsc.frequency.value = 0;
bassOsc.start(audioContext.currentTime);

function playBass(f) {
  if (f) bassOsc.frequency.value = f;
};

function scheduler() {
    while(nextNotetime < audioContext.currentTime + 0.01) {
        nextNotetime += (interval/1000);
        //console.log(counter + "-> " + (nextNotetime - audioContext.currentTime))
        //console.log(audioContext.currentTime)
        //nextNote.innerHTML = nextNotetime;
        playStepNotes(counter);
        socket.emit('step tick', { counter: counter, prev: prev } );
        playBass();
        updateCursor(counter, prev);
        if(counter < NUM_STEPS-1) {
          counter++;
          prev = counter - 1;
        } else {
            counter = 0;
            prev = 15;
        }
    }
    timerID = window.setTimeout(scheduler, 0);
}

startBtn.addEventListener('click', function() {
  if(audioContext.state === 'suspended'){
    audioContext.resume();
  };
  nextNotetime = audioContext.currentTime;
  counter = 0;
  prev = 15;
  socket.emit('play', { socketID: mySocketID });
  bassOsc.connect(audioContext.destination);
  this.classList.add("playing");
  playing = true;
  scheduler();
});

stopBtn.addEventListener('click', function() {
  console.log("------")
  socket.emit('stop', { socketID: mySocketID });
  document.querySelector("#play").classList.remove("playing");
  bassOsc.disconnect();
  clearTimeout(timerID);
  playing = false;
  updateCursor(-1, -1);
});

if(audioContext.state === 'suspended'){
  audioContext.resume();
};

