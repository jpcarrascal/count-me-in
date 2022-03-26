window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext = new AudioContext();

var drums = new Array();
var synthOsc = new Array();
var synthGain = new Array();
var synthVel = new Array();
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

for(var i=0; i<NUM_TRACKS-8; i++) {
  synthOsc[i] = audioContext.createOscillator();
  synthOsc[i].type = 'square';
  synthOsc[i].frequency.value = 0;
  synthGain[i] = audioContext.createGain();
  synthVel[i] = audioContext.createGain();
  synthOsc[i].connect(synthVel[i]);
  synthVel[i].connect(synthGain[i]);
  synthVel[i].gain.value = 0;
  synthGain[i].gain.value = 0.1;
  synthOsc[i].start(audioContext.currentTime);
}

mainMix.connect(audioContext.destination);

function playStepNotes(counter) {
  var notesToPlay = stepSequencer.getStepNotes(counter);
  for(var i=0; i<stepSequencer.nTracks; i++) {
    var value = notesToPlay[i].vel;
    var note = notesToPlay[i].note;
    if(MIDIout) MIDIplayNote(note, value, MIDIout);
    else audioPlayDrum(i, note, value);
  }
}

function audioPlayDrum(i, note, vel) {
    /* bass experiment: */
    if(i>7) {
      //synthOsc[i-8].frequency.value = noteFrequencies[note];
      synthOsc[i-8].frequency.setValueAtTime(20, audioContext.currentTime);
      synthOsc[i-8].frequency.linearRampToValueAtTime(noteFrequencies[note], audioContext.currentTime + .03);
      synthVel[i-8].gain.value = vel/127;
    } else {
      if(vel > 0) {
        drums[i].currentTime = 0
        drums[i].volume = vel/127;
        drums[i].play();
      }
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

/*
function playBass(i, f, vel) {
  synthOsc[i].frequency.value = f;
  synthVel[i].gain.value = vel;
};
*/

function scheduler() {
    while(nextNotetime < audioContext.currentTime + 0.01) {
        nextNotetime += (interval/1000);
        tick();
    }
    timerID = window.setTimeout(scheduler, 0);
}

function tick() {
  playStepNotes(counter);
  socket.emit('step tick', { counter: counter, prev: prev } );
  updateCursor(counter, prev);
  if(counter < NUM_STEPS-1) {
    counter++;
    prev = counter - 1;
  } else {
      counter = 0;
      prev = 15;
  }
}

startBtn.addEventListener('click', function() {
  if(!playing) {
    if(audioContext.state === 'suspended'){
      audioContext.resume();
    };
    nextNotetime = audioContext.currentTime;
    counter = 0;
    prev = 15;
    socket.emit('play', { socketID: mySocketID });
    for(var i=0; i<synthGain.length; i++) {
      synthGain[i].connect(audioContext.destination);
    }
    this.classList.add("playing");
    playing = true;
    // Only start scheduler if clock is internal
    if(MIDIinIndex == 0) scheduler();
  }
});

stopBtn.addEventListener('click', function() {
  if(playing) {
    socket.emit('stop', { socketID: mySocketID });
    document.querySelector("#play").classList.remove("playing");
    for(var i=0; i<synthGain.length; i++) {
      synthGain[i].disconnect();
    }
    clearTimeout(timerID);
    updateCursor(-1, -1);
    playing = false;
  }
});

if(audioContext.state === 'suspended'){
  audioContext.resume();
};

