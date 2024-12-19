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
        res.send(JSON.stringify(notes.sequence1));
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
        "name": "pattern_0_V-033_A-033.mid",
        "valence": 2,
        "arousal": 2,
        "sequence1": [
            0,
            0,
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
            0
        ],
        "sequence2": [
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
            0,
            0
        ]
    },
    {
        "name": "pattern_0_V-033_A-067.mid",
        "valence": 2,
        "arousal": 1,
        "sequence1": [
            0,
            0,
            0,
            0,
            0,
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
            63
        ],
        "sequence2": [
            61,
            63,
            0,
            61,
            0,
            73,
            71,
            73,
            0,
            73,
            73,
            0,
            73,
            73,
            71,
            69
        ]
    },
    {
        "name": "pattern_0_V-033_A-10.mid",
        "valence": 2,
        "arousal": 0,
        "sequence1": [
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
        ],
        "sequence2": [
            59,
            54,
            54,
            57,
            50,
            54,
            54,
            55,
            52,
            54,
            54,
            52,
            49,
            45,
            52,
            55
        ]
    },
    {
        "name": "pattern_0_V-033_A00.mid",
        "valence": 2,
        "arousal": 3,
        "sequence1": [
            0,
            0,
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
            70
        ],
        "sequence2": [
            70,
            70,
            70,
            67,
            70,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            69,
            0
        ]
    },
    {
        "name": "pattern_0_V-033_A033.mid",
        "valence": 2,
        "arousal": 4,
        "sequence1": [
            0,
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
            0
        ],
        "sequence2": [
            73,
            59,
            61,
            61,
            49,
            49,
            49,
            49,
            68,
            49,
            68,
            0,
            68,
            0,
            68,
            64
        ]
    },
    {
        "name": "pattern_0_V-033_A067.mid",
        "valence": 2,
        "arousal": 5,
        "sequence1": [
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
        ],
        "sequence2": [
            66,
            66,
            0,
            66,
            66,
            66,
            66,
            64,
            68,
            68,
            68,
            66,
            70,
            70,
            70,
            70
        ]
    },
    {
        "name": "pattern_0_V-033_A10.mid",
        "valence": 2,
        "arousal": 6,
        "sequence1": [
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
        ],
        "sequence2": [
            0,
            71,
            66,
            68,
            56,
            71,
            56,
            0,
            54,
            0,
            56,
            47,
            0,
            56,
            49,
            49
        ]
    },
    {
        "name": "pattern_0_V-067_A-033.mid",
        "valence": 1,
        "arousal": 2,
        "sequence1": [
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
        ],
        "sequence2": [
            0,
            64,
            63,
            0,
            59,
            66,
            64,
            63,
            0,
            58,
            0,
            0,
            0,
            42,
            0,
            0
        ]
    },
    {
        "name": "pattern_0_V-067_A-067.mid",
        "valence": 1,
        "arousal": 1,
        "sequence1": [
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
        ],
        "sequence2": [
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
            73,
            64,
            71,
            73
        ]
    },
    {
        "name": "pattern_0_V-067_A-10.mid",
        "valence": 1,
        "arousal": 0,
        "sequence1": [
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
        ],
        "sequence2": [
            57,
            54,
            59,
            55,
            59,
            50,
            50,
            55,
            53,
            48,
            57,
            52,
            45,
            45,
            52,
            50
        ]
    },
    {
        "name": "pattern_0_V-067_A00.mid",
        "valence": 1,
        "arousal": 3,
        "sequence1": [
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
        ],
        "sequence2": [
            0,
            0,
            51,
            66,
            66,
            66,
            66,
            66,
            66,
            66,
            66,
            66,
            66,
            66,
            66,
            70
        ]
    },
    {
        "name": "pattern_0_V-067_A033.mid",
        "valence": 1,
        "arousal": 4,
        "sequence1": [
            0,
            0,
            0,
            0,
            0,
            0,
            43,
            43,
            0,
            41,
            41,
            0,
            0,
            0,
            0,
            0
        ],
        "sequence2": [
            0,
            71,
            0,
            68,
            71,
            66,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            71,
            71,
            0
        ]
    },
    {
        "name": "pattern_0_V-067_A067.mid",
        "valence": 1,
        "arousal": 5,
        "sequence1": [
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
        ],
        "sequence2": [
            0,
            71,
            69,
            69,
            69,
            69,
            0,
            69,
            69,
            69,
            69,
            69,
            71,
            0,
            71,
            0
        ]
    },
    {
        "name": "pattern_0_V-067_A10.mid",
        "valence": 1,
        "arousal": 6,
        "sequence1": [
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
        ],
        "sequence2": [
            76,
            48,
            48,
            48,
            48,
            48,
            48,
            48,
            60,
            62,
            0,
            62,
            0,
            62,
            0,
            55
        ]
    },
    {
        "name": "pattern_0_V-10_A-033.mid",
        "valence": 0,
        "arousal": 2,
        "sequence1": [
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
        ],
        "sequence2": [
            40,
            40,
            45,
            0,
            0,
            64,
            0,
            69,
            0,
            69,
            0,
            50,
            65,
            50,
            69,
            69
        ]
    },
    {
        "name": "pattern_0_V-10_A-067.mid",
        "valence": 0,
        "arousal": 1,
        "sequence1": [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            73,
            73,
            64,
            73,
            73,
            68,
            64,
            64,
            68
        ],
        "sequence2": [
            64,
            64,
            64,
            68,
            66,
            68,
            59,
            68,
            0,
            68,
            64,
            61,
            49,
            64,
            59,
            68
        ]
    },
    {
        "name": "pattern_0_V-10_A-10.mid",
        "valence": 0,
        "arousal": 0,
        "sequence1": [
            0,
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
            67
        ],
        "sequence2": [
            67,
            63,
            60,
            58,
            63,
            62,
            63,
            62,
            63,
            53,
            53,
            55,
            50,
            62,
            50,
            53
        ]
    },
    {
        "name": "pattern_0_V-10_A00.mid",
        "valence": 0,
        "arousal": 3,
        "sequence1": [
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
            0,
            52
        ],
        "sequence2": [
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
            0,
            0
        ]
    },
    {
        "name": "pattern_0_V-10_A033.mid",
        "valence": 0,
        "arousal": 4,
        "sequence1": [
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
        ],
        "sequence2": [
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
            40,
            0,
            40,
            35,
            38
        ]
    },
    {
        "name": "pattern_0_V-10_A067.mid",
        "valence": 0,
        "arousal": 5,
        "sequence1": [
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
        ],
        "sequence2": [
            33,
            45,
            33,
            45,
            26,
            38,
            26,
            38,
            26,
            38,
            28,
            40,
            28,
            40,
            28,
            40
        ]
    },
    {
        "name": "pattern_0_V-10_A10.mid",
        "valence": 0,
        "arousal": 6,
        "sequence1": [
            0,
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
            52
        ],
        "sequence2": [
            52,
            52,
            52,
            52,
            52,
            52,
            52,
            50,
            50,
            50,
            50,
            50,
            0,
            50,
            0,
            50
        ]
    },
    {
        "name": "pattern_0_V00_A-033.mid",
        "valence": 3,
        "arousal": 2,
        "sequence1": [
            0,
            0,
            0,
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
            0
        ],
        "sequence2": [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            70,
            70,
            70,
            70,
            70,
            70,
            70,
            72,
            72
        ]
    },
    {
        "name": "pattern_0_V00_A-067.mid",
        "valence": 3,
        "arousal": 1,
        "sequence1": [
            0,
            0,
            0,
            0,
            0,
            0,
            61,
            59,
            52,
            52,
            66,
            66,
            66,
            71,
            73,
            0
        ],
        "sequence2": [
            0,
            61,
            61,
            66,
            66,
            66,
            66,
            66,
            69,
            66,
            38,
            66,
            50,
            50,
            50,
            0
        ]
    },
    {
        "name": "pattern_0_V00_A-10.mid",
        "valence": 3,
        "arousal": 0,
        "sequence1": [
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
        ],
        "sequence2": [
            40,
            38,
            0,
            48,
            43,
            52,
            43,
            50,
            45,
            50,
            42,
            50,
            42,
            45,
            47,
            57
        ]
    },
    {
        "name": "pattern_0_V00_A00.mid",
        "valence": 3,
        "arousal": 3,
        "sequence1": [
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
        ],
        "sequence2": [
            64,
            69,
            0,
            0,
            69,
            69,
            0,
            69,
            69,
            0,
            69,
            69,
            0,
            69,
            69,
            0
        ]
    },
    {
        "name": "pattern_0_V00_A033.mid",
        "valence": 3,
        "arousal": 4,
        "sequence1": [
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
        ],
        "sequence2": [
            0,
            26,
            0,
            0,
            38,
            38,
            0,
            38,
            33,
            0,
            45,
            0,
            33,
            45,
            0,
            33
        ]
    },
    {
        "name": "pattern_0_V00_A067.mid",
        "valence": 3,
        "arousal": 5,
        "sequence1": [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            31,
            0,
            0,
            38,
            39,
            39,
            39
        ],
        "sequence2": [
            39,
            0,
            39,
            39,
            73,
            68,
            75,
            70,
            0,
            36,
            0,
            75,
            0,
            0,
            72,
            36
        ]
    },
    {
        "name": "pattern_0_V00_A10.mid",
        "valence": 3,
        "arousal": 6,
        "sequence1": [
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
        ],
        "sequence2": [
            0,
            62,
            62,
            62,
            0,
            0,
            67,
            63,
            68,
            63,
            60,
            0,
            65,
            64,
            60,
            0
        ]
    },
    {
        "name": "pattern_0_V033_A-033.mid",
        "valence": 4,
        "arousal": 2,
        "sequence1": [
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
        ],
        "sequence2": [
            59,
            57,
            56,
            56,
            56,
            0,
            58,
            58,
            58,
            0,
            0,
            0,
            0,
            0,
            57,
            57
        ]
    },
    {
        "name": "pattern_0_V033_A-067.mid",
        "valence": 4,
        "arousal": 1,
        "sequence1": [
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
            65,
            0,
            0,
            0,
            70
        ],
        "sequence2": [
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
            55,
            60,
            0,
            64,
            0,
            64
        ]
    },
    {
        "name": "pattern_0_V033_A-10.mid",
        "valence": 4,
        "arousal": 0,
        "sequence1": [
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
        ],
        "sequence2": [
            42,
            42,
            0,
            0,
            0,
            45,
            47,
            0,
            47,
            49,
            0,
            0,
            40,
            42,
            42,
            42
        ]
    },
    {
        "name": "pattern_0_V033_A00.mid",
        "valence": 4,
        "arousal": 3,
        "sequence1": [
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
        ],
        "sequence2": [
            0,
            0,
            67,
            67,
            67,
            67,
            67,
            67,
            67,
            0,
            67,
            67,
            0,
            72,
            72,
            0
        ]
    },
    {
        "name": "pattern_0_V033_A033.mid",
        "valence": 4,
        "arousal": 4,
        "sequence1": [
            0,
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
            0
        ],
        "sequence2": [
            66,
            0,
            66,
            0,
            0,
            0,
            0,
            0,
            0,
            33,
            0,
            33,
            33,
            57,
            33,
            0
        ]
    },
    {
        "name": "pattern_0_V033_A067.mid",
        "valence": 4,
        "arousal": 5,
        "sequence1": [
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
            0,
            0
        ],
        "sequence2": [
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
        "sequence1": [
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
        ],
        "sequence2": [
            27,
            39,
            39,
            0,
            39,
            39,
            0,
            39,
            0,
            39,
            39,
            39,
            0,
            39,
            39,
            39
        ]
    },
    {
        "name": "pattern_0_V067_A-033.mid",
        "valence": 5,
        "arousal": 2,
        "sequence1": [
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
        ],
        "sequence2": [
            0,
            0,
            69,
            0,
            0,
            69,
            0,
            0,
            0,
            69,
            0,
            0,
            66,
            0,
            0,
            0
        ]
    },
    {
        "name": "pattern_0_V067_A-067.mid",
        "valence": 5,
        "arousal": 1,
        "sequence1": [
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
        ],
        "sequence2": [
            73,
            77,
            0,
            82,
            80,
            0,
            85,
            80,
            59,
            58,
            0,
            63,
            66,
            65,
            0,
            0
        ]
    },
    {
        "name": "pattern_0_V067_A-10.mid",
        "valence": 5,
        "arousal": 0,
        "sequence1": [
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
        ],
        "sequence2": [
            49,
            61,
            54,
            61,
            53,
            61,
            53,
            56,
            49,
            58,
            44,
            63,
            70,
            59,
            71,
            59
        ]
    },
    {
        "name": "pattern_0_V067_A00.mid",
        "valence": 5,
        "arousal": 3,
        "sequence1": [
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
        ],
        "sequence2": [
            47,
            63,
            63,
            0,
            63,
            63,
            63,
            63,
            63,
            63,
            47,
            0,
            0,
            0,
            59,
            0
        ]
    },
    {
        "name": "pattern_0_V067_A033.mid",
        "valence": 5,
        "arousal": 4,
        "sequence1": [
            0,
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
            61
        ],
        "sequence2": [
            61,
            61,
            59,
            59,
            59,
            0,
            59,
            0,
            0,
            0,
            66,
            0,
            0,
            66,
            66,
            66
        ]
    },
    {
        "name": "pattern_0_V067_A067.mid",
        "valence": 5,
        "arousal": 5,
        "sequence1": [
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
        ],
        "sequence2": [
            0,
            65,
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
            66,
            0,
            59
        ]
    },
    {
        "name": "pattern_0_V067_A10.mid",
        "valence": 5,
        "arousal": 6,
        "sequence1": [
            0,
            0,
            0,
            0,
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
            0
        ],
        "sequence2": [
            0,
            58,
            0,
            0,
            65,
            0,
            0,
            65,
            74,
            74,
            79,
            55,
            55,
            55,
            55,
            55
        ]
    },
    {
        "name": "pattern_0_V10_A-033.mid",
        "valence": 6,
        "arousal": 2,
        "sequence1": [
            0,
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
            0
        ],
        "sequence2": [
            33,
            33,
            31,
            33,
            38,
            38,
            0,
            38,
            0,
            38,
            0,
            0,
            38,
            0,
            0,
            32
        ]
    },
    {
        "name": "pattern_0_V10_A-067.mid",
        "valence": 6,
        "arousal": 1,
        "sequence1": [
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
        ],
        "sequence2": [
            60,
            59,
            57,
            57,
            0,
            0,
            55,
            0,
            57,
            58,
            55,
            60,
            63,
            63,
            75,
            63
        ]
    },
    {
        "name": "pattern_0_V10_A-10.mid",
        "valence": 6,
        "arousal": 0,
        "sequence1": [
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
        ],
        "sequence2": [
            74,
            74,
            69,
            72,
            70,
            0,
            0,
            0,
            62,
            0,
            63,
            0,
            63,
            58,
            58,
            0
        ]
    },
    {
        "name": "pattern_0_V10_A00.mid",
        "valence": 6,
        "arousal": 3,
        "sequence1": [
            0,
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
            0
        ],
        "sequence2": [
            58,
            58,
            0,
            56,
            0,
            0,
            56,
            0,
            0,
            56,
            56,
            56,
            56,
            56,
            0,
            72
        ]
    },
    {
        "name": "pattern_0_V10_A033.mid",
        "valence": 6,
        "arousal": 4,
        "sequence1": [
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
            0,
            0
        ],
        "sequence2": [
            0,
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
            66,
            0,
            0,
            66
        ]
    },
    {
        "name": "pattern_0_V10_A067.mid",
        "valence": 6,
        "arousal": 5,
        "sequence1": [
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
        ],
        "sequence2": [
            0,
            69,
            69,
            69,
            0,
            0,
            68,
            68,
            0,
            68,
            66,
            0,
            0,
            66,
            66,
            0
        ]
    },
    {
        "name": "pattern_0_V10_A10.mid",
        "valence": 6,
        "arousal": 6,
        "sequence1": [
            0,
            0,
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
            74
        ],
        "sequence2": [
            72,
            63,
            63,
            63,
            63,
            70,
            0,
            70,
            70,
            0,
            63,
            55,
            70,
            0,
            70,
            70
        ]
    }
];