class Room {
    constructor(roomName)  {
        this.name = roomName;
        this.tracks = ["", "", "", "", "", "", "", ""];
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
}

class AllRooms {
    constructor(roomName)  {
        this.rooms = Array();
    }
    addRoom(roomName) {
        let newRoom = new Room(roomName);
        this.rooms.push(newRoom);
    }

    findRoom(roomName) {
        for(var i=0; i<this.rooms.length; i++) {
            if(this.rooms[i].name == roomName)
                return i;
        }
        return -1;
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