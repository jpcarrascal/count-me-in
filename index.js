const fs = require('fs');
const path = require("path");
const express = require('express');
const app = express();
//const cors = require('cors');
//app.use(cors()); // Enable CORS

const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
    cors: {
      origin: '*',
    }
  });
const { AllRooms } = require("./scripts/roomsObj.js");
const config = require('./scripts/config.js');
var cookie = require("cookie")

const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;



const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} ${message}`;
});

const logger = createLogger({
  format: combine(
    label({ label: 'countmein' }),
    timestamp(),
    myFormat
  ),
  transports: [
      new transports.Console(),
      new transports.File({ filename: 'info.log' })
    ]
});

var rooms = new AllRooms(config.MAX_NUM_ROUNDS);

app.get('/', (req, res) => {
    // req.query.seq
    var page = '/html/index-track.html';
    res.sendFile(__dirname + page);
});

app.get('/sequencer', (req, res) => {
    if(req.query.room)
        var page = '/html/sequencer.html';
    else
        var page = '/html/index-sequencer.html';
    res.sendFile(__dirname + page);
});

app.get('/conductor', (req, res) => {
    if(req.query.room)
        var page = '/html/conductor.html';
    else
        var page = '/html/index-conductor.html';
    res.sendFile(__dirname + page);
});

app.get('/hootbeat', (req, res) => {
    console.log("hootbeat")
    if(req.query.room && (req.query.initials || req.query.initials==="") )
        var page = '/html/hootbeat.html';
    else
        var page = '/html/index-hootbeat.html';
    res.sendFile(__dirname + page);
});

app.get('/track', (req, res) => {
    if(req.query.room && (req.query.initials || req.query.initials==="") )
        var page = '/html/track.html';
    else
        var page = '/html/index-track.html';
    res.sendFile(__dirname + page);
});

app.get('/favicon.ico', (req, res) => {
    // req.query.seq
    var page = '/images/favicon.ico';
    res.sendFile(__dirname + page);
});

app.get('/latency', (req, res) => {
    // req.query.seq
    var page = '/html/latency.html';
    res.sendFile(__dirname + page);
});

app.use('/scripts', express.static(__dirname + '/scripts/'));
app.use('/css', express.static(__dirname + '/css/'));
app.use('/images', express.static(__dirname + '/images/'));
app.use('/sounds', express.static(__dirname + '/sounds/'));

io.on('connection', (socket) => {
    var seq = false;
    var conductor = false;
    var hootbeat = false;
    console.log(socket.handshake.query.hootbeat)
    if(socket.handshake.headers.referer.includes("sequencer"))
        seq = true;
    else if(socket.handshake.headers.referer.includes("conductor"))
        conductor = true;
    else if(socket.handshake.query.hootbeat !== undefined)
        hootbeat = true;
    var room = socket.handshake.query.room;
    var initials = socket.handshake.query.initials;
    socket.join(room);
    if(seq) {
        var allocationMethod = socket.handshake.query.method || "random";
        var numTracks = getNumTracks(socket.handshake.query.sounds) || 10;
        var cookief = socket.handshake.headers.cookie; 
        var cookies = cookie.parse(socket.handshake.headers.cookie);    
        const exists = rooms.findRoom(room);
        if(exists >= 0) io.to(socket.id).emit('sequencer exists', {reason: "#" + room + " exists already. Choose a different name."});
        else {
            rooms.addRoom(room, numTracks, allocationMethod);
            logger.info("#" + room + " @SEQUENCER joined session. MIDIin: [" + cookies.MIDIin + "] MIDIout: [" + cookies.MIDIout + "]");
            rooms.setSeqID(room,socket.id);
            socket.on('disconnect', () => {
                logger.info("#" + room + " @SEQUENCER disconnected (sequencer). Clearing session");
                socket.broadcast.to(room).emit('exit session',{reason: "Sequencer disconnected!"});
                rooms.clearRoom(room);
            });
        }
    } else if(conductor) {
        if(rooms.isReady(room)) {
            logger.info("#" + room + " @" + initials + " joined session as conductor");
        } else {
            io.to(socket.id).emit('exit session', {reason: "Session has not started..."});
        }
    } else if(hootbeat) {
        if(rooms.isReady(room)) {
            logger.info("#" + room + " @" + initials + " joined session as HoooBeat");
        } else {
            io.to(socket.id).emit('exit session', {reason: "Session has not started..."});
        }
    } else {
        if(rooms.isReady(room)) {
            if(initials) {
                var track = rooms.allocateAvailableParticipant(room, socket.id, initials);
                if(track < 0) { // No available tracks in room/session
                    logger.info("#" + room + " @" + initials + " rejected, no available tracks ");
                    io.to(socket.id).emit('exit session', {reason: "No available tracks! Please wait a bit..."});
                } else {
                    logger.info("#" + room + " @" + initials + " joined session on track " + track);
                    socket.broadcast.to(room).emit('track joined', { initials: initials, track:track, socketid: socket.id });
                    socket.on('disconnect', () => {
                        var track2delete = rooms.getParticipantNumber(room, socket.id);
                        rooms.releaseParticipant(room, socket.id);
                        io.to(room).emit('clear track', {track: track2delete, initials: initials});
                        logger.info("#" + room + " @" + initials + " (" + socket.id + ") disconnected, clearing track " + track2delete);
                    });
                    io.to(socket.id).emit('create track', {track: track, maxNumRounds: config.MAX_NUM_ROUNDS});
                    }
            } else {
                io.to(socket.id).emit('session paused', {reason: "Session has not started..."});
                logger.info("#" + room + "(" + socket.id + ") waiting in lobby...");    
            }
        } else {
            io.to(socket.id).emit('exit session', {reason: "Session has not started..."});
        }
    }
    socket.on('step update', (msg) => { // Send step values
        io.to(room).emit('step update', msg);
        rooms.participantStartCounting(room, socket.id);
        let initials = rooms.getParticipantInitials(room, socket.id);
        if(seq) initials = "seq";
        logger.info("#" + room + " @" + initials + " step_update event: " + msg.action +
                        " track: " + msg.track + " step: " +msg.step +
                        " note: " + msg.note + " value: " +msg.value);
    });

    socket.on('track notes', (msg) => { // Send all notes from track
        io.to(msg.socketid).emit('update track notes', msg);
    });

    socket.on('give me my notes', (msg) => { // Send all notes from track
        socket.broadcast.to(room).emit('give me my notes', msg);
    });

    socket.on('step tick', (msg) => { // Visual sync
        socket.broadcast.to(room).emit('step tick', msg);
        var expired = new Array();
        if(msg.counter == config.NUM_STEPS-1) {
            expired = rooms.incrementAllCounters(room);
        }
        if(expired.length > 0) {
            for(var i=0; i<expired.length; i++) {
                logger.info("#" + room + " @"+expired[i].initials + " session expired!");
                io.to(expired[i].socketID).emit('exit session', {reason: "Join again?"});
            }
        }
    });

    socket.on('play', (msg) => {
        socket.broadcast.to(room).emit('play', msg);
        logger.info("#" + room + " Playing...");
    });

    socket.on('stop', (msg) => {
        socket.broadcast.to(room).emit('stop', msg);
        logger.info("#" + room + " Stopped.");
    });

    socket.on('veil-up', (msg) => {
        socket.broadcast.to(room).emit('veil-up', msg);
        logger.info("#" + room + " Veil up.");
    });


    socket.on('ping', (msg) => {
        io.to(socket.id).emit('pong', msg);
    });

    socket.on('track mute', (msg) => {
        console.log(msg)
        socket.broadcast.to(room).emit('track mute', msg);
    }); 

    socket.on('track solo', (msg) => {
        console.log("Solo: " + msg.value);
    });

    socket.on('track volume', (msg) => {
        socket.broadcast.to(room).emit('track volume', msg);
        console.log(msg);
    });

    socket.on('hide toggle', (msg) => {
        socket.broadcast.to(room).emit('hide toggle track', {value: msg.value});
    });

});

function getNumTracks(soundSet) {
    try {
        const set = JSON.parse( fs.readFileSync( path.resolve('./sounds/' + soundSet + '/index.json') ) );
        return set.length;
    } catch (error) {
        console.log(error)
        console.log("Sounds not found!!! " + path.resolve('./sounds/' + soundSet + '/index.json'))
        return 10;
    }
}

var port = process.env.PORT || 3000;
server.listen(port, () => {
  logger.info('listening on *:' + port);
});


function exitHandler(options, exitCode) {
    logger.info("Bye!!!")
    if (options.cleanup) logger.info('clean');
    if (exitCode || exitCode === 0) logger.info(exitCode);
    if (options.exit) process.exit();
}

process.on('SIGINT', exitHandler.bind(null, {exit:true}));