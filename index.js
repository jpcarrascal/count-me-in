const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const { AllRooms } = require("./scripts/roomsObj.js");
const NUM_TRACKS = 8;
const MAX_NUM_ROUNDS = 20;
const NUM_STEPS = 16;

var rooms = new AllRooms(NUM_TRACKS, MAX_NUM_ROUNDS);

app.get('/', (req, res) => {
    // req.query.seq
    page = '/html/index.html';
    res.sendFile(__dirname + page);
});

app.get('/sequencer', (req, res) => {
    page = '/html/sequencer.html';
    res.sendFile(__dirname + page);
});

app.get('/track', (req, res) => {
    page = '/html/track.html';
    res.sendFile(__dirname + page);
});

app.get('/favicon.ico', (req, res) => {
    // req.query.seq
    page = '/images/favicon.ico';
    res.sendFile(__dirname + page);
});

app.use('/scripts', express.static(__dirname + '/scripts/'));
app.use('/css', express.static(__dirname + '/css/'));
app.use('/images', express.static(__dirname + '/images/'));
app.use('/sounds', express.static(__dirname + '/sounds/'));

io.on('connection', (socket) => {
    var seq = false;
    if(socket.handshake.headers.referer.includes("sequencer"))
        seq = true;
    var room = socket.handshake.query.room;
    var initials = socket.handshake.query.initials;
    var allocationMethod = socket.handshake.query.method || "random";
    socket.join(room);
    if(!seq) {
        if(rooms.isReady(room)) {
            var track = rooms.allocateAvailableParticipant(room, socket.id, initials);
            console.log(initials + " joined room " + room + " on track " + track);
            socket.broadcast.to(room).emit('track joined', { initials: initials, track:track, socketid: socket.id });
            socket.on('disconnect', () => {
                var track2delete = rooms.getParticipantNumber(room, socket.id);
                rooms.releaseParticipant(room, socket.id);
                io.to(room).emit('clear track', {track: track2delete});
                console.log(initials + ' disconnected, clearing track ' + track2delete);
            });
            io.to(socket.id).emit('create track', {track: track, maxNumRounds: MAX_NUM_ROUNDS});
        } else {
            io.to(socket.id).emit('exit session', {reason: "Sequencer not online yet..."});
        }
    } else {
        rooms.addRoom(room, allocationMethod);
        console.log("Sequencer joined room " + room);
        rooms.setSeqID(room,socket.id);
        socket.on('disconnect', () => {
            console.log(initials + ' disconnected (sequencer). Clearing room...');
            socket.broadcast.to(room).emit('exit session',{reason: "Sequencer exited!"});
            rooms.clearRoom(room);
        });
    }
    socket.on('step value', (msg) => { // Send step values
        io.to(room).emit('step value', msg);
        rooms.participantStartCounting(room, socket.id);
        console.log(msg)
    });

    socket.on('track notes', (msg) => { // Send all notes from track
        io.to(msg.socketid).emit('update track', msg);
    });

    socket.on('step tick', (msg) => { // Visual sync
        socket.broadcast.to(room).emit('step tick', msg);
        var expired = new Array();
        if(msg.counter == NUM_STEPS-1) {
            expired = rooms.incrementAllCounters(room);
        }
        if(expired.length > 0) {
            for(var i=0; i<expired.length; i++) {
                console.log(expired[i].initials + "'s session expired!")
                io.to(expired[i].socketID).emit('exit session', {reason: "CountMeIn again?"});
            }
        }
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