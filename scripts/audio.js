window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext = new AudioContext();
 
var drumSamples = ["/sounds/BD.WAV",
            "/sounds/SD.WAV",
            "/sounds/CP.WAV",
            "/sounds/HC.WAV",
            "/sounds/LC.WAV",
            "/sounds/LT.WAV",
            "/sounds/CH.WAV",
            "/sounds/OH.WAV"];
/*
            "CY.WAV",
            "HT.WAV",
            "CB.WAV",
            "MT.WAV",
*/
var drums = new Array();
const mainMix = audioContext.createGain();


bufferLoader = new BufferLoader(audioContext, drumSamples);

bufferLoader.load();

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
    drums[i] = audioContext.createBufferSource();
    drums[i].buffer = bufferLoader.bufferList[i];
    var gainNode = audioContext.createGain();
    drums[i].connect(gainNode);
    gainNode.gain.value = vel/127;
    gainNode.connect(mainMix);
    drums[i].start(0);
    console.log(drums[i]);
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
  updateCursor(-1, -1);
  playing = false;
});

if(audioContext.state === 'suspended'){
  audioContext.resume();
};

