class Room {
    constructor(roomName, allocationMethod, numTracks, maxNumRounds)  {
        this.name = roomName;
        this.participants = Array(numTracks).join(".").split(".");
        this.seqID = "";
        this.maxNumRounds = maxNumRounds;
        this.allocationMethod = allocationMethod;
    }
    
    allocateAvailableParticipant(socketID, initials) {
        if(this.allocationMethod == "random") {
            var available = this.getAvailableParticipants();
            if(available.length <=0 ) return -1;
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

class AllRooms {
    constructor(maxNumRounds)  {
        this.rooms = Array();
        this.maxNumRounds = maxNumRounds;
    }
    addRoom(roomName, numTracks, allocationMethod) {
        var exists = this.findRoom(roomName);
        if(exists == -1) {
            let newRoom = new Room(roomName, allocationMethod, numTracks, this.maxNumRounds);
            this.rooms.push(newRoom);
        } else {
            this.rooms[exists].allocationMethod = allocationMethod || "sequential";
        }
    }

    findRoom(roomName) {
        for(var i=0; i<this.rooms.length; i++) {
            if(this.rooms[i].name == roomName)
                return i;
        }
        return -1;
    }

    setSeqID(roomName, seqID) {
        var roomId = this.findRoom(roomName);
        this.rooms[roomId].seqID = seqID;
    }

    clearSeqID(roomName) {
        var roomId = this.findRoom(roomName);
        this.rooms[roomId].seqID = "";
    }

    isReady(roomName) {
        var roomId = this.findRoom(roomName);
        if(roomId < 0) return false;
        if(this.rooms[roomId].seqID != "") return true;
        return false;
    }

    clearRoom(roomName) {
        var roomId = this.findRoom(roomName);
        this.rooms[roomId].seqID = "";
        this.rooms[roomId].name = "";
        this.rooms[roomId].releaseAllParticipants();
    }

    removeRoom(roomName) {
        var roomId = this.findRoom(roomName);
        if(roomId == -1) return -1;
        this.rooms.splice(roomId, 1);
    }

    allocateAvailableParticipant(roomName, socketID, initials) {
        var roomId = this.findRoom(roomName);
        if(roomId == -1) return -1;
        return(this.rooms[roomId].allocateAvailableParticipant(socketID, initials));
    }

    releaseParticipant(roomName, socketID) {
        var roomId = this.findRoom(roomName);
        if(roomId == -1) return -1;
        return(this.rooms[roomId].releaseParticipant(socketID));
    }

    getParticipantNumber(roomName, socketID) {
        var roomId = this.findRoom(roomName);
        if(roomId == -1) return -1;
        return(this.rooms[roomId].getParticipantNumber(socketID));
    }

    getParticipantInitials(roomName, socketID) {
        var roomId = this.findRoom(roomName);
        if(roomId == -1) return -1;
        return(this.rooms[roomId].getParticipantInitials(socketID));
    }

    participantStartCounting(roomName, socketID) {
        var roomId = this.findRoom(roomName);
        if(roomId == -1) return -1;
        this.rooms[roomId].participantStartCounting(socketID);
    }

    participantIncrementRounds(roomName, socketID) {
        var roomId = this.findRoom(roomName);
        if(roomId == -1) return -1;
        this.rooms[roomId].incrementParticipantRound(socketID);
    }

    getAllParticipants(roomName) {
        var roomId = this.findRoom(roomName);
        if(roomId == -1) return -1;
        return this.rooms[roomId].participants;
    }

    incrementAllCounters(roomName) {
        var roomId = this.findRoom(roomName);
        if(roomId == -1) return -1;
        return this.rooms[roomId].incrementAllCounters();
    }
}


if(typeof module !== 'undefined') {
    module.exports = {
        AllRooms : AllRooms
    }
}