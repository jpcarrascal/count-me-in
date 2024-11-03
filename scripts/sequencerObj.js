class StepSequencer {
    constructor(nTracks, nSteps)  {
        this.nTracks = nTracks;
        this.nSteps = nSteps;
        this.tracks = Array();
        for(var i=0; i<this.nTracks; i++) {
            var notes = new Array();
            for(var j=0; j<nSteps; j++) {
                notes.push({note: -1, vel: -1});
            }
            var track = {name: "", initials: "", notes: notes, type: ""};
            this.tracks.push(track);
        }
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
    StepSequencer : StepSequencer
  }
}