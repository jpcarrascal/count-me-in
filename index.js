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
var cookie = require("cookie");

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

app.get('/emoji', (req, res) => {
    if(req.query.session && (req.query.initials || req.query.initials==="") )
        var page = '/html/emoji.html';
    else
        var page = '/html/index-emoji.html';
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

app.get('/randommock', (req, res) => {
    /*
    var notes = Array(16).fill(0);
    for(var i=0; i<notes.length; i++) {
        if(Math.random() > 0.5)
          notes[i] = Math.floor(Math.random() * 80) + 20;
        else notes[i] = 0;
    }
    var notesStr = JSON.stringify(notes);
    setTimeout(() => {
        res.send(notesStr);
    }, 0);*/
    var v = parseInt(req.query.v);
    var a = parseInt(req.query.a);
    var notes = getMatchingSequences(v, a);
    if(notes) {
        res.send(JSON.stringify(notes.sequence));
    } else {
        res.send(JSON.stringify(Array(16).fill(0)));
    }
});

app.get('/audiomock', (req, res) => {
    const prompt = req.query.prompt;
    const sounds = ["bird.wav", "frog.wav", "owl.wav", "mouse.wav", "sheep.wav"];
    const soundUrl = "sounds/seal/sounds/" + sounds[Math.floor(Math.random() * sounds.length)];
    const response = JSON.stringify({sound: soundUrl, prompt: prompt});
    setTimeout(() => {
        res.send(response);
    }, 0);
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
        try {
            var cookies = cookie.parse(socket.handshake.headers.cookie);
            logger.info("#" + session + "main @SEQUENCER joined session. MIDIin: [" + cookies.MIDIin + "] MIDIout: [" + cookies.MIDIout + "]");
        } catch (error) {
            logger.info("#" + session + "main @SEQUENCER joined session.");
        }
        const exists = sessions.findSession(session);
        if(exists >= 0) {
            logger.info("#" + session + " additional @SEQUENCER joined session.");
            io.to(socket.id).emit('sequencer role', {role: "secondary", session: session});
            //io.to(socket.id).emit('sequencer exists', {reason: "#" + session + " exists already. Choose a different name."});
        }
        else {
            sessions.addSession(session, numTracks, config.NUM_STEPS, allocationMethod, config.MAX_NUM_ROUNDS);
            console.log("Session ID: " + session);
            sessions.setSeqID(session,socket.id);
            io.to(socket.id).emit('sequencer role', {role: "main", session: session});
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
// ----------------------------------------------------------Restore this!--------------------//
        //sessions.participantStartCounting(session, socket.id);
        let initials = sessions.getParticipantInitials(session, socket.id);
        var event = {step: msg.step, note: msg.note, value: msg.value};
        sessions.seqUpdateStep(session, msg.track, event);
        if(seq) initials = "seq";
        logger.info("#" + session + " @" + initials + " step_update event: " + msg.action +
                        " track: " + msg.track + " step: " +msg.step +
                        " note: " + msg.note + " value: " +msg.value);
    });

    socket.on('track notes', (msg) => { // Send all notes TO track
        io.to(msg.socketid).emit('update track notes', msg);
    });

    socket.on('give me my notes', (msg) => { // Track requests all notes from track
        socket.broadcast.to(session).emit('give me my notes', msg);
    });

    socket.on('update all track notes', (msg) => { // Track sent all its notes at once
        var notes = msg.notes;
        for(var i=0; i<notes.length; i++) {
            var event = {step: i, note: notes[i].note, value: notes[i].vel};
            sessions.seqUpdateStep(session, msg.track, event);
            newMsg = {track: msg.track, step: i, note: notes[i].note, value: notes[i].vel, action: "ai-update", socketid: msg.socketid};
            io.to(session).emit('step update', newMsg);
        }
        //io.to(msg.socketid).emit('update track notes', msg);
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

    socket.on('reload my sample', (msg) => {
        socket.broadcast.to(session).emit('reload track sample', msg);
        logger.info("#" + session + " @" + initials + " reload sample for track " + msg.track +
                    " with prompt: " + msg.value);
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

//////// Experimental: Music AI Workshop


function getMatchingSequences(valence, arousal) {
    const matchingSequences = sequences.filter(sequence => 
        sequence.valence === valence && sequence.arousal === arousal
    );
    
    if (matchingSequences.length > 0) {
        if (matchingSequences.length === 1) {
            return matchingSequences[0];
        } else {
            const randomIndex = Math.floor(Math.random() * matchingSequences.length);
            return matchingSequences[randomIndex];
        }
    } else {
        return null; // or handle no matches found case as needed
    }
}

const sequences = [
    {
        "name": "2pattern_0_V10_A067.mid",
        "valence": 6,
        "arousal": 5,
        "sequence": [
            46,
            46,
            46,
            46,
            46,
            46,
            46,
            46,
            41,
            41,
            41,
            41,
            41,
            41,
            41,
            41
        ]
    },
    {
        "name": "pattern_0_V067_A-10.mid",
        "valence": 5,
        "arousal": 0,
        "sequence": [
            56,
            51,
            0,
            51,
            0,
            56,
            56,
            0,
            51,
            51,
            56,
            51,
            0,
            51,
            51,
            0
        ]
    },
    {
        "name": "pattern_0_V-067_A00.mid",
        "valence": 1,
        "arousal": 3,
        "sequence": [
            44,
            0,
            0,
            0,
            60,
            60,
            0,
            44,
            0,
            0,
            44,
            0,
            0,
            46,
            0,
            0
        ]
    },
    {
        "name": "pattern_0_V10_A10.mid",
        "valence": 6,
        "arousal": 6,
        "sequence": [
            51,
            51,
            56,
            56,
            56,
            56,
            60,
            74,
            51,
            74,
            70,
            55,
            55,
            58,
            55,
            55
        ]
    },
    {
        "name": "3pattern__0_V00_A-033.mid",
        "valence": "",
        "arousal": 3,
        "sequence": [
            70,
            70,
            70,
            53,
            70,
            70,
            70,
            70,
            70,
            70,
            70,
            70,
            70,
            70,
            70,
            70
        ]
    },
    {
        "name": "2pattern_0_V067_A-033.mid",
        "valence": 5,
        "arousal": 2,
        "sequence": [
            79,
            0,
            67,
            65,
            0,
            0,
            64,
            0,
            62,
            62,
            0,
            62,
            0,
            61,
            57,
            59
        ]
    },
    {
        "name": "2pattern_0_V-10_A00.mid",
        "valence": 0,
        "arousal": 3,
        "sequence": [
            45,
            0,
            0,
            44,
            0,
            42,
            52,
            40,
            40,
            40,
            45,
            40,
            54,
            42,
            40,
            42
        ]
    },
    {
        "name": "2pattern_0_V-067_A10.mid",
        "valence": 1,
        "arousal": 6,
        "sequence": [
            50,
            0,
            38,
            50,
            38,
            38,
            50,
            48,
            50,
            69,
            47,
            47,
            62,
            0,
            43,
            55
        ]
    },
    {
        "name": "3pattern__0_V-067_A033.mid",
        "valence": "",
        "arousal": 1,
        "sequence": [
            53,
            58,
            53,
            53,
            53,
            53,
            46,
            53,
            53,
            46,
            53,
            53,
            46,
            53,
            53,
            53
        ]
    },
    {
        "name": "2pattern_0_V-033_A033.mid",
        "valence": 2,
        "arousal": 4,
        "sequence": [
            33,
            33,
            33,
            33,
            33,
            35,
            35,
            35,
            32,
            30,
            32,
            33,
            0,
            33,
            0,
            33
        ]
    },
    {
        "name": "3pattern__0_V-033_A-067.mid",
        "valence": "",
        "arousal": 2,
        "sequence": [
            71,
            71,
            71,
            69,
            69,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        ]
    },
    {
        "name": "3pattern__0_V00_A-10.mid",
        "valence": "",
        "arousal": 3,
        "sequence": [
            63,
            0,
            0,
            0,
            0,
            0,
            63,
            0,
            0,
            0,
            0,
            0,
            0,
            66,
            0,
            0
        ]
    },
    {
        "name": "3pattern__0_V-067_A-067.mid",
        "valence": "",
        "arousal": 1,
        "sequence": [
            59,
            62,
            0,
            59,
            0,
            62,
            0,
            59,
            59,
            62,
            59,
            0,
            59,
            0,
            55,
            0
        ]
    },
    {
        "name": "2pattern_0_V10_A-10.mid",
        "valence": 6,
        "arousal": 0,
        "sequence": [
            51,
            0,
            51,
            0,
            0,
            55,
            65,
            0,
            62,
            67,
            62,
            0,
            62,
            70,
            0,
            62
        ]
    },
    {
        "name": "3pattern__0_V10_A067.mid",
        "valence": "",
        "arousal": 6,
        "sequence": [
            42,
            57,
            42,
            42,
            42,
            45,
            0,
            54,
            50,
            55,
            62,
            55,
            55,
            55,
            55,
            55
        ]
    },
    {
        "name": "pattern_0_V00_A00.mid",
        "valence": 3,
        "arousal": 3,
        "sequence": [
            67,
            64,
            64,
            60,
            60,
            60,
            60,
            60,
            53,
            53,
            55,
            55,
            60,
            60,
            60,
            60
        ]
    },
    {
        "name": "pattern_0_V10_A033.mid",
        "valence": 6,
        "arousal": 4,
        "sequence": [
            57,
            0,
            57,
            57,
            57,
            57,
            57,
            0,
            0,
            66,
            62,
            62,
            62,
            62,
            62,
            62
        ]
    },
    {
        "name": "pattern_0_V-067_A-067.mid",
        "valence": 1,
        "arousal": 1,
        "sequence": [
            62,
            67,
            0,
            62,
            0,
            67,
            0,
            62,
            0,
            53,
            0,
            60,
            65,
            53,
            60,
            0
        ]
    },
    {
        "name": "3pattern__0_V-033_A10.mid",
        "valence": "",
        "arousal": 2,
        "sequence": [
            43,
            43,
            43,
            43,
            43,
            43,
            43,
            43,
            48,
            43,
            43,
            43,
            43,
            43,
            43,
            43
        ]
    },
    {
        "name": "3pattern__0_V00_A-067.mid",
        "valence": "",
        "arousal": 3,
        "sequence": [
            57,
            0,
            0,
            61,
            0,
            0,
            0,
            57,
            0,
            0,
            57,
            0,
            0,
            0,
            57,
            0
        ]
    },
    {
        "name": "2pattern_0_V00_A-10.mid",
        "valence": 3,
        "arousal": 0,
        "sequence": [
            63,
            63,
            0,
            63,
            0,
            0,
            63,
            61,
            0,
            49,
            49,
            0,
            54,
            0,
            0,
            58
        ]
    },
    {
        "name": "2pattern_0_V-067_A00.mid",
        "valence": 1,
        "arousal": 3,
        "sequence": [
            53,
            53,
            53,
            53,
            58,
            58,
            58,
            58,
            58,
            58,
            58,
            58,
            61,
            61,
            61,
            61
        ]
    },
    {
        "name": "2pattern_0_V-10_A-10.mid",
        "valence": 0,
        "arousal": 0,
        "sequence": [
            65,
            0,
            0,
            63,
            0,
            0,
            70,
            0,
            0,
            0,
            0,
            75,
            0,
            0,
            75,
            0
        ]
    },
    {
        "name": "2pattern_0_V067_A00.mid",
        "valence": 5,
        "arousal": 3,
        "sequence": [
            69,
            69,
            0,
            0,
            64,
            64,
            57,
            57,
            57,
            57,
            57,
            57,
            0,
            0,
            66,
            62
        ]
    },
    {
        "name": "3pattern__0_V067_A-10.mid",
        "valence": "",
        "arousal": 5,
        "sequence": [
            45,
            0,
            0,
            45,
            0,
            45,
            0,
            44,
            0,
            0,
            44,
            0,
            44,
            0,
            42,
            0
        ]
    },
    {
        "name": "2pattern_0_V00_A-033.mid",
        "valence": 3,
        "arousal": 2,
        "sequence": [
            60,
            62,
            60,
            55,
            60,
            55,
            62,
            55,
            55,
            63,
            60,
            63,
            60,
            67,
            60,
            0
        ]
    },
    {
        "name": "pattern_0_V033_A033.mid",
        "valence": 4,
        "arousal": 4,
        "sequence": [
            57,
            57,
            57,
            57,
            57,
            57,
            57,
            57,
            57,
            57,
            0,
            50,
            50,
            0,
            50,
            57
        ]
    },
    {
        "name": "3pattern__0_V-10_A00.mid",
        "valence": "",
        "arousal": 0,
        "sequence": [
            32,
            44,
            44,
            0,
            32,
            44,
            44,
            32,
            32,
            44,
            44,
            32,
            32,
            44,
            32,
            32
        ]
    },
    {
        "name": "pattern_0_V10_A-10.mid",
        "valence": 6,
        "arousal": 0,
        "sequence": [
            60,
            57,
            60,
            62,
            0,
            57,
            0,
            0,
            0,
            0,
            0,
            55,
            0,
            50,
            0,
            0
        ]
    },
    {
        "name": "3pattern__0_V10_A-10.mid",
        "valence": "",
        "arousal": 6,
        "sequence": [
            40,
            40,
            47,
            0,
            52,
            55,
            0,
            0,
            0,
            0,
            42,
            0,
            42,
            49,
            64,
            0
        ]
    },
    {
        "name": "pattern_0_V033_A10.mid",
        "valence": 4,
        "arousal": 6,
        "sequence": [
            29,
            27,
            27,
            27,
            0,
            27,
            27,
            27,
            27,
            27,
            27,
            27,
            27,
            27,
            39,
            27
        ]
    },
    {
        "name": "2pattern_0_V-033_A10.mid",
        "valence": 2,
        "arousal": 6,
        "sequence": [
            61,
            59,
            56,
            49,
            61,
            59,
            56,
            73,
            66,
            63,
            68,
            66,
            70,
            63,
            47,
            52
        ]
    },
    {
        "name": "3pattern__0_V00_A033.mid",
        "valence": "",
        "arousal": 3,
        "sequence": [
            69,
            0,
            0,
            72,
            62,
            0,
            0,
            65,
            0,
            0,
            0,
            0,
            62,
            62,
            63,
            70
        ]
    },
    {
        "name": "2pattern_0_V-067_A033.mid",
        "valence": 1,
        "arousal": 4,
        "sequence": [
            41,
            41,
            41,
            41,
            53,
            53,
            53,
            53,
            48,
            48,
            56,
            56,
            56,
            53,
            56,
            53
        ]
    },
    {
        "name": "3pattern__0_V-033_A033.mid",
        "valence": "",
        "arousal": 2,
        "sequence": [
            30,
            30,
            30,
            30,
            0,
            35,
            35,
            0,
            30,
            30,
            30,
            30,
            30,
            30,
            30,
            30
        ]
    },
    {
        "name": "pattern_0_V-033_A-033.mid",
        "valence": 2,
        "arousal": 2,
        "sequence": [
            43,
            0,
            36,
            60,
            60,
            43,
            60,
            60,
            36,
            0,
            67,
            60,
            76,
            60,
            0,
            67
        ]
    },
    {
        "name": "2pattern_0_V-10_A-033.mid",
        "valence": 0,
        "arousal": 2,
        "sequence": [
            46,
            0,
            0,
            0,
            0,
            53,
            0,
            63,
            0,
            0,
            0,
            0,
            37,
            37,
            37,
            0
        ]
    },
    {
        "name": "2pattern_0_V033_A-033.mid",
        "valence": 4,
        "arousal": 2,
        "sequence": [
            67,
            68,
            70,
            0,
            72,
            70,
            73,
            72,
            70,
            0,
            73,
            72,
            51,
            0,
            0,
            70
        ]
    },
    {
        "name": "2pattern_0_V067_A-067.mid",
        "valence": 5,
        "arousal": 1,
        "sequence": [
            65,
            64,
            65,
            0,
            0,
            64,
            58,
            60,
            62,
            62,
            62,
            0,
            60,
            62,
            62,
            60
        ]
    },
    {
        "name": "pattern_0_V00_A-10.mid",
        "valence": 3,
        "arousal": 0,
        "sequence": [
            45,
            0,
            0,
            0,
            0,
            0,
            43,
            0,
            0,
            0,
            0,
            0,
            41,
            0,
            0,
            0
        ]
    },
    {
        "name": "2pattern_0_V10_A-033.mid",
        "valence": 6,
        "arousal": 2,
        "sequence": [
            55,
            60,
            55,
            55,
            55,
            55,
            60,
            55,
            55,
            55,
            55,
            60,
            55,
            55,
            55,
            55
        ]
    },
    {
        "name": "3pattern__0_V10_A-033.mid",
        "valence": "",
        "arousal": 6,
        "sequence": [
            62,
            0,
            0,
            0,
            58,
            0,
            57,
            0,
            57,
            0,
            57,
            57,
            57,
            57,
            57,
            57
        ]
    },
    {
        "name": "2pattern_0_V-10_A10.mid",
        "valence": 0,
        "arousal": 6,
        "sequence": [
            77,
            77,
            81,
            74,
            82,
            82,
            65,
            65,
            65,
            65,
            65,
            69,
            69,
            72,
            69,
            72
        ]
    },
    {
        "name": "pattern_0_V033_A00.mid",
        "valence": 4,
        "arousal": 3,
        "sequence": [
            60,
            0,
            60,
            0,
            0,
            60,
            0,
            60,
            60,
            60,
            60,
            0,
            0,
            0,
            0,
            0
        ]
    },
    {
        "name": "pattern_0_V10_A067.mid",
        "valence": 6,
        "arousal": 5,
        "sequence": [
            61,
            56,
            47,
            56,
            56,
            56,
            56,
            56,
            57,
            57,
            57,
            57,
            57,
            56,
            56,
            56
        ]
    },
    {
        "name": "pattern_0_V033_A067.mid",
        "valence": 4,
        "arousal": 5,
        "sequence": [
            55,
            52,
            52,
            52,
            50,
            50,
            50,
            50,
            0,
            50,
            50,
            60,
            55,
            52,
            52,
            52
        ]
    },
    {
        "name": "3pattern__0_V10_A033.mid",
        "valence": "",
        "arousal": 6,
        "sequence": [
            63,
            63,
            63,
            63,
            68,
            63,
            63,
            61,
            61,
            61,
            61,
            0,
            0,
            0,
            0,
            0
        ]
    },
    {
        "name": "2pattern_0_V00_A-067.mid",
        "valence": 3,
        "arousal": 1,
        "sequence": [
            36,
            48,
            36,
            48,
            34,
            46,
            34,
            46,
            31,
            43,
            43,
            36,
            48,
            34,
            46,
            34
        ]
    },
    {
        "name": "2pattern_0_V00_A067.mid",
        "valence": 3,
        "arousal": 5,
        "sequence": [
            29,
            29,
            29,
            29,
            34,
            34,
            34,
            0,
            41,
            41,
            29,
            41,
            41,
            41,
            22,
            34
        ]
    },
    {
        "name": "2pattern_0_V-067_A-033.mid",
        "valence": 1,
        "arousal": 2,
        "sequence": [
            53,
            0,
            53,
            66,
            53,
            53,
            53,
            0,
            0,
            53,
            0,
            53,
            0,
            0,
            0,
            61
        ]
    },
    {
        "name": "3pattern__0_V067_A033.mid",
        "valence": "",
        "arousal": 5,
        "sequence": [
            41,
            41,
            41,
            41,
            41,
            41,
            44,
            0,
            44,
            44,
            44,
            44,
            44,
            51,
            51,
            51
        ]
    },
    {
        "name": "2pattern_0_V00_A033.mid",
        "valence": 3,
        "arousal": 4,
        "sequence": [
            57,
            59,
            59,
            62,
            62,
            60,
            60,
            60,
            60,
            60,
            67,
            67,
            67,
            67,
            67,
            67
        ]
    },
    {
        "name": "2pattern_0_V-067_A067.mid",
        "valence": 1,
        "arousal": 5,
        "sequence": [
            74,
            74,
            77,
            74,
            74,
            74,
            74,
            74,
            74,
            72,
            72,
            77,
            77,
            77,
            72,
            72
        ]
    },
    {
        "name": "pattern_0_V033_A-067.mid",
        "valence": 4,
        "arousal": 1,
        "sequence": [
            57,
            0,
            0,
            0,
            0,
            70,
            72,
            0,
            0,
            69,
            67,
            0,
            57,
            67,
            0,
            0
        ]
    },
    {
        "name": "pattern_0_V-067_A033.mid",
        "valence": 1,
        "arousal": 4,
        "sequence": [
            31,
            31,
            29,
            29,
            43,
            31,
            43,
            31,
            29,
            0,
            68,
            71,
            66,
            0,
            71,
            0
        ]
    },
    {
        "name": "3pattern__0_V-067_A-10.mid",
        "valence": "",
        "arousal": 1,
        "sequence": [
            37,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            39,
            0,
            0,
            0,
            0,
            39,
            63
        ]
    },
    {
        "name": "pattern_0_V-033_A033.mid",
        "valence": 2,
        "arousal": 4,
        "sequence": [
            44,
            51,
            51,
            44,
            51,
            44,
            0,
            44,
            63,
            51,
            63,
            71,
            71,
            71,
            59,
            49
        ]
    },
    {
        "name": "pattern_0_V00_A10.mid",
        "valence": 3,
        "arousal": 6,
        "sequence": [
            56,
            56,
            56,
            56,
            56,
            60,
            56,
            60,
            58,
            58,
            62,
            62,
            62,
            67,
            63,
            63
        ]
    },
    {
        "name": "2pattern_0_V00_A10.mid",
        "valence": 3,
        "arousal": 6,
        "sequence": [
            60,
            60,
            60,
            65,
            0,
            0,
            63,
            65,
            65,
            70,
            65,
            77,
            73,
            0,
            72,
            70
        ]
    },
    {
        "name": "pattern_0_V-10_A033.mid",
        "valence": 0,
        "arousal": 4,
        "sequence": [
            32,
            32,
            32,
            32,
            32,
            32,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        ]
    },
    {
        "name": "2pattern_0_V033_A10.mid",
        "valence": 4,
        "arousal": 6,
        "sequence": [
            64,
            64,
            64,
            67,
            62,
            62,
            67,
            62,
            67,
            62,
            57,
            62,
            62,
            50,
            66,
            54
        ]
    },
    {
        "name": "3pattern__0_V-10_A10.mid",
        "valence": "",
        "arousal": 0,
        "sequence": [
            64,
            0,
            62,
            59,
            52,
            52,
            52,
            52,
            52,
            52,
            47,
            52,
            51,
            52,
            52,
            51
        ]
    },
    {
        "name": "3pattern__0_V067_A-067.mid",
        "valence": "",
        "arousal": 5,
        "sequence": [
            34,
            34,
            34,
            34,
            34,
            34,
            34,
            34,
            34,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        ]
    },
    {
        "name": "pattern_0_V033_A-033.mid",
        "valence": 4,
        "arousal": 2,
        "sequence": [
            57,
            53,
            53,
            53,
            53,
            53,
            53,
            53,
            53,
            53,
            53,
            53,
            53,
            53,
            38,
            38
        ]
    },
    {
        "name": "3pattern__0_V033_A-033.mid",
        "valence": "",
        "arousal": 4,
        "sequence": [
            57,
            57,
            57,
            57,
            57,
            57,
            0,
            57,
            0,
            57,
            0,
            57,
            0,
            57,
            57,
            57
        ]
    },
    {
        "name": "2pattern_0_V033_A033.mid",
        "valence": 4,
        "arousal": 4,
        "sequence": [
            49,
            56,
            56,
            56,
            49,
            56,
            56,
            49,
            49,
            56,
            49,
            49,
            49,
            49,
            44,
            44
        ]
    },
    {
        "name": "2pattern_0_V-10_A-067.mid",
        "valence": 0,
        "arousal": 1,
        "sequence": [
            52,
            59,
            52,
            0,
            59,
            52,
            40,
            40,
            40,
            52,
            59,
            52,
            47,
            35,
            47,
            51
        ]
    },
    {
        "name": "3pattern__0_V-10_A033.mid",
        "valence": "",
        "arousal": 0,
        "sequence": [
            72,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        ]
    },
    {
        "name": "2pattern_0_V033_A-067.mid",
        "valence": 4,
        "arousal": 1,
        "sequence": [
            66,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            51,
            58,
            63,
            66,
            0,
            0,
            0,
            0
        ]
    },
    {
        "name": "2pattern_0_V033_A00.mid",
        "valence": 4,
        "arousal": 3,
        "sequence": [
            40,
            40,
            40,
            47,
            40,
            40,
            40,
            40,
            47,
            40,
            40,
            40,
            40,
            40,
            40,
            40
        ]
    },
    {
        "name": "pattern_0_V-033_A-10.mid",
        "valence": 2,
        "arousal": 0,
        "sequence": [
            61,
            62,
            57,
            0,
            61,
            57,
            57,
            0,
            62,
            57,
            0,
            57,
            62,
            57,
            0,
            62
        ]
    },
    {
        "name": "pattern_0_V067_A-033.mid",
        "valence": 5,
        "arousal": 2,
        "sequence": [
            47,
            47,
            62,
            62,
            43,
            43,
            43,
            0,
            43,
            0,
            50,
            0,
            50,
            0,
            50,
            0
        ]
    },
    {
        "name": "pattern_0_V067_A067.mid",
        "valence": 5,
        "arousal": 5,
        "sequence": [
            62,
            65,
            62,
            60,
            62,
            60,
            60,
            60,
            60,
            60,
            60,
            60,
            60,
            0,
            0,
            0
        ]
    },
    {
        "name": "pattern_0_V00_A067.mid",
        "valence": 3,
        "arousal": 5,
        "sequence": [
            31,
            38,
            39,
            39,
            39,
            39,
            39,
            39,
            39,
            68,
            39,
            39,
            39,
            39,
            39,
            39
        ]
    },
    {
        "name": "pattern_0_V067_A10.mid",
        "valence": 5,
        "arousal": 6,
        "sequence": [
            63,
            67,
            70,
            0,
            63,
            67,
            0,
            58,
            58,
            58,
            58,
            58,
            55,
            55,
            58,
            55
        ]
    },
    {
        "name": "2pattern_0_V10_A-067.mid",
        "valence": 6,
        "arousal": 1,
        "sequence": [
            55,
            59,
            64,
            57,
            57,
            55,
            55,
            59,
            55,
            57,
            60,
            57,
            59,
            62,
            59,
            60
        ]
    },
    {
        "name": "3pattern__0_V-033_A-033.mid",
        "valence": "",
        "arousal": 2,
        "sequence": [
            61,
            61,
            56,
            0,
            0,
            68,
            68,
            58,
            51,
            0,
            0,
            0,
            0,
            0,
            51,
            58
        ]
    },
    {
        "name": "2pattern_0_V-067_A-067.mid",
        "valence": 1,
        "arousal": 1,
        "sequence": [
            54,
            54,
            54,
            57,
            54,
            0,
            55,
            50,
            0,
            55,
            50,
            0,
            54,
            50,
            0,
            54
        ]
    },
    {
        "name": "pattern_0_V067_A00.mid",
        "valence": 5,
        "arousal": 3,
        "sequence": [
            54,
            42,
            42,
            54,
            54,
            47,
            0,
            51,
            51,
            54,
            54,
            59,
            47,
            59,
            54,
            59
        ]
    },
    {
        "name": "pattern_0_V-067_A067.mid",
        "valence": 1,
        "arousal": 5,
        "sequence": [
            49,
            42,
            42,
            42,
            42,
            42,
            45,
            45,
            45,
            45,
            45,
            45,
            0,
            45,
            45,
            45
        ]
    },
    {
        "name": "2pattern_0_V033_A-10.mid",
        "valence": 4,
        "arousal": 0,
        "sequence": [
            34,
            37,
            0,
            0,
            34,
            0,
            0,
            0,
            0,
            37,
            0,
            0,
            0,
            0,
            37,
            0
        ]
    },
    {
        "name": "3pattern__0_V-067_A00.mid",
        "valence": "",
        "arousal": 1,
        "sequence": [
            36,
            36,
            36,
            36,
            36,
            31,
            31,
            34,
            34,
            31,
            31,
            34,
            31,
            31,
            36,
            34
        ]
    },
    {
        "name": "pattern_0_V-067_A10.mid",
        "valence": 1,
        "arousal": 6,
        "sequence": [
            50,
            50,
            36,
            48,
            36,
            48,
            48,
            48,
            48,
            36,
            36,
            48,
            36,
            62,
            62,
            55
        ]
    },
    {
        "name": "2pattern_0_V-067_A-10.mid",
        "valence": 1,
        "arousal": 0,
        "sequence": [
            63,
            63,
            71,
            0,
            73,
            63,
            0,
            63,
            77,
            63,
            63,
            0,
            70,
            63,
            89,
            0
        ]
    },
    {
        "name": "3pattern__0_V067_A-033.mid",
        "valence": "",
        "arousal": 5,
        "sequence": [
            43,
            43,
            43,
            43,
            41,
            43,
            46,
            46,
            48,
            48,
            46,
            46,
            44,
            46,
            46,
            44
        ]
    },
    {
        "name": "2pattern_0_V-033_A-10.mid",
        "valence": 2,
        "arousal": 0,
        "sequence": [
            54,
            0,
            0,
            0,
            0,
            0,
            51,
            0,
            0,
            0,
            0,
            0,
            0,
            51,
            0,
            0
        ]
    },
    {
        "name": "3pattern__0_V-10_A-10.mid",
        "valence": "",
        "arousal": 0,
        "sequence": [
            63,
            58,
            0,
            58,
            0,
            62,
            0,
            58,
            0,
            58,
            0,
            58,
            45,
            0,
            45,
            0
        ]
    },
    {
        "name": "pattern_0_V00_A-033.mid",
        "valence": 3,
        "arousal": 2,
        "sequence": [
            66,
            64,
            61,
            78,
            66,
            57,
            64,
            61,
            69,
            57,
            57,
            54,
            57,
            54,
            0,
            59
        ]
    },
    {
        "name": "3pattern__0_V033_A00.mid",
        "valence": "",
        "arousal": 4,
        "sequence": [
            57,
            59,
            0,
            57,
            0,
            0,
            0,
            0,
            0,
            0,
            51,
            0,
            54,
            51,
            0,
            0
        ]
    },
    {
        "name": "3pattern__0_V10_A00.mid",
        "valence": "",
        "arousal": 6,
        "sequence": [
            42,
            0,
            0,
            42,
            58,
            58,
            58,
            58,
            58,
            56,
            56,
            56,
            56,
            56,
            56,
            56
        ]
    },
    {
        "name": "2pattern_0_V067_A10.mid",
        "valence": 5,
        "arousal": 6,
        "sequence": [
            48,
            48,
            48,
            48,
            48,
            48,
            53,
            53,
            53,
            53,
            53,
            72,
            0,
            72,
            79,
            81
        ]
    },
    {
        "name": "pattern_0_V-10_A00.mid",
        "valence": 0,
        "arousal": 3,
        "sequence": [
            45,
            45,
            45,
            45,
            45,
            45,
            45,
            45,
            45,
            45,
            0,
            45,
            45,
            52,
            52,
            52
        ]
    },
    {
        "name": "3pattern__0_V033_A10.mid",
        "valence": "",
        "arousal": 4,
        "sequence": [
            70,
            70,
            70,
            70,
            70,
            68,
            68,
            68,
            56,
            56,
            56,
            56,
            56,
            56,
            56,
            56
        ]
    },
    {
        "name": "3pattern__0_V-033_A067.mid",
        "valence": "",
        "arousal": 2,
        "sequence": [
            40,
            40,
            40,
            45,
            45,
            0,
            40,
            45,
            33,
            33,
            33,
            40,
            33,
            33,
            35,
            33
        ]
    },
    {
        "name": "pattern_0_V10_A-033.mid",
        "valence": 6,
        "arousal": 2,
        "sequence": [
            41,
            44,
            41,
            41,
            45,
            46,
            49,
            45,
            46,
            51,
            39,
            46,
            34,
            36,
            39,
            34
        ]
    },
    {
        "name": "3pattern__0_V033_A033.mid",
        "valence": "",
        "arousal": 4,
        "sequence": [
            32,
            32,
            32,
            32,
            0,
            0,
            25,
            25,
            25,
            25,
            0,
            25,
            28,
            30,
            30,
            42
        ]
    },
    {
        "name": "3pattern__0_V067_A10.mid",
        "valence": "",
        "arousal": 5,
        "sequence": [
            71,
            71,
            68,
            68,
            71,
            52,
            76,
            52,
            52,
            52,
            52,
            52,
            52,
            52,
            52,
            54
        ]
    },
    {
        "name": "3pattern__0_V-10_A067.mid",
        "valence": "",
        "arousal": 0,
        "sequence": [
            33,
            33,
            33,
            33,
            33,
            33,
            33,
            33,
            33,
            33,
            33,
            33,
            33,
            33,
            33,
            33
        ]
    },
    {
        "name": "2pattern_0_V10_A00.mid",
        "valence": 6,
        "arousal": 3,
        "sequence": [
            43,
            50,
            43,
            43,
            50,
            43,
            43,
            43,
            50,
            43,
            43,
            43,
            43,
            43,
            50,
            50
        ]
    },
    {
        "name": "pattern_0_V-10_A-067.mid",
        "valence": 0,
        "arousal": 1,
        "sequence": [
            68,
            0,
            73,
            68,
            73,
            64,
            68,
            73,
            64,
            68,
            73,
            64,
            68,
            64,
            64,
            68
        ]
    },
    {
        "name": "pattern_0_V-033_A00.mid",
        "valence": 2,
        "arousal": 3,
        "sequence": [
            60,
            0,
            64,
            60,
            65,
            65,
            65,
            67,
            65,
            70,
            70,
            67,
            67,
            67,
            67,
            70
        ]
    },
    {
        "name": "3pattern__0_V033_A-067.mid",
        "valence": "",
        "arousal": 4,
        "sequence": [
            45,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            45,
            0,
            0,
            0,
            0,
            41
        ]
    },
    {
        "name": "pattern_0_V-033_A-067.mid",
        "valence": 2,
        "arousal": 1,
        "sequence": [
            63,
            0,
            0,
            0,
            75,
            0,
            73,
            0,
            71,
            54,
            0,
            0,
            63,
            58,
            0,
            73
        ]
    },
    {
        "name": "2pattern_0_V10_A033.mid",
        "valence": 6,
        "arousal": 4,
        "sequence": [
            54,
            54,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            57,
            61,
            61
        ]
    },
    {
        "name": "3pattern__0_V033_A-10.mid",
        "valence": "",
        "arousal": 4,
        "sequence": [
            58,
            65,
            62,
            0,
            63,
            62,
            39,
            0,
            55,
            39,
            0,
            53,
            55,
            39,
            53,
            51
        ]
    },
    {
        "name": "2pattern_0_V10_A10.mid",
        "valence": 6,
        "arousal": 6,
        "sequence": [
            53,
            55,
            0,
            56,
            55,
            56,
            56,
            56,
            56,
            56,
            56,
            60,
            53,
            63,
            63,
            53
        ]
    },
    {
        "name": "pattern_0_V-033_A10.mid",
        "valence": 2,
        "arousal": 6,
        "sequence": [
            42,
            42,
            42,
            42,
            42,
            42,
            42,
            42,
            66,
            45,
            45,
            47,
            56,
            59,
            56,
            54
        ]
    },
    {
        "name": "2pattern_0_V-033_A-067.mid",
        "valence": 2,
        "arousal": 1,
        "sequence": [
            67,
            58,
            0,
            58,
            58,
            58,
            62,
            57,
            60,
            0,
            65,
            0,
            0,
            0,
            0,
            69
        ]
    },
    {
        "name": "3pattern__0_V10_A10.mid",
        "valence": "",
        "arousal": 6,
        "sequence": [
            56,
            56,
            59,
            57,
            57,
            56,
            52,
            52,
            47,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        ]
    },
    {
        "name": "pattern_0_V-10_A10.mid",
        "valence": 0,
        "arousal": 6,
        "sequence": [
            47,
            47,
            47,
            47,
            52,
            52,
            52,
            52,
            52,
            52,
            52,
            52,
            52,
            52,
            52,
            52
        ]
    },
    {
        "name": "2pattern_0_V067_A-10.mid",
        "valence": 5,
        "arousal": 0,
        "sequence": [
            33,
            33,
            33,
            0,
            33,
            45,
            33,
            33,
            45,
            28,
            28,
            40,
            40,
            40,
            28,
            28
        ]
    },
    {
        "name": "pattern_0_V067_A033.mid",
        "valence": 5,
        "arousal": 4,
        "sequence": [
            44,
            44,
            0,
            44,
            56,
            44,
            44,
            44,
            44,
            44,
            44,
            49,
            49,
            49,
            47,
            47
        ]
    },
    {
        "name": "2pattern_0_V-033_A067.mid",
        "valence": 2,
        "arousal": 5,
        "sequence": [
            55,
            55,
            55,
            60,
            64,
            67,
            64,
            64,
            0,
            0,
            0,
            0,
            0,
            60,
            55,
            60
        ]
    },
    {
        "name": "3pattern__0_V-10_A-033.mid",
        "valence": "",
        "arousal": 0,
        "sequence": [
            55,
            55,
            59,
            62,
            59,
            59,
            62,
            62,
            59,
            59,
            59,
            59,
            59,
            59,
            59,
            59
        ]
    },
    {
        "name": "pattern_0_V00_A-067.mid",
        "valence": 3,
        "arousal": 1,
        "sequence": [
            52,
            0,
            0,
            0,
            0,
            59,
            0,
            52,
            59,
            0,
            52,
            54,
            0,
            59,
            0,
            0
        ]
    },
    {
        "name": "2pattern_0_V033_A067.mid",
        "valence": 4,
        "arousal": 5,
        "sequence": [
            51,
            51,
            51,
            51,
            51,
            51,
            51,
            51,
            51,
            58,
            51,
            51,
            51,
            51,
            51,
            51
        ]
    },
    {
        "name": "2pattern_0_V-033_A-033.mid",
        "valence": 2,
        "arousal": 2,
        "sequence": [
            64,
            0,
            64,
            66,
            64,
            62,
            59,
            0,
            62,
            59,
            60,
            57,
            64,
            66,
            64,
            62
        ]
    },
    {
        "name": "3pattern__0_V033_A067.mid",
        "valence": "",
        "arousal": 4,
        "sequence": [
            48,
            48,
            55,
            48,
            55,
            48,
            55,
            48,
            55,
            55,
            48,
            55,
            48,
            55,
            48,
            55
        ]
    },
    {
        "name": "pattern_0_V-067_A-10.mid",
        "valence": 1,
        "arousal": 0,
        "sequence": [
            46,
            0,
            0,
            0,
            0,
            0,
            53,
            53,
            60,
            0,
            60,
            0,
            50,
            0,
            0,
            0
        ]
    },
    {
        "name": "3pattern__0_V-033_A-10.mid",
        "valence": "",
        "arousal": 2,
        "sequence": [
            59,
            59,
            0,
            59,
            0,
            0,
            0,
            59,
            0,
            0,
            0,
            59,
            0,
            0,
            0,
            59
        ]
    },
    {
        "name": "3pattern__0_V00_A00.mid",
        "valence": "",
        "arousal": 3,
        "sequence": [
            39,
            42,
            42,
            44,
            44,
            44,
            44,
            44,
            46,
            46,
            46,
            0,
            0,
            0,
            0,
            0
        ]
    },
    {
        "name": "2pattern_0_V067_A033.mid",
        "valence": 5,
        "arousal": 4,
        "sequence": [
            41,
            41,
            41,
            41,
            41,
            41,
            41,
            41,
            41,
            41,
            41,
            0,
            41,
            0,
            0,
            0
        ]
    },
    {
        "name": "3pattern__0_V-067_A10.mid",
        "valence": "",
        "arousal": 1,
        "sequence": [
            63,
            63,
            63,
            60,
            60,
            60,
            60,
            60,
            60,
            60,
            60,
            60,
            60,
            60,
            60,
            60
        ]
    },
    {
        "name": "pattern_0_V00_A033.mid",
        "valence": 3,
        "arousal": 4,
        "sequence": [
            40,
            26,
            28,
            28,
            40,
            40,
            38,
            50,
            38,
            26,
            26,
            38,
            38,
            38,
            38,
            33
        ]
    },
    {
        "name": "3pattern__0_V00_A10.mid",
        "valence": "",
        "arousal": 3,
        "sequence": [
            45,
            45,
            45,
            45,
            45,
            45,
            45,
            0,
            45,
            45,
            45,
            45,
            45,
            45,
            45,
            45
        ]
    },
    {
        "name": "3pattern__0_V-033_A00.mid",
        "valence": "",
        "arousal": 2,
        "sequence": [
            41,
            0,
            41,
            41,
            41,
            41,
            41,
            41,
            41,
            41,
            41,
            41,
            41,
            41,
            41,
            41
        ]
    },
    {
        "name": "pattern_0_V-067_A-033.mid",
        "valence": 1,
        "arousal": 2,
        "sequence": [
            57,
            57,
            60,
            57,
            57,
            0,
            0,
            57,
            0,
            57,
            0,
            45,
            45,
            57,
            60,
            0
        ]
    },
    {
        "name": "3pattern__0_V10_A-067.mid",
        "valence": "",
        "arousal": 6,
        "sequence": [
            39,
            0,
            39,
            0,
            39,
            0,
            39,
            0,
            0,
            0,
            0,
            44,
            0,
            0,
            0,
            37
        ]
    },
    {
        "name": "2pattern_0_V00_A00.mid",
        "valence": 3,
        "arousal": 3,
        "sequence": [
            60,
            60,
            60,
            60,
            62,
            62,
            62,
            62,
            60,
            60,
            60,
            65,
            65,
            65,
            65,
            65
        ]
    },
    {
        "name": "3pattern__0_V-10_A-067.mid",
        "valence": "",
        "arousal": 0,
        "sequence": [
            58,
            58,
            0,
            58,
            0,
            58,
            58,
            0,
            58,
            0,
            58,
            58,
            58,
            55,
            56,
            55
        ]
    },
    {
        "name": "pattern_0_V033_A-10.mid",
        "valence": 4,
        "arousal": 0,
        "sequence": [
            44,
            44,
            44,
            44,
            44,
            44,
            0,
            37,
            37,
            37,
            37,
            37,
            37,
            37,
            37,
            37
        ]
    },
    {
        "name": "3pattern__0_V067_A067.mid",
        "valence": "",
        "arousal": 5,
        "sequence": [
            73,
            66,
            66,
            69,
            66,
            54,
            42,
            42,
            42,
            42,
            42,
            42,
            42,
            42,
            42,
            42
        ]
    },
    {
        "name": "2pattern_0_V-033_A00.mid",
        "valence": 2,
        "arousal": 3,
        "sequence": [
            50,
            50,
            57,
            68,
            57,
            50,
            43,
            43,
            45,
            43,
            43,
            42,
            49,
            44,
            44,
            44
        ]
    },
    {
        "name": "3pattern__0_V-067_A067.mid",
        "valence": "",
        "arousal": 1,
        "sequence": [
            51,
            51,
            0,
            0,
            0,
            0,
            0,
            54,
            54,
            47,
            47,
            47,
            0,
            0,
            0,
            40
        ]
    },
    {
        "name": "2pattern_0_V067_A067.mid",
        "valence": 5,
        "arousal": 5,
        "sequence": [
            56,
            56,
            56,
            56,
            56,
            56,
            56,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        ]
    },
    {
        "name": "pattern_0_V-10_A067.mid",
        "valence": 0,
        "arousal": 5,
        "sequence": [
            25,
            25,
            25,
            0,
            25,
            28,
            33,
            33,
            33,
            33,
            33,
            33,
            33,
            33,
            33,
            33
        ]
    },
    {
        "name": "2pattern_0_V-10_A067.mid",
        "valence": 0,
        "arousal": 5,
        "sequence": [
            34,
            34,
            34,
            34,
            34,
            34,
            31,
            31,
            31,
            38,
            38,
            38,
            31,
            29,
            29,
            29
        ]
    },
    {
        "name": "pattern_0_V067_A-067.mid",
        "valence": 5,
        "arousal": 1,
        "sequence": [
            58,
            63,
            58,
            63,
            0,
            58,
            67,
            58,
            67,
            63,
            67,
            0,
            68,
            63,
            68,
            56
        ]
    },
    {
        "name": "3pattern__0_V-067_A-033.mid",
        "valence": "",
        "arousal": 1,
        "sequence": [
            55,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            55,
            0,
            0,
            55,
            55,
            0
        ]
    },
    {
        "name": "3pattern__0_V00_A067.mid",
        "valence": "",
        "arousal": 3,
        "sequence": [
            54,
            59,
            54,
            54,
            54,
            54,
            54,
            54,
            54,
            54,
            0,
            0,
            0,
            0,
            0,
            0
        ]
    },
    {
        "name": "pattern_0_V-033_A067.mid",
        "valence": 2,
        "arousal": 5,
        "sequence": [
            50,
            0,
            54,
            0,
            66,
            47,
            47,
            47,
            47,
            59,
            47,
            47,
            47,
            59,
            59,
            63
        ]
    },
    {
        "name": "pattern_0_V10_A-067.mid",
        "valence": 6,
        "arousal": 1,
        "sequence": [
            57,
            50,
            0,
            57,
            0,
            0,
            0,
            0,
            0,
            50,
            0,
            57,
            0,
            0,
            0,
            0
        ]
    },
    {
        "name": "pattern_0_V10_A00.mid",
        "valence": 6,
        "arousal": 3,
        "sequence": [
            43,
            43,
            43,
            50,
            43,
            43,
            43,
            43,
            43,
            43,
            50,
            46,
            46,
            44,
            46,
            44
        ]
    },
    {
        "name": "pattern_0_V-10_A-033.mid",
        "valence": 0,
        "arousal": 2,
        "sequence": [
            57,
            45,
            0,
            45,
            0,
            45,
            33,
            33,
            33,
            33,
            33,
            33,
            33,
            50,
            0,
            50
        ]
    },
    {
        "name": "pattern_0_V-10_A-10.mid",
        "valence": 0,
        "arousal": 0,
        "sequence": [
            63,
            61,
            0,
            60,
            0,
            58,
            0,
            0,
            0,
            0,
            0,
            63,
            60,
            61,
            0,
            60
        ]
    },
    {
        "name": "3pattern__0_V067_A00.mid",
        "valence": "",
        "arousal": 5,
        "sequence": [
            65,
            0,
            57,
            0,
            0,
            62,
            57,
            62,
            55,
            60,
            55,
            55,
            48,
            48,
            48,
            48
        ]
    },
    {
        "name": "2pattern_0_V-10_A033.mid",
        "valence": 0,
        "arousal": 4,
        "sequence": [
            62,
            62,
            62,
            0,
            67,
            0,
            67,
            0,
            67,
            67,
            0,
            67,
            64,
            0,
            67,
            67
        ]
    }
];

/*
[
    {
        "name": "2pattern_0_V-033_A-033.mid",
        "valence": 2,
        "arousal": 2,
        "sequence": [
            64,
            64,
            66,
            64,
            59,
            62,
            60,
            59,
            0,
            0,
            0,
            0,
            0,
            0,
            69,
            69
        ]
    },
    {
        "name": "2pattern_0_V-033_A-067.mid",
        "valence": 2,
        "arousal": 1,
        "sequence": [
            67,
            67,
            62,
            65,
            69,
            0,
            0,
            0,
            67,
            0,
            0,
            63,
            0,
            67,
            63,
            0
        ]
    },
    {
        "name": "2pattern_0_V-033_A-10.mid",
        "valence": 2,
        "arousal": 0,
        "sequence": [
            54,
            52,
            51,
            49,
            54,
            54,
            49,
            56,
            50,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        ]
    },
    {
        "name": "2pattern_0_V-033_A00.mid",
        "valence": 2,
        "arousal": 3,
        "sequence": [
            68,
            68,
            67,
            68,
            62,
            55,
            0,
            55,
            57,
            55,
            55,
            55,
            54,
            54,
            56,
            56
        ]
    },
    {
        "name": "2pattern_0_V-033_A033.mid",
        "valence": 2,
        "arousal": 4,
        "sequence": [
            33,
            33,
            33,
            33,
            33,
            35,
            0,
            35,
            35,
            32,
            30,
            32,
            33,
            0,
            33,
            0
        ]
    },
    {
        "name": "2pattern_0_V-033_A067.mid",
        "valence": 2,
        "arousal": 5,
        "sequence": [
            64,
            0,
            0,
            64,
            64,
            64,
            0,
            72,
            72,
            55,
            55,
            72,
            0,
            0,
            0,
            0
        ]
    },
    {
        "name": "2pattern_0_V-033_A10.mid",
        "valence": 2,
        "arousal": 6,
        "sequence": [
            61,
            73,
            59,
            56,
            73,
            73,
            0,
            73,
            71,
            73,
            66,
            73,
            66,
            66,
            0,
            63
        ]
    },
    {
        "name": "2pattern_0_V-067_A-033.mid",
        "valence": 1,
        "arousal": 2,
        "sequence": [
            70,
            68,
            66,
            70,
            0,
            65,
            0,
            0,
            65,
            0,
            61,
            0,
            0,
            0,
            66,
            0
        ]
    },
    {
        "name": "2pattern_0_V-067_A-067.mid",
        "valence": 1,
        "arousal": 1,
        "sequence": [
            62,
            54,
            50,
            62,
            62,
            62,
            50,
            50,
            50,
            61,
            61,
            52,
            56,
            56,
            61,
            63
        ]
    },
    {
        "name": "2pattern_0_V-067_A-10.mid",
        "valence": 1,
        "arousal": 0,
        "sequence": [
            75,
            80,
            75,
            89,
            85,
            56,
            77,
            80,
            42,
            56,
            56,
            54,
            58,
            54,
            59,
            42
        ]
    },
    {
        "name": "2pattern_0_V-067_A00.mid",
        "valence": 1,
        "arousal": 3,
        "sequence": [
            58,
            58,
            53,
            58,
            58,
            58,
            58,
            58,
            58,
            58,
            58,
            58,
            58,
            68,
            68,
            68
        ]
    },
    {
        "name": "2pattern_0_V-067_A033.mid",
        "valence": 1,
        "arousal": 4,
        "sequence": [
            41,
            41,
            41,
            0,
            41,
            41,
            0,
            0,
            60,
            92,
            0,
            91,
            0,
            55,
            55,
            0
        ]
    },
    {
        "name": "2pattern_0_V-067_A067.mid",
        "valence": 1,
        "arousal": 5,
        "sequence": [
            82,
            0,
            0,
            82,
            0,
            82,
            82,
            0,
            82,
            70,
            82,
            0,
            82,
            0,
            81,
            0
        ]
    },
    {
        "name": "2pattern_0_V-067_A10.mid",
        "valence": 1,
        "arousal": 6,
        "sequence": [
            50,
            0,
            0,
            0,
            50,
            0,
            0,
            50,
            0,
            0,
            74,
            0,
            69,
            72,
            0,
            71
        ]
    },
    {
        "name": "2pattern_0_V-10_A-033.mid",
        "valence": 0,
        "arousal": 2,
        "sequence": [
            62,
            0,
            0,
            0,
            0,
            53,
            0,
            63,
            0,
            0,
            0,
            0,
            0,
            37,
            0,
            65
        ]
    },
    {
        "name": "2pattern_0_V-10_A-067.mid",
        "valence": 0,
        "arousal": 1,
        "sequence": [
            52,
            52,
            40,
            52,
            66,
            66,
            65,
            56,
            59,
            65,
            65,
            66,
            66,
            54,
            66,
            42
        ]
    },
    {
        "name": "2pattern_0_V-10_A-10.mid",
        "valence": 0,
        "arousal": 0,
        "sequence": [
            77,
            70,
            75,
            70,
            0,
            0,
            71,
            0,
            67,
            62,
            66,
            64,
            0,
            0,
            64,
            67
        ]
    },
    {
        "name": "2pattern_0_V-10_A00.mid",
        "valence": 0,
        "arousal": 3,
        "sequence": [
            52,
            0,
            0,
            51,
            0,
            49,
            47,
            47,
            47,
            47,
            47,
            66,
            0,
            64,
            66,
            66
        ]
    },
    {
        "name": "2pattern_0_V-10_A033.mid",
        "valence": 0,
        "arousal": 4,
        "sequence": [
            70,
            70,
            70,
            70,
            0,
            0,
            79,
            0,
            79,
            0,
            79,
            0,
            79,
            0,
            72,
            0
        ]
    },
    {
        "name": "2pattern_0_V-10_A067.mid",
        "valence": 0,
        "arousal": 5,
        "sequence": [
            58,
            58,
            58,
            58,
            58,
            0,
            55,
            55,
            0,
            55,
            0,
            38,
            55,
            38,
            0,
            53
        ]
    },
    {
        "name": "2pattern_0_V-10_A10.mid",
        "valence": 0,
        "arousal": 6,
        "sequence": [
            77,
            0,
            81,
            74,
            0,
            62,
            0,
            69,
            82,
            82,
            0,
            81,
            72,
            0,
            76,
            72
        ]
    },
    {
        "name": "2pattern_0_V00_A-033.mid",
        "valence": 3,
        "arousal": 2,
        "sequence": [
            60,
            55,
            62,
            60,
            60,
            63,
            60,
            60,
            0,
            60,
            0,
            67,
            60,
            0,
            0,
            48
        ]
    },
    {
        "name": "2pattern_0_V00_A-067.mid",
        "valence": 3,
        "arousal": 1,
        "sequence": [
            36,
            48,
            48,
            46,
            46,
            43,
            43,
            43,
            43,
            43,
            48,
            48,
            46,
            46,
            0,
            0
        ]
    },
    {
        "name": "2pattern_0_V00_A-10.mid",
        "valence": 3,
        "arousal": 0,
        "sequence": [
            63,
            63,
            54,
            61,
            56,
            59,
            59,
            58,
            64,
            54,
            59,
            54,
            64,
            52,
            69,
            57
        ]
    },
    {
        "name": "2pattern_0_V00_A00.mid",
        "valence": 3,
        "arousal": 3,
        "sequence": [
            67,
            67,
            67,
            69,
            69,
            69,
            67,
            67,
            67,
            69,
            69,
            69,
            70,
            0,
            70,
            70
        ]
    },
    {
        "name": "2pattern_0_V00_A033.mid",
        "valence": 3,
        "arousal": 4,
        "sequence": [
            76,
            78,
            78,
            0,
            0,
            81,
            81,
            0,
            79,
            79,
            79,
            79,
            79,
            79,
            79,
            79
        ]
    },
    {
        "name": "2pattern_0_V00_A067.mid",
        "valence": 3,
        "arousal": 5,
        "sequence": [
            29,
            29,
            0,
            0,
            29,
            29,
            34,
            0,
            34,
            0,
            0,
            34,
            0,
            0,
            0,
            0
        ]
    },
    {
        "name": "2pattern_0_V00_A10.mid",
        "valence": 3,
        "arousal": 6,
        "sequence": [
            69,
            0,
            69,
            69,
            0,
            0,
            0,
            0,
            0,
            63,
            65,
            65,
            65,
            0,
            70,
            77
        ]
    },
    {
        "name": "2pattern_0_V033_A-033.mid",
        "valence": 4,
        "arousal": 2,
        "sequence": [
            67,
            68,
            72,
            70,
            73,
            72,
            73,
            72,
            0,
            70,
            68,
            58,
            0,
            61,
            53,
            54
        ]
    },
    {
        "name": "2pattern_0_V033_A-067.mid",
        "valence": 4,
        "arousal": 1,
        "sequence": [
            73,
            0,
            0,
            0,
            0,
            51,
            58,
            66,
            0,
            65,
            0,
            0,
            53,
            53,
            53,
            53
        ]
    },
    {
        "name": "2pattern_0_V033_A-10.mid",
        "valence": 4,
        "arousal": 0,
        "sequence": [
            34,
            0,
            0,
            0,
            37,
            39,
            41,
            39,
            0,
            43,
            44,
            0,
            37,
            42,
            0,
            35
        ]
    },
    {
        "name": "2pattern_0_V033_A00.mid",
        "valence": 4,
        "arousal": 3,
        "sequence": [
            56,
            56,
            59,
            56,
            0,
            0,
            56,
            0,
            56,
            56,
            0,
            56,
            0,
            56,
            0,
            52
        ]
    },
    {
        "name": "2pattern_0_V033_A033.mid",
        "valence": 4,
        "arousal": 4,
        "sequence": [
            56,
            77,
            77,
            77,
            65,
            56,
            65,
            56,
            65,
            56,
            73,
            65,
            0,
            56,
            56,
            56
        ]
    },
    {
        "name": "2pattern_0_V033_A067.mid",
        "valence": 4,
        "arousal": 5,
        "sequence": [
            58,
            58,
            0,
            58,
            58,
            0,
            58,
            65,
            58,
            58,
            58,
            58,
            0,
            51,
            0,
            55
        ]
    },
    {
        "name": "2pattern_0_V033_A10.mid",
        "valence": 4,
        "arousal": 6,
        "sequence": [
            71,
            0,
            71,
            71,
            71,
            71,
            71,
            71,
            0,
            71,
            0,
            71,
            0,
            0,
            66,
            0
        ]
    },
    {
        "name": "2pattern_0_V067_A-033.mid",
        "valence": 5,
        "arousal": 2,
        "sequence": [
            79,
            79,
            77,
            0,
            76,
            0,
            74,
            74,
            74,
            73,
            69,
            71,
            66,
            0,
            66,
            62
        ]
    },
    {
        "name": "2pattern_0_V067_A-067.mid",
        "valence": 5,
        "arousal": 1,
        "sequence": [
            65,
            64,
            58,
            60,
            0,
            60,
            60,
            62,
            0,
            60,
            60,
            0,
            0,
            54,
            0,
            0
        ]
    },
    {
        "name": "2pattern_0_V067_A-10.mid",
        "valence": 5,
        "arousal": 0,
        "sequence": [
            33,
            33,
            40,
            28,
            40,
            0,
            30,
            30,
            30,
            31,
            33,
            0,
            35,
            40,
            40,
            38
        ]
    },
    {
        "name": "2pattern_0_V067_A00.mid",
        "valence": 5,
        "arousal": 3,
        "sequence": [
            69,
            69,
            0,
            64,
            64,
            57,
            57,
            62,
            57,
            57,
            66,
            0,
            0,
            66,
            66,
            66
        ]
    },
    {
        "name": "2pattern_0_V067_A033.mid",
        "valence": 5,
        "arousal": 4,
        "sequence": [
            41,
            41,
            0,
            41,
            41,
            41,
            41,
            41,
            41,
            41,
            41,
            0,
            60,
            0,
            0,
            0
        ]
    },
    {
        "name": "2pattern_0_V067_A067.mid",
        "valence": 5,
        "arousal": 5,
        "sequence": [
            63,
            63,
            63,
            0,
            63,
            63,
            63,
            63,
            63,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        ]
    },
    {
        "name": "2pattern_0_V067_A10.mid",
        "valence": 5,
        "arousal": 6,
        "sequence": [
            70,
            55,
            55,
            55,
            55,
            55,
            55,
            55,
            55,
            60,
            60,
            60,
            60,
            60,
            0,
            60
        ]
    },
    {
        "name": "2pattern_0_V10_A-033.mid",
        "valence": 6,
        "arousal": 2,
        "sequence": [
            60,
            64,
            60,
            64,
            64,
            64,
            64,
            64,
            64,
            64,
            64,
            64,
            64,
            0,
            0,
            0
        ]
    },
    {
        "name": "2pattern_0_V10_A-067.mid",
        "valence": 6,
        "arousal": 1,
        "sequence": [
            55,
            57,
            55,
            55,
            65,
            62,
            60,
            71,
            69,
            69,
            69,
            69,
            67,
            76,
            81,
            81
        ]
    },
    {
        "name": "2pattern_0_V10_A-10.mid",
        "valence": 6,
        "arousal": 0,
        "sequence": [
            51,
            67,
            0,
            70,
            0,
            67,
            0,
            70,
            0,
            70,
            0,
            70,
            0,
            70,
            70,
            0
        ]
    },
    {
        "name": "2pattern_0_V10_A00.mid",
        "valence": 6,
        "arousal": 3,
        "sequence": [
            62,
            0,
            62,
            50,
            55,
            50,
            50,
            50,
            50,
            50,
            50,
            0,
            0,
            50,
            50,
            50
        ]
    },
    {
        "name": "2pattern_0_V10_A033.mid",
        "valence": 6,
        "arousal": 4,
        "sequence": [
            61,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        ]
    },
    {
        "name": "2pattern_0_V10_A067.mid",
        "valence": 6,
        "arousal": 5,
        "sequence": [
            62,
            62,
            62,
            62,
            62,
            62,
            62,
            62,
            62,
            62,
            0,
            57,
            0,
            69,
            57,
            57
        ]
    },
    {
        "name": "2pattern_0_V10_A10.mid",
        "valence": 6,
        "arousal": 6,
        "sequence": [
            53,
            0,
            55,
            68,
            0,
            68,
            0,
            68,
            68,
            72,
            0,
            72,
            72,
            72,
            72,
            72
        ]
    },
    {
        "name": "3pattern__0_V-033_A-033.mid",
        "valence": "",
        "arousal": 2,
        "sequence": [
            61,
            63,
            0,
            68,
            51,
            58,
            0,
            0,
            0,
            0,
            63,
            0,
            0,
            0,
            0,
            0
        ]
    },
    {
        "name": "3pattern__0_V-033_A-067.mid",
        "valence": "",
        "arousal": 2,
        "sequence": [
            71,
            0,
            0,
            0,
            67,
            67,
            67,
            0,
            0,
            62,
            67,
            66,
            62,
            76,
            78,
            74
        ]
    },
    {
        "name": "3pattern__0_V-033_A-10.mid",
        "valence": "",
        "arousal": 2,
        "sequence": [
            66,
            66,
            62,
            69,
            59,
            69,
            0,
            71,
            71,
            73,
            68,
            73,
            69,
            71,
            66,
            66
        ]
    },
    {
        "name": "3pattern__0_V-033_A00.mid",
        "valence": "",
        "arousal": 2,
        "sequence": [
            41,
            41,
            41,
            41,
            41,
            41,
            41,
            41,
            41,
            41,
            41,
            41,
            41,
            41,
            41,
            41
        ]
    },
    {
        "name": "3pattern__0_V-033_A033.mid",
        "valence": "",
        "arousal": 2,
        "sequence": [
            30,
            30,
            0,
            30,
            35,
            0,
            0,
            35,
            0,
            0,
            30,
            30,
            30,
            0,
            30,
            30
        ]
    },
    {
        "name": "3pattern__0_V-033_A067.mid",
        "valence": "",
        "arousal": 2,
        "sequence": [
            40,
            45,
            0,
            0,
            0,
            0,
            45,
            0,
            0,
            40,
            33,
            0,
            33,
            40,
            33,
            35
        ]
    },
    {
        "name": "3pattern__0_V-033_A10.mid",
        "valence": "",
        "arousal": 2,
        "sequence": [
            67,
            0,
            67,
            0,
            67,
            67,
            0,
            67,
            0,
            67,
            67,
            0,
            67,
            0,
            67,
            67
        ]
    },
    {
        "name": "3pattern__0_V-067_A-033.mid",
        "valence": "",
        "arousal": 1,
        "sequence": [
            55,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            55,
            65,
            60,
            67,
            60,
            67
        ]
    },
    {
        "name": "3pattern__0_V-067_A-067.mid",
        "valence": "",
        "arousal": 1,
        "sequence": [
            59,
            59,
            59,
            55,
            55,
            55,
            55,
            55,
            55,
            67,
            69,
            69,
            69,
            69,
            69,
            67
        ]
    },
    {
        "name": "3pattern__0_V-067_A-10.mid",
        "valence": "",
        "arousal": 1,
        "sequence": [
            68,
            0,
            70,
            70,
            41,
            53,
            53,
            56,
            51,
            51,
            60,
            44,
            60,
            51,
            49,
            53
        ]
    },
    {
        "name": "3pattern__0_V-067_A00.mid",
        "valence": "",
        "arousal": 1,
        "sequence": [
            48,
            48,
            48,
            48,
            46,
            48,
            43,
            46,
            43,
            46,
            50,
            46,
            51,
            53,
            51,
            53
        ]
    },
    {
        "name": "3pattern__0_V-067_A033.mid",
        "valence": "",
        "arousal": 1,
        "sequence": [
            58,
            58,
            58,
            58,
            58,
            58,
            58,
            58,
            58,
            58,
            58,
            58,
            58,
            58,
            58,
            58
        ]
    },
    {
        "name": "3pattern__0_V-067_A067.mid",
        "valence": "",
        "arousal": 1,
        "sequence": [
            67,
            67,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            66,
            0,
            66,
            66
        ]
    },
    {
        "name": "3pattern__0_V-067_A10.mid",
        "valence": "",
        "arousal": 1,
        "sequence": [
            63,
            63,
            63,
            63,
            60,
            60,
            60,
            60,
            60,
            60,
            60,
            60,
            60,
            60,
            60,
            60
        ]
    },
    {
        "name": "3pattern__0_V-10_A-033.mid",
        "valence": "",
        "arousal": 0,
        "sequence": [
            55,
            59,
            59,
            62,
            59,
            59,
            59,
            59,
            59,
            54,
            54,
            54,
            54,
            54,
            54,
            54
        ]
    },
    {
        "name": "3pattern__0_V-10_A-067.mid",
        "valence": "",
        "arousal": 0,
        "sequence": [
            58,
            58,
            58,
            58,
            55,
            55,
            55,
            53,
            53,
            53,
            53,
            53,
            53,
            53,
            53,
            53
        ]
    },
    {
        "name": "3pattern__0_V-10_A-10.mid",
        "valence": "",
        "arousal": 0,
        "sequence": [
            63,
            58,
            45,
            43,
            58,
            55,
            57,
            57,
            55,
            65,
            53,
            57,
            57,
            58,
            58,
            50
        ]
    },
    {
        "name": "3pattern__0_V-10_A00.mid",
        "valence": "",
        "arousal": 0,
        "sequence": [
            32,
            44,
            44,
            32,
            44,
            32,
            44,
            32,
            44,
            0,
            32,
            32,
            32,
            32,
            32,
            32
        ]
    },
    {
        "name": "3pattern__0_V-10_A033.mid",
        "valence": "",
        "arousal": 0,
        "sequence": [
            72,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        ]
    },
    {
        "name": "3pattern__0_V-10_A067.mid",
        "valence": "",
        "arousal": 0,
        "sequence": [
            33,
            33,
            33,
            33,
            33,
            33,
            33,
            33,
            33,
            33,
            0,
            33,
            33,
            33,
            33,
            33
        ]
    },
    {
        "name": "3pattern__0_V-10_A10.mid",
        "valence": "",
        "arousal": 0,
        "sequence": [
            64,
            0,
            0,
            66,
            0,
            67,
            67,
            52,
            52,
            52,
            52,
            52,
            52,
            52,
            52,
            52
        ]
    },
    {
        "name": "3pattern__0_V00_A-033.mid",
        "valence": "",
        "arousal": 3,
        "sequence": [
            70,
            70,
            70,
            70,
            70,
            70,
            70,
            70,
            70,
            70,
            70,
            70,
            70,
            70,
            70,
            70
        ]
    },
    {
        "name": "3pattern__0_V00_A-067.mid",
        "valence": "",
        "arousal": 3,
        "sequence": [
            64,
            0,
            0,
            64,
            0,
            0,
            64,
            0,
            59,
            0,
            0,
            58,
            0,
            0,
            0,
            0
        ]
    },
    {
        "name": "3pattern__0_V00_A-10.mid",
        "valence": "",
        "arousal": 3,
        "sequence": [
            63,
            0,
            66,
            0,
            89,
            87,
            90,
            92,
            90,
            90,
            90,
            0,
            77,
            0,
            75,
            0
        ]
    },
    {
        "name": "3pattern__0_V00_A00.mid",
        "valence": "",
        "arousal": 3,
        "sequence": [
            39,
            0,
            0,
            42,
            0,
            0,
            0,
            44,
            0,
            44,
            0,
            0,
            0,
            44,
            44,
            0
        ]
    },
    {
        "name": "3pattern__0_V00_A033.mid",
        "valence": "",
        "arousal": 3,
        "sequence": [
            84,
            0,
            0,
            0,
            70,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            70,
            0,
            70,
            67
        ]
    },
    {
        "name": "3pattern__0_V00_A067.mid",
        "valence": "",
        "arousal": 3,
        "sequence": [
            66,
            0,
            0,
            0,
            0,
            66,
            0,
            0,
            66,
            0,
            0,
            66,
            0,
            0,
            66,
            0
        ]
    },
    {
        "name": "3pattern__0_V00_A10.mid",
        "valence": "",
        "arousal": 3,
        "sequence": [
            57,
            57,
            57,
            57,
            57,
            57,
            57,
            57,
            57,
            0,
            57,
            0,
            57,
            57,
            57,
            57
        ]
    },
    {
        "name": "3pattern__0_V033_A-033.mid",
        "valence": "",
        "arousal": 4,
        "sequence": [
            66,
            66,
            0,
            66,
            66,
            0,
            66,
            66,
            0,
            66,
            66,
            0,
            66,
            0,
            66,
            66
        ]
    },
    {
        "name": "3pattern__0_V033_A-067.mid",
        "valence": "",
        "arousal": 4,
        "sequence": [
            45,
            0,
            0,
            41,
            40,
            0,
            38,
            0,
            36,
            0,
            0,
            0,
            33,
            0,
            0,
            0
        ]
    },
    {
        "name": "3pattern__0_V033_A-10.mid",
        "valence": "",
        "arousal": 4,
        "sequence": [
            65,
            62,
            51,
            53,
            58,
            60,
            51,
            56,
            63,
            55,
            60,
            68,
            68,
            68,
            68,
            67
        ]
    },
    {
        "name": "3pattern__0_V033_A00.mid",
        "valence": "",
        "arousal": 4,
        "sequence": [
            57,
            59,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            54,
            0,
            0,
            0,
            0,
            0,
            54
        ]
    },
    {
        "name": "3pattern__0_V033_A033.mid",
        "valence": "",
        "arousal": 4,
        "sequence": [
            32,
            32,
            32,
            32,
            0,
            0,
            0,
            0,
            25,
            0,
            25,
            0,
            25,
            25,
            0,
            25
        ]
    },
    {
        "name": "3pattern__0_V033_A067.mid",
        "valence": "",
        "arousal": 4,
        "sequence": [
            64,
            0,
            0,
            0,
            64,
            0,
            0,
            64,
            0,
            0,
            0,
            64,
            0,
            0,
            0,
            64
        ]
    },
    {
        "name": "3pattern__0_V033_A10.mid",
        "valence": "",
        "arousal": 4,
        "sequence": [
            73,
            73,
            0,
            73,
            0,
            73,
            73,
            73,
            73,
            73,
            73,
            73,
            73,
            73,
            73,
            73
        ]
    },
    {
        "name": "3pattern__0_V067_A-033.mid",
        "valence": "",
        "arousal": 5,
        "sequence": [
            43,
            43,
            43,
            43,
            46,
            48,
            46,
            48,
            46,
            44,
            48,
            39,
            0,
            42,
            0,
            44
        ]
    },
    {
        "name": "3pattern__0_V067_A-067.mid",
        "valence": "",
        "arousal": 5,
        "sequence": [
            34,
            34,
            34,
            34,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        ]
    },
    {
        "name": "3pattern__0_V067_A-10.mid",
        "valence": "",
        "arousal": 5,
        "sequence": [
            61,
            59,
            44,
            61,
            61,
            58,
            60,
            41,
            60,
            0,
            0,
            67,
            65,
            53,
            61,
            63
        ]
    },
    {
        "name": "3pattern__0_V067_A00.mid",
        "valence": "",
        "arousal": 5,
        "sequence": [
            69,
            62,
            0,
            0,
            62,
            57,
            62,
            60,
            60,
            60,
            48,
            48,
            48,
            48,
            48,
            55
        ]
    },
    {
        "name": "3pattern__0_V067_A033.mid",
        "valence": "",
        "arousal": 5,
        "sequence": [
            68,
            0,
            68,
            0,
            68,
            0,
            0,
            68,
            0,
            68,
            0,
            0,
            68,
            0,
            0,
            0
        ]
    },
    {
        "name": "3pattern__0_V067_A067.mid",
        "valence": "",
        "arousal": 5,
        "sequence": [
            73,
            71,
            66,
            71,
            66,
            69,
            0,
            66,
            66,
            42,
            42,
            42,
            42,
            42,
            42,
            42
        ]
    },
    {
        "name": "3pattern__0_V067_A10.mid",
        "valence": "",
        "arousal": 5,
        "sequence": [
            80,
            0,
            80,
            80,
            80,
            80,
            80,
            80,
            0,
            80,
            52,
            52,
            0,
            52,
            52,
            52
        ]
    },
    {
        "name": "3pattern__0_V10_A-033.mid",
        "valence": "",
        "arousal": 6,
        "sequence": [
            70,
            0,
            70,
            0,
            69,
            70,
            0,
            69,
            69,
            69,
            69,
            69,
            69,
            69,
            69,
            69
        ]
    },
    {
        "name": "3pattern__0_V10_A-067.mid",
        "valence": "",
        "arousal": 6,
        "sequence": [
            39,
            39,
            44,
            0,
            37,
            0,
            37,
            44,
            44,
            42,
            37,
            0,
            42,
            42,
            42,
            42
        ]
    },
    {
        "name": "3pattern__0_V10_A-10.mid",
        "valence": "",
        "arousal": 6,
        "sequence": [
            59,
            0,
            66,
            64,
            47,
            68,
            69,
            68,
            69,
            64,
            52,
            61,
            59,
            49,
            64,
            49
        ]
    },
    {
        "name": "3pattern__0_V10_A00.mid",
        "valence": "",
        "arousal": 6,
        "sequence": [
            66,
            0,
            0,
            66,
            66,
            66,
            66,
            66,
            64,
            64,
            64,
            64,
            64,
            64,
            64,
            64
        ]
    },
    {
        "name": "3pattern__0_V10_A033.mid",
        "valence": "",
        "arousal": 6,
        "sequence": [
            72,
            0,
            0,
            72,
            0,
            0,
            72,
            0,
            0,
            75,
            0,
            0,
            72,
            0,
            0,
            72
        ]
    },
    {
        "name": "3pattern__0_V10_A067.mid",
        "valence": "",
        "arousal": 6,
        "sequence": [
            57,
            0,
            57,
            42,
            0,
            42,
            57,
            45,
            0,
            0,
            57,
            57,
            57,
            0,
            59,
            62
        ]
    },
    {
        "name": "3pattern__0_V10_A10.mid",
        "valence": "",
        "arousal": 6,
        "sequence": [
            59,
            0,
            59,
            0,
            59,
            0,
            59,
            0,
            52,
            0,
            57,
            0,
            40,
            0,
            57,
            0
        ]
    },
    {
        "name": "pattern_0_V-033_A-033.mid",
        "valence": 2,
        "arousal": 2,
        "sequence": [
            72,
            0,
            72,
            72,
            0,
            72,
            72,
            72,
            72,
            76,
            0,
            62,
            0,
            0,
            0,
            0
        ]
    },
    {
        "name": "pattern_0_V-033_A-067.mid",
        "valence": 2,
        "arousal": 1,
        "sequence": [
            63,
            0,
            0,
            75,
            0,
            73,
            61,
            0,
            0,
            61,
            63,
            61,
            63,
            0,
            61,
            0
        ]
    },
    {
        "name": "pattern_0_V-033_A-10.mid",
        "valence": 2,
        "arousal": 0,
        "sequence": [
            61,
            61,
            61,
            64,
            61,
            61,
            57,
            62,
            59,
            66,
            52,
            57,
            49,
            52,
            59,
            54
        ]
    },
    {
        "name": "pattern_0_V-033_A00.mid",
        "valence": 2,
        "arousal": 3,
        "sequence": [
            64,
            0,
            0,
            0,
            0,
            67,
            67,
            67,
            67,
            67,
            67,
            67,
            67,
            70,
            70,
            70
        ]
    },
    {
        "name": "pattern_0_V-033_A033.mid",
        "valence": 2,
        "arousal": 4,
        "sequence": [
            56,
            0,
            56,
            0,
            56,
            0,
            56,
            0,
            56,
            0,
            63,
            71,
            71,
            71,
            0,
            73
        ]
    },
    {
        "name": "pattern_0_V-033_A067.mid",
        "valence": 2,
        "arousal": 5,
        "sequence": [
            50,
            0,
            54,
            66,
            0,
            0,
            0,
            0,
            66,
            66,
            66,
            66,
            66,
            66,
            66,
            66
        ]
    },
    {
        "name": "pattern_0_V-033_A10.mid",
        "valence": 2,
        "arousal": 6,
        "sequence": [
            68,
            71,
            42,
            42,
            64,
            42,
            42,
            42,
            42,
            42,
            42,
            42,
            71,
            66,
            69,
            45
        ]
    },
    {
        "name": "pattern_0_V-067_A-033.mid",
        "valence": 1,
        "arousal": 2,
        "sequence": [
            57,
            64,
            57,
            66,
            0,
            66,
            66,
            45,
            57,
            60,
            66,
            60,
            66,
            0,
            64,
            0
        ]
    },
    {
        "name": "pattern_0_V-067_A-067.mid",
        "valence": 1,
        "arousal": 1,
        "sequence": [
            62,
            0,
            70,
            62,
            69,
            60,
            69,
            60,
            69,
            69,
            81,
            81,
            69,
            0,
            0,
            0
        ]
    },
    {
        "name": "pattern_0_V-067_A-10.mid",
        "valence": 1,
        "arousal": 0,
        "sequence": [
            58,
            53,
            60,
            58,
            58,
            0,
            53,
            0,
            62,
            65,
            67,
            67,
            62,
            65,
            50,
            55
        ]
    },
    {
        "name": "pattern_0_V-067_A00.mid",
        "valence": 1,
        "arousal": 3,
        "sequence": [
            63,
            0,
            0,
            0,
            71,
            0,
            0,
            44,
            0,
            46,
            0,
            0,
            0,
            0,
            0,
            67
        ]
    },
    {
        "name": "pattern_0_V-067_A033.mid",
        "valence": 1,
        "arousal": 4,
        "sequence": [
            43,
            43,
            0,
            41,
            41,
            0,
            0,
            0,
            0,
            0,
            0,
            71,
            0,
            68,
            71,
            66
        ]
    },
    {
        "name": "pattern_0_V-067_A067.mid",
        "valence": 1,
        "arousal": 5,
        "sequence": [
            61,
            61,
            61,
            61,
            61,
            61,
            64,
            64,
            64,
            64,
            64,
            64,
            0,
            69,
            0,
            73
        ]
    },
    {
        "name": "pattern_0_V-067_A10.mid",
        "valence": 1,
        "arousal": 6,
        "sequence": [
            50,
            50,
            50,
            48,
            48,
            48,
            48,
            48,
            48,
            48,
            48,
            48,
            48,
            48,
            48,
            48
        ]
    },
    {
        "name": "pattern_0_V-10_A-033.mid",
        "valence": 0,
        "arousal": 2,
        "sequence": [
            64,
            45,
            64,
            45,
            33,
            57,
            33,
            33,
            57,
            0,
            50,
            57,
            59,
            62,
            0,
            60
        ]
    },
    {
        "name": "pattern_0_V-10_A-067.mid",
        "valence": 0,
        "arousal": 1,
        "sequence": [
            73,
            73,
            64,
            73,
            73,
            68,
            64,
            64,
            68,
            64,
            64,
            64,
            68,
            66,
            68,
            59
        ]
    },
    {
        "name": "pattern_0_V-10_A-10.mid",
        "valence": 0,
        "arousal": 0,
        "sequence": [
            63,
            60,
            60,
            61,
            63,
            61,
            0,
            56,
            58,
            56,
            60,
            63,
            65,
            61,
            67,
            67
        ]
    },
    {
        "name": "pattern_0_V-10_A00.mid",
        "valence": 0,
        "arousal": 3,
        "sequence": [
            52,
            52,
            0,
            52,
            52,
            64,
            64,
            0,
            64,
            64,
            0,
            64,
            0,
            64,
            64,
            0
        ]
    },
    {
        "name": "pattern_0_V-10_A033.mid",
        "valence": 0,
        "arousal": 4,
        "sequence": [
            32,
            32,
            32,
            32,
            32,
            32,
            32,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        ]
    },
    {
        "name": "pattern_0_V-10_A067.mid",
        "valence": 0,
        "arousal": 5,
        "sequence": [
            25,
            25,
            28,
            0,
            25,
            28,
            33,
            33,
            33,
            33,
            33,
            33,
            33,
            33,
            33,
            33
        ]
    },
    {
        "name": "pattern_0_V-10_A10.mid",
        "valence": 0,
        "arousal": 6,
        "sequence": [
            47,
            47,
            47,
            47,
            0,
            52,
            40,
            52,
            52,
            52,
            52,
            52,
            52,
            52,
            52,
            52
        ]
    },
    {
        "name": "pattern_0_V00_A-033.mid",
        "valence": 3,
        "arousal": 2,
        "sequence": [
            78,
            76,
            73,
            78,
            69,
            54,
            69,
            54,
            69,
            0,
            74,
            0,
            0,
            0,
            0,
            0
        ]
    },
    {
        "name": "pattern_0_V00_A-067.mid",
        "valence": 3,
        "arousal": 1,
        "sequence": [
            61,
            59,
            52,
            52,
            66,
            66,
            66,
            71,
            73,
            0,
            0,
            61,
            61,
            66,
            66,
            66
        ]
    },
    {
        "name": "pattern_0_V00_A-10.mid",
        "valence": 3,
        "arousal": 0,
        "sequence": [
            57,
            55,
            53,
            52,
            55,
            48,
            0,
            0,
            0,
            48,
            0,
            55,
            59,
            60,
            47,
            0
        ]
    },
    {
        "name": "pattern_0_V00_A00.mid",
        "valence": 3,
        "arousal": 3,
        "sequence": [
            67,
            0,
            64,
            0,
            0,
            64,
            0,
            0,
            60,
            64,
            64,
            0,
            64,
            64,
            64,
            0
        ]
    },
    {
        "name": "pattern_0_V00_A033.mid",
        "valence": 3,
        "arousal": 4,
        "sequence": [
            40,
            26,
            38,
            40,
            40,
            40,
            40,
            40,
            40,
            38,
            50,
            50,
            38,
            0,
            0,
            38
        ]
    },
    {
        "name": "pattern_0_V00_A067.mid",
        "valence": 3,
        "arousal": 5,
        "sequence": [
            31,
            0,
            0,
            38,
            39,
            39,
            39,
            39,
            0,
            39,
            39,
            73,
            68,
            75,
            70,
            0
        ]
    },
    {
        "name": "pattern_0_V00_A10.mid",
        "valence": 3,
        "arousal": 6,
        "sequence": [
            72,
            72,
            72,
            68,
            72,
            0,
            72,
            63,
            63,
            0,
            0,
            63,
            0,
            62,
            62,
            62
        ]
    },
    {
        "name": "pattern_0_V033_A-033.mid",
        "valence": 4,
        "arousal": 2,
        "sequence": [
            57,
            57,
            58,
            53,
            53,
            53,
            60,
            59,
            53,
            53,
            50,
            50,
            62,
            60,
            60,
            60
        ]
    },
    {
        "name": "pattern_0_V033_A-067.mid",
        "valence": 4,
        "arousal": 1,
        "sequence": [
            65,
            0,
            0,
            0,
            70,
            72,
            0,
            69,
            67,
            69,
            72,
            0,
            67,
            64,
            67,
            55
        ]
    },
    {
        "name": "pattern_0_V033_A-10.mid",
        "valence": 4,
        "arousal": 0,
        "sequence": [
            44,
            44,
            37,
            37,
            37,
            37,
            37,
            37,
            30,
            0,
            0,
            0,
            0,
            38,
            40,
            42
        ]
    },
    {
        "name": "pattern_0_V033_A00.mid",
        "valence": 4,
        "arousal": 3,
        "sequence": [
            69,
            0,
            69,
            0,
            0,
            67,
            0,
            67,
            67,
            0,
            67,
            0,
            0,
            0,
            0,
            0
        ]
    },
    {
        "name": "pattern_0_V033_A033.mid",
        "valence": 4,
        "arousal": 4,
        "sequence": [
            66,
            66,
            66,
            66,
            66,
            66,
            66,
            66,
            66,
            0,
            66,
            0,
            66,
            0,
            0,
            66
        ]
    },
    {
        "name": "pattern_0_V033_A067.mid",
        "valence": 4,
        "arousal": 5,
        "sequence": [
            64,
            64,
            52,
            64,
            71,
            74,
            66,
            66,
            66,
            66,
            0,
            69,
            0,
            69,
            54,
            0
        ]
    },
    {
        "name": "pattern_0_V033_A10.mid",
        "valence": 4,
        "arousal": 6,
        "sequence": [
            41,
            41,
            39,
            39,
            39,
            0,
            39,
            39,
            39,
            39,
            39,
            39,
            39,
            39,
            39,
            39
        ]
    },
    {
        "name": "pattern_0_V067_A-033.mid",
        "valence": 5,
        "arousal": 2,
        "sequence": [
            66,
            59,
            66,
            67,
            67,
            67,
            50,
            0,
            67,
            0,
            50,
            69,
            0,
            0,
            0,
            69
        ]
    },
    {
        "name": "pattern_0_V067_A-067.mid",
        "valence": 5,
        "arousal": 1,
        "sequence": [
            58,
            63,
            0,
            67,
            0,
            58,
            63,
            67,
            0,
            63,
            68,
            63,
            56,
            63,
            68,
            72
        ]
    },
    {
        "name": "pattern_0_V067_A-10.mid",
        "valence": 5,
        "arousal": 0,
        "sequence": [
            68,
            63,
            63,
            63,
            66,
            66,
            68,
            68,
            61,
            66,
            61,
            66,
            66,
            56,
            58,
            59
        ]
    },
    {
        "name": "pattern_0_V067_A00.mid",
        "valence": 5,
        "arousal": 3,
        "sequence": [
            54,
            0,
            42,
            49,
            61,
            0,
            0,
            47,
            0,
            0,
            59,
            63,
            0,
            63,
            63,
            0
        ]
    },
    {
        "name": "pattern_0_V067_A033.mid",
        "valence": 5,
        "arousal": 4,
        "sequence": [
            56,
            56,
            0,
            0,
            0,
            56,
            56,
            56,
            0,
            56,
            56,
            56,
            61,
            0,
            61,
            61
        ]
    },
    {
        "name": "pattern_0_V067_A067.mid",
        "valence": 5,
        "arousal": 5,
        "sequence": [
            65,
            0,
            65,
            67,
            60,
            65,
            65,
            65,
            65,
            65,
            65,
            0,
            65,
            0,
            65,
            65
        ]
    },
    {
        "name": "pattern_0_V067_A10.mid",
        "valence": 5,
        "arousal": 6,
        "sequence": [
            63,
            0,
            0,
            67,
            0,
            70,
            0,
            0,
            0,
            58,
            0,
            0,
            0,
            58,
            0,
            0
        ]
    },
    {
        "name": "pattern_0_V10_A-033.mid",
        "valence": 6,
        "arousal": 2,
        "sequence": [
            41,
            44,
            44,
            46,
            51,
            46,
            39,
            34,
            29,
            0,
            29,
            29,
            0,
            31,
            0,
            33
        ]
    },
    {
        "name": "pattern_0_V10_A-067.mid",
        "valence": 6,
        "arousal": 1,
        "sequence": [
            66,
            50,
            0,
            0,
            66,
            0,
            62,
            0,
            0,
            70,
            0,
            67,
            60,
            60,
            60,
            60
        ]
    },
    {
        "name": "pattern_0_V10_A-10.mid",
        "valence": 6,
        "arousal": 0,
        "sequence": [
            60,
            62,
            0,
            63,
            0,
            62,
            65,
            65,
            67,
            65,
            58,
            0,
            60,
            62,
            63,
            0
        ]
    },
    {
        "name": "pattern_0_V10_A00.mid",
        "valence": 6,
        "arousal": 3,
        "sequence": [
            63,
            62,
            55,
            55,
            0,
            55,
            55,
            55,
            55,
            0,
            55,
            62,
            55,
            55,
            0,
            58
        ]
    },
    {
        "name": "pattern_0_V10_A033.mid",
        "valence": 6,
        "arousal": 4,
        "sequence": [
            66,
            0,
            66,
            0,
            66,
            0,
            66,
            0,
            66,
            0,
            66,
            0,
            0,
            66,
            0,
            0
        ]
    },
    {
        "name": "pattern_0_V10_A067.mid",
        "valence": 6,
        "arousal": 5,
        "sequence": [
            61,
            68,
            56,
            68,
            68,
            68,
            68,
            68,
            68,
            68,
            68,
            69,
            0,
            69,
            69,
            69
        ]
    },
    {
        "name": "pattern_0_V10_A10.mid",
        "valence": 6,
        "arousal": 6,
        "sequence": [
            63,
            63,
            63,
            63,
            72,
            63,
            0,
            63,
            68,
            63,
            63,
            0,
            75,
            74,
            72,
            63
        ]
    }
];

*/