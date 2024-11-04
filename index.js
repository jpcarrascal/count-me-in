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
const { AllSessions } = require("./scripts/sessionObj.js");
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

var sessions = new AllSessions();

app.get('/', (req, res) => {
    // req.query.seq
    var page = '/html/index-track.html';
    res.sendFile(__dirname + page);
});

app.get('/sequencer', (req, res) => {
    if(req.query.session)
        var page = '/html/sequencer.html';
    else
        var page = '/html/index-sequencer.html';
    res.sendFile(__dirname + page);
});

app.get('/hootbeat', (req, res) => {
    console.log("hootbeat")
    if(req.query.session && (req.query.initials || req.query.initials==="") )
        var page = '/html/hootbeat.html';
    else
        var page = '/html/index-hootbeat.html';
    res.sendFile(__dirname + page);
});

app.get('/track', (req, res) => {
    if(req.query.session && (req.query.initials || req.query.initials==="") )
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
    var hootbeat = false;
    if(socket.handshake.headers.referer.includes("sequencer"))
        seq = true;
    else if(socket.handshake.query.hootbeat !== undefined)
        hootbeat = true;
    var session = socket.handshake.query.session;
    var initials = socket.handshake.query.initials;
    socket.join(session);
    if(seq) {
        var allocationMethod = socket.handshake.query.method || "random";
        if(socket.handshake.query.sounds === undefined) socket.handshake.query.sounds = "tr808";
        var numTracks = getNumTracks(socket.handshake.query.sounds) || 10;
        var cookies = cookie.parse(socket.handshake.headers.cookie);    
        const exists = sessions.findSession(session);
        if(exists >= 0) {
            io.to(socket.id).emit('sequencer exists', {reason: "#" + session + " exists already. Choose a different name."});
        }
        else {
            sessions.addSession(session, numTracks, config.NUM_STEPS, allocationMethod, config.MAX_NUM_ROUNDS);
            console.log("Session ID: " + session);
            logger.info("#" + session + " @SEQUENCER joined session. MIDIin: [" + cookies.MIDIin + "] MIDIout: [" + cookies.MIDIout + "]");
            sessions.setSeqID(session,socket.id);
            socket.on('disconnect', () => {
                logger.info("#" + session + " @SEQUENCER disconnected (sequencer). Clearing session");
                socket.broadcast.to(session).emit('exit session',{reason: "Sequencer disconnected!"});
                sessions.clearSession(session);
            });
        }
    } else if(hootbeat) {
        if(sessions.isReady(session)) {
            logger.info("#" + session + " @" + initials + " joined session as HootBeat");
        } else {
            io.to(socket.id).emit('exit session', {reason: "Session has not started..."});
        }
    } else {
        if(sessions.isReady(session)) {
            if(initials) {
                var track = sessions.allocateAvailableParticipant(session, socket.id, initials);
                if(track < 0) { // No available tracks in session
                    logger.info("#" + session + " @" + initials + " rejected, no available tracks ");
                    io.to(socket.id).emit('exit session', {reason: "No available tracks! Please wait a bit..."});
                } else {
                    logger.info("#" + session + " @" + initials + " joined session on track " + track);
                    socket.broadcast.to(session).emit('track joined', { initials: initials, track:track, socketid: socket.id });
                    socket.on('disconnect', () => {
                        var track2delete = sessions.getParticipantNumber(session, socket.id);
                        sessions.releaseParticipant(session, socket.id);
                        io.to(session).emit('clear track', {track: track2delete, initials: initials});
                        logger.info("#" + session + " @" + initials + " (" + socket.id + ") disconnected, clearing track " + track2delete);
                    });
                    io.to(socket.id).emit('create track', {track: track, maxNumRounds: config.MAX_NUM_ROUNDS});
                }
            } else {
                io.to(socket.id).emit('session paused', {reason: "Session has not started..."});
                logger.info("#" + session + "(" + socket.id + ") waiting in lobby...");    
            }
        } else {
            io.to(socket.id).emit('exit session', {reason: "Session has not started..."});
        }
    }
    socket.on('step update', (msg) => { // Send step values
        io.to(session).emit('step update', msg);
        sessions.participantStartCounting(session, socket.id);
        let initials = sessions.getParticipantInitials(session, socket.id);
        var event = {step: msg.step, note: msg.note, value: msg.value};
        sessions.seqUpdateStep(session, msg.track, event);
        if(seq) initials = "seq";
        logger.info("#" + session + " @" + initials + " step_update event: " + msg.action +
                        " track: " + msg.track + " step: " +msg.step +
                        " note: " + msg.note + " value: " +msg.value);
    });

    socket.on('track notes', (msg) => { // Send all notes from track
        io.to(msg.socketid).emit('update track notes', msg);
    });

    socket.on('give me my notes', (msg) => { // Send all notes from track
        socket.broadcast.to(session).emit('give me my notes', msg);
    });

    socket.on('step tick', (msg) => { // Visual sync
        socket.broadcast.to(session).emit('step tick', msg);
        var expired = new Array();
        if(msg.counter == config.NUM_STEPS-1) {
            expired = sessions.incrementAllCounters(session);
        }
        if(expired.length > 0) {
            for(var i=0; i<expired.length; i++) {
                logger.info("#" + session + " @"+expired[i].initials + " session expired!");
                io.to(expired[i].socketID).emit('exit session', {reason: "Join again?"});
            }
        }
    });

    socket.on('play', (msg) => {
        socket.broadcast.to(session).emit('play', msg);
        logger.info("#" + session + " Playing...");
    });

    socket.on('stop', (msg) => {
        socket.broadcast.to(session).emit('stop', msg);
        logger.info("#" + session + " Stopped.");
    });

    socket.on('veil-up', (msg) => {
        socket.broadcast.to(session).emit('veil-up', msg);
        logger.info("#" + session + " Veil up.");
    });


    socket.on('ping', (msg) => {
        io.to(socket.id).emit('pong', msg);
    });

    socket.on('track mute', (msg) => {
        console.log(msg)
        socket.broadcast.to(session).emit('track mute', msg);
    }); 

    socket.on('expert-mode', (msg) => {
        logger.info("#" + session + " @" + initials + " set expert mode to: " + msg.value);
    }); 

    socket.on('track solo', (msg) => {
        console.log("Solo: " + msg.value);
    });

    socket.on('track volume', (msg) => {
        socket.broadcast.to(session).emit('track volume', msg);
        console.log(msg);
    });

    socket.on('hide toggle', (msg) => {
        socket.broadcast.to(session).emit('hide toggle track', {value: msg.value});
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