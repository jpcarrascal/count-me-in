var MIDIout = null;
var MIDIin = null;
var extClock = false;
var midiPlaying = false;
var tickCounter = -1;
var beatCounter = -1;
var measCounter = -1;
var MIDIoutIndex = 0;
var MIDIinIndex = 0;
var MIDIch = 0;
let indicator = document.getElementById("ext-clock");

if (navigator.requestMIDIAccess) {
    console.log('Browser supports MIDI. Yay!');
    navigator.requestMIDIAccess().then(successTMP, failure);
}

function successTMP(midi) {
    connectMIDI(midi);

    midi.onstatechange = (event) => {
        console.log("Scanning devices...")
        connectMIDI(midi);
    };
}

function connectMIDI(midi) {
    var MIDIinIndex = 154015310; // WIDI Jack
    console.log(midi.inputs.forEach(function(port, key) {
        if(port.name == "WIDI Jack Bluetooth") {
            MIDIinIndex = key;
        }
    }));
    //var MIDIinIndex = 1576374086; // IAC Driver Bus 2: Notes
    console.log("WIDI Jack MIDIinIndex: " + MIDIinIndex);
    try {
        MIDIin = midi.inputs.get(MIDIinIndex);
        MIDIin.onmidimessage = processMIDIinTMP;
        console.log("WIDI Jack connected! YAY!");
    } catch(error) {
        console.log("WIDI Jack not connected!");
        console.log(error)
    }
}

function processMIDIinTMP(midiMsg) {
    if(isCC(midiMsg.data[0])) { //&& !infoOnOff) {  // Is a controller
        switch (midiMsg.data[1]) {
            /*
            case 70: // Play
                if(midiMsg.data[2] == 0) {
                    veilPlay();
                } 
                break;
                
            case 71: // Stop
                if(midiMsg.data[2] == 0) {
                    veilStop();
                }
                break;
            case 73: // Hide/show QR
                if(midiMsg.data[2] > 0) {
                    hideAndPLay();
                }
                break;
            */
            default:
                break;
        }
    }
}

function veilPlay() {
    console.log("Pedalboard play...");
    document.getElementById("play").click();
    mainMix.gain.linearRampToValueAtTime(1, audioContext.currentTime + 2);
    document.getElementById("backdrop").style.top = "-100vw";
}

function veilStop() {
    updateCursor(-1, -1);
    console.log("Pedalboard stop...");
    mainMix.gain.linearRampToValueAtTime(0, audioContext.currentTime + 2);
    document.getElementById("backdrop").style.top = 0;
    setTimeout(function() {
        document.getElementById("stop").click();
      }, 2000);
}

function isNoteOn(msg) {
    return (msg >= 0x90 && msg <= 0x9F);
}

function isPC(msg) {
    return (msg >= 0xC0 && msg <= 0xCF);
}

function isCC(msg) {
    return (msg >= 0xB0 && msg <= 0xBF);
}

function success(midi) {
    MIDIoutIndex = getCookie("MIDIout");
    MIDIinIndex = getCookie("MIDIin");
    MIDIch = getCookie("MIDIch");
    if(MIDIoutIndex != 0) {
        MIDIout = midi.outputs.get(MIDIoutIndex);
    } else {
        console.log("Using internal sounds.")
    }

    if(MIDIinIndex != 0 && MIDIinIndex != null) {
        extClock = true;
        MIDIin = midi.inputs.get(MIDIinIndex);
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
    // 0xB0 & 0x07 = CC, channel 8.
    // Responding to altStartMessage regardless of channels
    var altStartMessage = (midiMsg.data[0] & 240) == 176 &&
                         midiMsg.data[1] == 16 &&
                         midiMsg.data[2] > 63;
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
    } else if((midiMsg.data[0] & 240) == 176 && (midiMsg.data[0] & 15) == MIDIch) { //CC, right channel
        var track = -1;
        var value = -1;
        if(midiMsg.data[1] >= 20 && midiMsg.data[1] <= 35) {
            track = midiMsg.data[1] - 20;
            value = midiMsg.data[2] > 63? true : false;
            socket.emit('track mute', { track: track,  value: value} );
        } else if(midiMsg.data[1] >= 40 && midiMsg.data[1] <= 55) {
            track = midiMsg.data[1] - 20;
            value = midiMsg.data[2] > 63? true : false;
            socket.emit('track solo', { track: track,  value: value} );
        } else if(midiMsg.data[1] >= 60 && midiMsg.data[1] <= 75) {
            track = midiMsg.data[1] - 20;
            value = midiMsg.data[2];
            socket.emit('track volume', { track: track,  value: value} );
        } else if(midiMsg.data[1] == 18) {
            let seq = document.getElementById("sequencer");
            if(midiMsg.data[2] > 63) {
                seq.classList.add("invisible");
                mainMute.gain.value = 0;
            } else {
                seq.classList.remove("invisible");
                mainMute.gain.value = 1;
            }
            socket.emit('hide toggle', { value: midiMsg.data[2] } );
        }
    }
     else {
        console.log(midiMsg.data)
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

