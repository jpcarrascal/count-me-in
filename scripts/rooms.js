class Room {
    constructor(roomName, allocationMethod)  {
        this.name = roomName;
        this.tracks = ["", "", "", "", "", "", "", ""];
        this.seqID = "";
        this.allocationMethod = allocationMethod;
    }
    
    allocateAvailableTrack(socketID) {
        if(this.allocationMethod == "random") {
            var available = this.getAvailableTracks();
            var index = Math.floor(Math.random()*available.length);
            this.tracks[index] = socketID;
            console.log("Random: " + index);
            return available[index];
        } else {
            for(var i=0; i<this.tracks.length; i++) {
                if(this.tracks[i] == "") {
                    this.tracks[i] = socketID;
                    return(i);
                }
            }
        }
        return -1;
    }

    getAvailableTracks() {
        var available = new Array();
        for(var i=0; i<this.tracks.length; i++) {
            if(this.tracks[i] == "") {
                available.push(i);
            }
        }
        return available;
    }
    
    releaseTrack(socketID) {
        for(var i=0; i<this.tracks.length; i++) {
            if(this.tracks[i] == socketID)
                this.tracks[i] = "";
        }
    }
    
    getTrackNumber(socketID) {
        for(var i=0; i<this.tracks.length; i++) {
            if(this.tracks[i] == socketID) {
                return(i);
            }
        }
        return -1;
    }

    releaseAllTracks() {
        for(var i=0; i<this.tracks.length; i++) {
            this.tracks[i] == "";
        }
    }
}

class AllRooms {
    constructor()  {
        this.rooms = Array();
    }
    addRoom(roomName, allocationMethod) {
        var exists = this.findRoom(roomName);
        if(exists == -1) {
            let newRoom = new Room(roomName, allocationMethod);
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
        if(this.rooms[roomId].seqID != "") return true;
        return false;
    }

    clearRoom(roomName) {
        var roomId = this.findRoom(roomName);
        this.rooms[roomId].seqID = "";
        this.rooms[roomId].releaseAllTracks();
    }

    removeRoom(roomName) {
        var roomId = this.findRoom(roomName);
        if(roomId >=0) this.rooms.splice(roomId, 1);
        else throw 'Room not found!';
    }

    allocateAvailableTrack(roomName, socketID) {
        var roomId = this.findRoom(roomName);
        if(roomId >=0) return(this.rooms[roomId].allocateAvailableTrack(socketID));
        else throw 'Room not found!';
    }

    releaseTrack(roomName, socketID) {
        var roomId = this.findRoom(roomName);
        if(roomId >=0) return(this.rooms[roomId].releaseTrack(socketID));
        else throw 'Room not found!';
    }

    getTrackNumber(roomName, socketID) {
        var roomId = this.findRoom(roomName);
        if(roomId >=0) return(this.rooms[roomId].getTrackNumber(socketID));
        else throw 'Room not found!';
    }
}

module.exports = {
    Room : Room,
    AllRooms : AllRooms
  }