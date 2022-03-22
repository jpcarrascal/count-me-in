var MIDIout = null;
var MIDIin = null;
var midiPlaying = false;
var tickCounter = -1;
var beatCounter = -1;
var measCounter = -1;
var MIDIoutIndex = 0;
var MIDIinIndex = 0;

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
        MIDIin = midi.inputs.get(MIDIinIndex);
        console.log("MIDI clock in: " + MIDIin.name);
        MIDIin.onmidimessage = processMIDIclock;
    } else {
        console.log("Using internal clock.");
    }
}

function processMIDIclock(midiMsg) {
    if(midiMsg.data[0] == 250) { // 0xFA Start (Sys Realtime)
        midiPlaying = true;
        tickCounter = 0;
        beatCounter = 0;
        measCounter = 0;
        startBtn.click();
    }
    if(midiMsg.data[0] == 252) { // 0xFC Stop (Sys Realtime)
        midiPlaying = false;
        tickCounter = -1;
        beatCounter = -1;
        measCounter = -1;
        stopBtn.click();
    }
    if(midiPlaying) {
        if(midiMsg.data[0] == 248) { // 0xF8 Timing Clock (Sys Realtime)
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
            }
        }
    }
}

function failure(){ console.log("MIDI not supported :(")};


function MIDIplayNote (note, vel, out) {
    out.send([NOTE_ON, note, vel]);
    setTimeout(out.send([NOTE_OFF, note, 0x00]), NOTE_DURATION);
}

