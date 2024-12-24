class Participant {
    constructor(socketID, initials)  {
        this.socketID = socketID;
        this.initials = initials;
        this.rounds = 0;
        this.countingRounds = false;
    }

    startCountingRounds() {
        this.countingRounds = true;
    }

    incrementRounds() {
        if(this.countingRounds)
            this.rounds++;
    }

    getRounds() {
        return this.rounds;
    }
}

class Sequencer {
    constructor(nTracks, nSteps)  {
        this.nTracks = nTracks;
        this.nSteps = nSteps;
        this.tracks = Array();
        this.attributes = Object();
        for(var i=0; i<this.nTracks; i++) {
            var notes = new Array();
            for(var j=0; j<nSteps; j++) {
                notes.push({note: -1, vel: -1});
            }
            var track = {initials: "", notes: notes, type: ""};
            this.tracks.push(track);
        }
    }

    setTrackInitials(track, initials) {
        this.tracks[track].initials = initials;
    }

    clearTrackInitials(track) {
        if(this.tracks[track] != undefined)
            this.tracks[track].initials = "";
    }

    updateStep(track, event) {
        const {step, note, value} = event;
        this.tracks[track].notes[step].note = note;
        this.tracks[track].notes[step].vel = value;
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
    
    clearTrack(track) {
        for(var i=0; i<this.nSteps; i++) {
            this.tracks[track].notes[i].vel = 0;
        }
    }
}

class Session {
    constructor(sessionName, numTracks, numSteps, allocationMethod, maxNumRounds)  {
        this.name = sessionName;
        this.participants = Array(numTracks).join(".").split(".");
        this.sequencer = new Sequencer(numTracks, numSteps);
        this.seqID = "";
        this.maxNumRounds = maxNumRounds;
        this.allocationMethod = allocationMethod;
        this.playing = false;
        this.attributes = Object();
    }

    allocateAvailableParticipant(socketID, initials) {
        if(this.allocationMethod.toLowerCase().includes("asc")) {
            for(var i=0; i<this.participants.length; i++) {
                if(this.participants[i] == "") {
                    this.participants[i] = new Participant(socketID, initials);
                    this.sequencer.setTrackInitials(i, initials);
                    return(i);
                }
            }
        } else if(this.allocationMethod.toLowerCase().includes("desc")) {
            for(var i=this.participants.length-1; i>=0; i--) {
                if(this.participants[i] == "") {
                    this.participants[i] = new Participant(socketID, initials);
                    this.sequencer.setTrackInitials(i, initials);
                    return(i);
                }
            }
        } else {
            var available = this.getAvailableParticipants();
            var randomIndex = Math.floor(Math.random()*available.length);
            var index = available[randomIndex];
            this.participants[index] = new Participant(socketID, initials);
            return index;
        }
        return -1;
    }

    getAvailableParticipants() {
        var available = new Array();
        for(var i=0; i<this.participants.length; i++) {
            if(this.participants[i] == "") {
                available.push(i);
            }
        }
        return available;
    }
    
    releaseParticipant(socketID) {
        for(var i=0; i<this.participants.length; i++) {
            if(this.participants[i].socketID == socketID) {
                this.participants[i] = "";
                this.sequencer.clearTrackInitials(i);
            }
        }
    }
    
    getParticipantNumber(socketID) {
        for(var i=0; i<this.participants.length; i++) {
            if(this.participants[i].socketID == socketID) {
                return(i);
            }
        }
        return -1;
    }

    getParticipantInitials(socketID) {
        for(var i=0; i<this.participants.length; i++) {
            if(this.participants[i].socketID == socketID) {
                return(this.participants[i].initials);
            }
        }
        return -1;
    }

    releaseAllParticipants() {
        for(var i=0; i<this.participants.length; i++) {
            this.participants[i] == "";
            this.sequencer.clearTrackInitials(i);
        }
    }

    incrementAllCounters() {
        var expired = new Array();
        for(var i=0; i<this.participants.length; i++) {
            if(this.participants[i] != "") {
                this.participants[i].incrementRounds();
                if(this.participants[i].rounds > this.maxNumRounds)
                    expired.push(this.participants[i]);
            }
        }
        return expired;
    }

    participantIncrementRounds(socketID) {
        var i = this.getParticipantNumber(socketID);
        this.participants[i].incrementParticipantRound();
    }

    participantStartCounting(socketID) {
        var i = this.getParticipantNumber(socketID);
        if(i>=0)
            this.participants[i].startCountingRounds();
    }

    /////////////

    seqUpdateStep(track, event) {
        this.sequencer.updateStep(track, event);
    }

    seqGetStepNotes(step) {
        return this.sequencer.getStepNotes(step);
    }

    seqClearAllTracks() {
        this.sequencer.clearAll();
    }
    
    seqClearTrack(track) {
        this.sequencer.clearTrack(track);
    }
    
    ////////////

    getSeqID(seqID) {
        return this.seqID;
    }

    setSeqID(seqID) {
        this.seqID = seqID;
    }

    clearSeqID() {
        this.seqID = "";
    }

    isReady(sessionName) {
        if(this.seqID != "") return true;
        return false;
    }

    play() {
        this.playing = true;
    }

    stop() {
        var sessionId = this.findSession(sessionName);
        if(sessionId < 0) return false;
        this.playing = false;
    }

    isPlaying() {
        return this.playing;
    }

    clearSession() {
        this.seqID = "";
        this.name = "";
        this.releaseAllParticipants();
    }

    ///////////

    setAttribute(k, v) {
        this.attributes[k] = v;
    }

    getAttribute(k) {
        return this.attributes[k];
    }
}

class AllSessions {
    constructor(numTracks)  {
        this.sessions = Array();
        this.sessions[-1] = new Session("default", numTracks, 16, "sequential", 100);
    }

    addSession(sessionName, numTracks, numSteps, allocationMethod, maxNumRounds) {
        var exists = this.findSession(sessionName);
        if(exists == -1) {
            let newSession = new Session(sessionName, numTracks, numSteps, allocationMethod, maxNumRounds);
            this.sessions.push(newSession);
        } else {
            this.sessions[exists].allocationMethod = allocationMethod || "sequential";
        }
    }

    findSession(sessionName) {
        for(var i=0; i<this.sessions.length; i++) {
            if(this.sessions[i].name == sessionName)
                return i;
        }
        return -1;
    }

    select(sessionName) {
        var sessionId = this.findSession(sessionName);
        //if(sessionId == -1) return -1;
        return this.sessions[sessionId];
    }

    removeSession(sessionName) {
        var sessionId = this.findSession(sessionName);
        if(sessionId == -1) return -1;
        this.sessions.splice(sessionId, 1);
    }
}


if(typeof module !== 'undefined') {
    module.exports = {
        AllSessions : AllSessions
    }
}