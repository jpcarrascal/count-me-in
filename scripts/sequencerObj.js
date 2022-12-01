class StepSequencer {
    constructor(soundPreset, nSteps)  {
        this.nTracks = soundPreset.length;
        this.nSteps = nSteps;
        this.tracks = Array();
        for(var i=0; i<this.nTracks; i++) {
            var notes = new Array();
            for(var j=0; j<nSteps; j++) {
                if(soundPreset[i].type == "sample")
                    notes.push({note: soundPreset[i].params.note, vel: 0});
                else
                    notes.push({note: 0, vel: 0});
            }
            var track = {name: "", initials: "", notes: notes, type: soundPreset[i].type};
            this.tracks.push(track);
        }
    }
    
    setTrackName(i, name) {
        this.tracks[i].name = name;
    }

    setTrackInitials(i, initials) {
        this.tracks[i].initials = initials;
    }

    getStepNotes(step) {
        var stepNotes = new Array();
        for(var i=0; i<this.nTracks; i++) {
            stepNotes.push(this.tracks[i].notes[step]);
        }
        return stepNotes;
    }

    clearAll() {
        for(var i=0; i<nTracks; i++) {
            var notes = new Array();
            for(var j=0; j<this.nSteps; j++) {
                notes.push({note: this.noteValues[i], vel: 0});
            }
            var track = {name: "", initials: "", notes: notes};
            this.tracks.push(track);
        }
    }
    
    clearTrack(i) {
        for(var j=0; j<this.nSteps; j++) {
            this.tracks[i].notes[j].vel = 0;
        }
    }
}

if(typeof module !== 'undefined') {
module.exports = {
    DrumSequencer : StepSequencer
  }
}