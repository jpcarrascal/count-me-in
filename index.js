const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

var tracks = ["","","","","","","",""];
/*
var tracksObj = [
    {socketID:"", initials:""},
    {socketID:"", initials:""},
    {socketID:"", initials:""},
    {socketID:"", initials:""},
    {socketID:"", initials:""},
    {socketID:"", initials:""},
    {socketID:"", initials:""},
    {socketID:"", initials:""},
];
*/
var seq = false;
var seqID = "";
function allocateAvailableTrack(name) {
    for(var i=0; i<tracks.length; i++) {
        if(tracks[i] == "") {
            tracks[i] = name;
            return(i);
        }
    }
    return -1;
}

function releaseTrack(name) {
    for(var i=0; i<tracks.length; i++) {
        if(tracks[i] == name)
            tracks[i] = "";
    }
}

function getTrackNumber(name) {
    for(var i=0; i<tracks.length; i++) {
        if(tracks[i] == name) {
            return(i);
        }
    }
    return -1;
}

app.get('/', (req, res) => {
    // req.query.seq
    seq = false;
    page = '/index.html';
    res.sendFile(__dirname + page);
});

app.get('/sequencer', (req, res) => {
    seq = true;
    page = '/seq.html';
    res.sendFile(__dirname + page);
});

app.get('/track', (req, res) => {
    seq = false;
    page = '/seq.html';
    res.sendFile(__dirname + page);
});

app.use('/scripts', express.static(__dirname + '/scripts/'));
app.use('/css', express.static(__dirname + '/css/'));

io.on('connection', (socket) => {
    var room = socket.handshake.query.room;
    var initials = socket.handshake.query.initials;
    socket.join(room);
    console.log(initials + " joined room " + room);
    if(!seq) {
        var track = allocateAvailableTrack(socket.id);
        socket.broadcast.to(room).emit('track initials', { initials: initials, track:track });
        socket.on('disconnect', () => {
            var track2del = getTrackNumber(socket.id);
            releaseTrack(socket.id);
            io.to(socket.id).emit('destroy track');
            io.emit('clear track', {track: track2del});
            console.log(initials + ' disconnected, clearing track ' + track2del);
        });
        io.to(socket.id).emit('create track', {track: track});
    } else {
        seqID = socket.id;
        socket.on('disconnect', () => {
            console.log(initials + ' disconnected (sequencer).');
        });
    }

    socket.on('step value', (msg) => { // Update step values
        io.to(room).emit('step value', msg);
        console.log(msg);
    });

    socket.on('step tick', (msg) => {
        //if(msg.counter%4 == 0)
          //  console.log(">");
        //else
            //console.log(".");
        socket.broadcast.to(room).emit('step tick', msg);
    });

    socket.on('play', (msg) => {
        //io.emit('play', msg);
        socket.broadcast.to(room).emit('play', msg);
        console.log("Playing...");
    });

    socket.on('stop', (msg) => {
        //io.emit('stop', msg);
        socket.broadcast.to(room).emit('stop', msg);
        console.log("Stopped.");
    });

});

var port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log('listening on *:' + port);
});