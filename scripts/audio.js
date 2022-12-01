window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext = new AudioContext();

//var drums = new Array();
var soundGenerators = new Array();
var synthOsc = new Array();
var synthVel = new Array();
var synthVel2 = new Array();
var synthMute = new Array();
var synthGain = new Array();
var trackMute = new Array();
var trackGain = new Array();
var num_tracks = 0;

const mainMix = audioContext.createGain();

// Load sound preset:
fetch(soundsJson)
    .then((response) => response.json())
    .then((soundPreset) => {
      num_tracks = soundPreset.length;
      stepSequencer = new StepSequencer(soundPreset, NUM_STEPS);
      var o = 0;
      var trackCount = 0;
      for(var i=0; i<num_tracks; i++) {
        var soundGenerator = {generator: null, type: soundPreset[i].type};
        if(soundPreset[i].type == "sampler") {
          var sound      = document.createElement('audio');
          sound.preload  = 'auto';
          sound.id       = soundPreset[i].sound;
          sound.src      = soundFolder + "sounds/" + soundPreset[i].sound;
          sound.setAttribute("track", i);
          sound.classList.add("drumSamples");
          //drums[i] = sound;
          soundGenerator.generator = sound;
          var track = audioContext.createMediaElementSource(sound);
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
          document.getElementById('sound-set').appendChild(sound);
        } else {
          soundGenerator.generator = audioContext.createOscillator();
          soundGenerator.generator.type = soundPreset[i].params.waveform;
          soundGenerator.generator.frequency.value = 0;
          soundGenerator.generator.synthVel  = audioContext.createGain();
          soundGenerator.generator.synthVel2  = audioContext.createGain();
          trackMute[trackCount] = audioContext.createGain();
          trackGain[trackCount] = audioContext.createGain();
          soundGenerator.generator.synthVel.gain.value = 0;
          soundGenerator.generator.synthVel2.gain.value = 0.2;
          trackMute[trackCount].gain.value = 1;
          trackGain[trackCount].gain.value = 1;
          soundGenerator.generator.connect(soundGenerator.generator.synthVel);
          soundGenerator.generator.synthVel.connect(soundGenerator.generator.synthVel2);
          soundGenerator.generator.synthVel2.connect(trackMute[trackCount]);
          trackMute[trackCount].connect(trackGain[trackCount]);
          soundGenerator.generator.start(audioContext.currentTime);
        }
        soundGenerators.push(soundGenerator);
        trackCount++;
      }
      // Create tracks in sequencer
      for(var i=num_tracks-1; i>=0; i--) {
        var tr = createTrack(i, soundPreset[i]);
        matrix.appendChild(tr);
      }
    });

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
    if(soundGenerators[i].type == "sampler") {
      if(vel > 0) {
        soundGenerators[i].generator.currentTime = 0
        soundGenerators[i].generator.volume = vel/127;
        soundGenerators[i].generator.play();
      }
    } else { // It's a synth
      soundGenerators[i].generator.frequency.setValueAtTime(20, audioContext.currentTime);
      if(noteFrequencies[note] === undefined) noteFrequencies[note] = 0;
      soundGenerators[i].generator.frequency.linearRampToValueAtTime(noteFrequencies[note], audioContext.currentTime + .03);
      soundGenerators[i].generator.synthVel.gain.value = vel/127;
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
    for(var i=0; i<num_tracks; i++) {
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
    for(var i=0; i<num_tracks; i++) {
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

