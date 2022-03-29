var MIDIout = null;
var MIDIin = null;
var extClock = false;
var midiPlaying = false;
var tickCounter = -1;
var beatCounter = -1;
var measCounter = -1;
var MIDIoutIndex = 0;
var MIDIinIndex = 0;
let indicator = document.getElementById("ext-clock");

if (navigator.requestMIDIAccess) {
    console.log('Browser supports MIDI. Yay!');
    navigator.requestMIDIAccess().then(success, failure);
}

function success(midi) {
    MIDIoutIndex = getCookie("MIDIout");
    MIDIinIndex = getCookie("MIDIin");
    if(MIDIoutIndex != 0) {
        MIDIout = midi.outputs.get(MIDIoutIndex);
        console.log("MIDI out: " + MIDIout.name);
    } else {
        console.log("Using internal sounds.")
    }

    if(MIDIinIndex != 0) {
        extClock = true;
        MIDIin = midi.inputs.get(MIDIinIndex);
        console.log("MIDI clock in: " + MIDIin.name);
        MIDIin.onmidimessage = processMIDIin;
        document.getElementById("ext-clock-indicator").style.display = "inline";
        document.getElementById("ext-tempo").style.display = "inline";
        document.getElementById("bpm").style.display = "none";
        document.getElementById("play").style.display = "none";
        document.getElementById("stop").style.display = "none";
    } else {
        console.log("Using internal clock.");
    }
}

var tempoMeasureSw = true;
var startTime = 0;
var endTime   = 0;
function processMIDIin(midiMsg) {
    // altStartMessage: used to sync when playback has already started
    // in clock source device
    // 0xB0 & 7 = CC, channel 8.
    var altStartMessage = midiMsg.data[0] == 183 &&
                         midiMsg.data[1] == 16 &&
                         midiMsg.data[2] == 127;
    if(midiMsg.data[0] == 250 || altStartMessage) { // 0xFA Start (Sys Realtime)
        midiPlaying = true;
        tickCounter = 0;
        beatCounter = 0;
        measCounter = 0;
        startBtn.click();
        indicator.style.color = "lime";
    } else if(midiMsg.data[0] == 252) { // 0xFC Stop (Sys Realtime)
        midiPlaying = false;
        tickCounter = -1;
        beatCounter = -1;
        measCounter = -1;
        stopBtn.click();
        indicator.style.color = "white";
    } else if(midiMsg.data[0] == 248) { // 0xF8 Timing Clock (Sys Realtime)
        if(midiPlaying) {
            if(tickCounter == 0) {
                tick();
            }
            tickCounter++;
            if(tickCounter == 6) {
                beatCounter++;
                if(beatCounter == 4) {
                    measCounter++;
                    beatCounter = 0;
                }
                tickCounter = 0;
                // Measure tempo:
                if(tempoMeasureSw) {
                    startTime = performance.now();
                    tempoMeasureSw = false;
                } else {
                    var endTime = performance.now();
                    calculateTempo(endTime - startTime);
                    tempoMeasureSw = true;
                }
            }
        }
    } else {
        //console.log(midiMsg.data)
    }
}

function failure(){ console.log("MIDI not supported :(")};

function calculateTempo(time) {
    let tempoElem = document.getElementById("ext-tempo");
    let tempo = Math.round(60000/(time*4));
    tempoElem.innerText = tempo;
}

function MIDIplayNote (note, vel, out) {
    out.send([NOTE_ON, note, vel]);
    setTimeout(out.send([NOTE_OFF, note, 0x00]), NOTE_DURATION);
}

