const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const { AllRooms } = require("./scripts/server-functions.js");

var rooms = new AllRooms();
var seq = false;
var seqID = "";

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
app.use('/images', express.static(__dirname + '/images/'));

io.on('connection', (socket) => {
    var room = socket.handshake.query.room;
    var initials = socket.handshake.query.initials;
    socket.join(room);
    rooms.addRoom(room);
    console.log(initials + " joined room " + room);
    if(!seq) {
        var track = rooms.allocateAvailableTrack(room, socket.id);
        socket.broadcast.to(room).emit('track initials', { initials: initials, track:track });
        socket.on('disconnect', () => {
            var track2delete = rooms.getTrackNumber(room, socket.id);
            rooms.releaseTrack(room, socket.id);
            io.to(socket.id).emit('destroy track');
            io.to(room).emit('clear track', {track: track2delete});
            console.log(initials + ' disconnected, clearing track ' + track2delete);
        });
        io.to(socket.id).emit('create track', {track: track});
    } else {
        seqID = socket.id;
        socket.on('disconnect', () => {
            console.log(initials + ' disconnected (sequencer).');
        });
    }

    socket.on('step value', (msg) => { // Send step values
        io.to(room).emit('step value', msg);
        console.log(msg);
    });

    socket.on('step tick', (msg) => { // Visual sync
        socket.broadcast.to(room).emit('step tick', msg);
    });

    socket.on('play', (msg) => {
        socket.broadcast.to(room).emit('play', msg);
        console.log("Playing...");
    });

    socket.on('stop', (msg) => {
        socket.broadcast.to(room).emit('stop', msg);
        console.log("Stopped.");
    });

});

var port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log('listening on *:' + port);
});