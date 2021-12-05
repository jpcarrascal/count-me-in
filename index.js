const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);


app.get('/', (req, res) => {
    if(req.query.seq == "sequencer")
        page = '/index-seq.html'
    else
        page = '/index.html'
    res.sendFile(__dirname + page);
});

io.on('connection', (socket) => {
    /*console.log('a user connected');
    socket.on('disconnect', () => {
      console.log('user disconnected');
    });
    */
    socket.on('step value', (msg) => {
        io.emit('step value', msg);
        console.log(msg);
    });   

  });

var port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log('listening on *:' + port);
});