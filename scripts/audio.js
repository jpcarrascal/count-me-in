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
    drums[i] = new Audio('sounds/' + drumSamples[i]);
}

function AudioPlayDrum(i, vel) {
    drums[7-i].currentTime = 0
    drums[7-i].volume = vel/127;
    drums[7-i].play();
}

/*var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioCtx = new AudioContext();
console.log(audioCtx.currentTime);*/

var nextNote = document.getElementById("debug");

window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext = new AudioContext();
var nextNotetime = audioContext.currentTime;
var clock = document.getElementById("debug1");
var nextNote = document.getElementById("debug2");
var startBtn = document.getElementById("play");
var stopBtn = document.getElementById("stop");
var timerID;

//setInterval(function(){ clock.innerHTML = audioContext.currentTime; }, 500);

function playSound(time) {
  
  var osc = audioContext.createOscillator();
  osc.connect(audioContext.destination);
  osc.frequency.value = 440;
  osc.start(time);
  osc.stop(time + 0.01);
  
};

function scheduler() {
    while(nextNotetime < audioContext.currentTime + 0.1) {
        nextNotetime += (interval/1000);
        nextNote.innerHTML = nextNotetime;
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
        playSound(nextNotetime);
    }

   timerID = window.setTimeout(scheduler, 50.0);
}

startBtn.addEventListener('click', function() {
    counter = 0;
    prev = 15;
    console.log(counter)
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