const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

var tracks = ["","","","","","","",""];
var seq = false;
var seqID = "";
function getAvailableTrack(name) {
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
    console.log("Track OUT, status:")
    console.log(tracks);
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
    if(req.query.seq == "sequencer") {
        page = '/index-seq.html';
        seq = true;
    }
    else {
        page = '/index.html'
        seq = false;
    }
    res.sendFile(__dirname + page);
});

app.use('/scripts', express.static(__dirname + '/scripts/'));
app.use('/css', express.static(__dirname + '/css/'));

io.on('connection', (socket) => {
    console.log("Joined: " + socket.id);
    if(!seq) {
        var track = getAvailableTrack(socket.id);
        socket.on('disconnect', () => {
            var track2del = getTrackNumber(socket.id);
            releaseTrack(socket.id);
            io.to(socket.id).emit('deallocate track');
            io.emit('clear track', {track: track2del});
            console.log('user ' + socket.id + ' disconnected, clearing track ' + track2del);
            console.log("Seq id:" + seqID)
        });
        io.to(socket.id).emit('allocate track', {track: track});
    } else {
        seqID = socket.id;
        console.log("Sequencer, no track allocated." + seqID)
    }

    socket.on('step value', (msg) => {
        io.emit('step value', msg);
        console.log(msg);
    });
});

var port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log('listening on *:' + port);
});