window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext = new AudioContext();

var drums = new Array();
const mainMix = audioContext.createGain();

document.querySelectorAll(".drumSamples").forEach(elem => {
  var trackid = elem.getAttribute("track");
  drums[trackid] = elem;
  var track = audioContext.createMediaElementSource(elem);
  const gainNode = audioContext.createGain();
  track.connect(gainNode);
  gainNode.gain.value = 1;
  gainNode.connect(mainMix);
});

mainMix.connect(audioContext.destination);

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
    /* bass experiment: */
    if(i==8) {
      bassOsc.frequency.value = noteFrequencies[vel];
      if(vel == 0) bassGain.gain.value = 0;
      else bassGain.gain.value = 0.01;
    } else {
      drums[i].currentTime = 0
      drums[i].volume = vel/127;
      drums[i].play();
    }
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
bassOsc.type = 'square';
bassOsc.frequency.value = 0;
var bassGain = audioContext.createGain();
bassOsc.connect(bassGain);
bassGain.gain.value = 0;
bassOsc.start(audioContext.currentTime);

function playBass(f) {
  if (f) bassOsc.frequency.value = f;
};

function scheduler() {
    while(nextNotetime < audioContext.currentTime + 0.01) {
        nextNotetime += (interval/1000);
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
  bassGain.connect(audioContext.destination);
  this.classList.add("playing");
  playing = true;
  scheduler();
});

stopBtn.addEventListener('click', function() {
  socket.emit('stop', { socketID: mySocketID });
  document.querySelector("#play").classList.remove("playing");
  bassGain.disconnect();
  clearTimeout(timerID);
  updateCursor(-1, -1);
  playing = false;
});

if(audioContext.state === 'suspended'){
  audioContext.resume();
};

