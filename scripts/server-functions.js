class Room {
    constructor(roomName)  {
        this.name = roomName;
        this.tracks = ["", "", "", "", "", "", "", ""];
        this.seqID = "";
    }
    
    allocateAvailableTrack(socketID) {
        for(var i=0; i<this.tracks.length; i++) {
            if(this.tracks[i] == "") {
                this.tracks[i] = socketID;
                return(i);
            }
        }
        return -1;
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
    addRoom(roomName) {
        var exists = this.findRoom(roomName);
        if(exists == -1) {
            let newRoom = new Room(roomName);
            this.rooms.push(newRoom);
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