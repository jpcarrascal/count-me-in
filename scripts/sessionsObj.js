class Session {
    constructor(sessionName, numTracks, allocationMethod, maxNumRounds)  {
        this.name = sessionName;
        this.participants = Array(numTracks).join(".").split(".");
        this.seqID = "";
        this.maxNumRounds = maxNumRounds;
        this.allocationMethod = allocationMethod;
        this.playing = false;
        this.attributes = Object();
    }

    allocateAvailableParticipant(socketID, initials) {
        if(this.allocationMethod == "random") {
            var available = this.getAvailableParticipants();
            var randomIndex = Math.floor(Math.random()*available.length);
            var index = available[randomIndex];
            this.participants[index] = new Participant(socketID, initials);
            return index;
        } else {
            for(var i=0; i<this.participants.length; i++) {
                if(this.participants[i] == "") {
                    this.participants[i] = new Participant(socketID, initials);
                    return(i);
                }
            }
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
            if(this.participants[i].socketID == socketID)
                this.participants[i] = "";
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

    setAttribute(k, v) {
        this.attributes[k] = v;
    }

    getAttribute(k) {
        return this.attributes[k];
    }
}

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

class AllSessions {
    constructor(numTracks)  {
        this.sessions = Array();
    }
    addSession(sessionName, numTracks, allocationMethod, maxNumRounds) {
        var exists = this.findSession(sessionName);
        if(exists == -1) {
            let newSession = new Session(sessionName, numTracks, allocationMethod, maxNumRounds);
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

    getSeqID(sessionName, seqID) {
        var sessionId = this.findSession(sessionName);
        if(sessionId == -1) return -1;
        var seqID = this.sessions[sessionId].seqID;
        return seqID;
    }

    setSeqID(sessionName, seqID) {
        var sessionId = this.findSession(sessionName);
        this.sessions[sessionId].seqID = seqID;
    }

    clearSeqID(sessionName) {
        var sessionId = this.findSession(sessionName);
        this.sessions[sessionId].seqID = "";
    }

    isReady(sessionName) {
        var sessionId = this.findSession(sessionName);
        if(sessionId < 0) return false;
        if(this.sessions[sessionId].seqID != "") return true;
        return false;
    }

    play(sessionName) {
        var sessionId = this.findSession(sessionName);
        if(sessionId < 0) return false;
        this.sessions[sessionId].playing = true;
    }

    stop(sessionName) {
        var sessionId = this.findSession(sessionName);
        if(sessionId < 0) return false;
        this.sessions[sessionId].playing = false;
    }

    isPlaying(sessionName) {
        var sessionId = this.findSession(sessionName);
        if(sessionId < 0) return false;
        return this.sessions[sessionId].playing;
    }

    clearSession(sessionName) {
        var sessionId = this.findSession(sessionName);
        this.sessions[sessionId].seqID = "";
        this.sessions[sessionId].name = "";
        this.sessions[sessionId].releaseAllParticipants();
    }

    removeSession(sessionName) {
        var sessionId = this.findSession(sessionName);
        if(sessionId == -1) return -1;
        this.sessions.splice(sessionId, 1);
    }

    allocateAvailableParticipant(sessionName, socketID, initials) {
        var sessionId = this.findSession(sessionName);
        if(sessionId == -1) return -1;
        return(this.sessions[sessionId].allocateAvailableParticipant(socketID, initials));
    }

    releaseParticipant(sessionName, socketID) {
        var sessionId = this.findSession(sessionName);
        if(sessionId == -1) return -1;
        return(this.sessions[sessionId].releaseParticipant(socketID));
    }

    getParticipantNumber(sessionName, socketID) {
        var sessionId = this.findSession(sessionName);
        if(sessionId == -1) return -1;
        return(this.sessions[sessionId].getParticipantNumber(socketID));
    }

    getParticipantInitials(sessionName, socketID) {
        var sessionId = this.findSession(sessionName);
        if(sessionId == -1) return -1;
        return(this.sessions[sessionId].getParticipantInitials(socketID));
    }

    participantStartCounting(sessionName, socketID) {
        var sessionId = this.findSession(sessionName);
        if(sessionId == -1) return -1;
        this.sessions[sessionId].participantStartCounting(socketID);
    }

    participantIncrementRounds(sessionName, socketID) {
        var sessionId = this.findSession(sessionName);
        if(sessionId == -1) return -1;
        this.sessions[sessionId].incrementParticipantRound(socketID);
    }

    getAllParticipants(sessionName) {
        var sessionId = this.findSession(sessionName);
        if(sessionId == -1) return -1;
        return this.sessions[sessionId].participants;
    }

    incrementAllCounters(sessionName) {
        var sessionId = this.findSession(sessionName);
        if(sessionId == -1) return -1;
        return this.sessions[sessionId].incrementAllCounters();
    }

    setAttribute(sessionName, k, v) {
        var sessionId = this.findSession(sessionName);
        if(sessionId == -1) return -1;
        return this.sessions[sessionId].setAttribute(k, v);
    }

    getAttribute(sessionName, k) {
        var sessionId = this.findSession(sessionName);
        if(sessionId == -1) return -1;
        return this.sessions[sessionId].getAttribute(k);
    }
}


if(typeof module !== 'undefined') {
    module.exports = {
        AllSessions : AllSessions
    }
}