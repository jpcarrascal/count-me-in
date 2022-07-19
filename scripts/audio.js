window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext = new AudioContext();

var drums = new Array();
var synthOsc = new Array();
var synthVel = new Array();
var synthVel2 = new Array();
var synthMute = new Array();
var synthGain = new Array();
var trackMute = new Array();
var trackGain = new Array();

const mainMix = audioContext.createGain();

var trackCount = 0;
document.querySelectorAll(".drumSamples").forEach(elem => {
  var trackid = elem.getAttribute("track");
  drums[trackid] = elem;
  var track = audioContext.createMediaElementSource(elem);
  const velNode  = audioContext.createGain();
  trackMute[trackCount] = audioContext.createGain();
  trackGain[trackCount] = audioContext.createGain();
  velNode.gain.value = 1; 
  trackMute[trackCount].gain.value = 1; 
  trackGain[trackCount].gain.value = 1;
  track.connect(velNode);
  velNode.connect(trackMute[trackCount]);
  trackMute[trackCount].connect(trackGain[trackCount]);
  trackGain[trackCount].connect(mainMix);
  trackCount++;
});

for(var i=0; i<NUM_TRACKS-8; i++) {
  synthOsc[i] = audioContext.createOscillator();
  synthOsc[i].type = 'square';
  synthOsc[i].frequency.value = 0;
  synthVel[i]  = audioContext.createGain();
  synthVel2[i]  = audioContext.createGain();
  trackMute[trackCount+i] = audioContext.createGain();
  trackGain[trackCount+i] = audioContext.createGain();
  synthVel[i].gain.value = 0;
  synthVel2[i].gain.value = 0.2;
  trackMute[trackCount+i].gain.value = 1;
  trackGain[trackCount+i].gain.value = 1;
  synthOsc[i].connect(synthVel[i]);
  synthVel[i].connect(synthVel2[i]);
  synthVel2[i].connect(trackMute[trackCount+i]);
  trackMute[trackCount+i].connect(trackGain[trackCount+i]);
  synthOsc[i].start(audioContext.currentTime);
}

var mainMute = audioContext.createGain();
mainMix.connect(mainMute);
mainMute.gain.value = 1;
mainMute.connect(audioContext.destination);

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
var playButton = document.getElementById("play");
var stopButton = document.getElementById("stop");
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

playButton.addEventListener('click', function() {
  if(!playing) {
    if(audioContext.state === 'suspended'){
      audioContext.resume();
    };
    nextNotetime = audioContext.currentTime;
    counter = 0;
    prev = 15;
    socket.emit('play', { socketID: mySocketID });
    for(var i=NUM_DRUMS; i<NUM_TRACKS; i++) {
      trackGain[i].connect(mainMix);
    }
    this.classList.add("playing");
    playing = true;
    // Only start scheduler if clock is internal
    if(MIDIinIndex == 0 || MIDIinIndex == null) scheduler();
  }
});

stopButton.addEventListener('click', function() {
  if(playing) {
    socket.emit('stop', { socketID: mySocketID });
    document.querySelector("#play").classList.remove("playing");
    for(var i=NUM_DRUMS; i<NUM_TRACKS; i++) {
      trackGain[i].disconnect();
    }
    clearTimeout(timerID);
    updateCursor(-1, -1);
    playing = false;
  }
});

if(audioContext.state === 'suspended'){
  audioContext.resume();
};

