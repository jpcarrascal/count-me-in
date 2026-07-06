const fs = require('fs');
const path = require('path');
const express = require('express');
const { createServer } = require('beatlink-core');
const config = require('./scripts/config.js');
const countMeInPlugin = require('./server/countMeInPlugin.js');

// The number of tracks (slots + pattern rows) follows the sound set chosen
// by the host in its handshake.
function getNumTracks(soundSet) {
    try {
        const set = JSON.parse(fs.readFileSync(path.join(__dirname, 'sounds', soundSet, 'index.json')));
        return set.length;
    } catch (error) {
        console.log('Sounds not found!!! ' + path.join(__dirname, 'sounds', soundSet, 'index.json'));
        return config.NUM_TRACKS;
    }
}

const server = createServer({
    roles: ['host', 'public', 'participant'],
    session: {
        numParticipants: config.NUM_TRACKS,
        allocation: 'random',
        hostDisconnect: 'preserve',
        hostOptional: false, // tracks need a live sequencer (it runs the audio)
        // Rounds-based eviction: one round = one full loop of the sequencer.
        // No queue for now — evicted users are invited to rejoin (legacy UX).
        turnTaking: { count: 'rounds', threshold: config.MAX_NUM_ROUNDS, queue: false }
    },
    transport: { enabled: true, defaultTempo: 98 },
    // clearOnRelease false: the loop keeps sounding when someone leaves, and
    // the next occupant inherits the pattern (legacy behavior).
    pattern: { enabled: true, tracks: config.NUM_TRACKS, steps: config.NUM_STEPS, clearOnRelease: false },
    sessionOverrides: (socket) => {
        const soundSet = socket.handshake.query.sounds || 'tr808';
        const numTracks = getNumTracks(soundSet);
        const method = socket.handshake.query.method || 'random';
        return {
            numParticipants: numTracks,
            allocation: method.toLowerCase().includes('asc') ? 'sequential' : 'random',
            pattern: { tracks: numTracks }
        };
    },
    plugins: [countMeInPlugin],
    logging: { label: 'count-me-in' }
});

const { app } = server;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'html/index-sequencer.html'));
});

app.get('/sequencer', (req, res) => {
    const page = req.query.session ? 'html/sequencer.html' : 'html/index-sequencer.html';
    res.sendFile(path.join(__dirname, page));
});

app.get('/track', (req, res) => {
    const hasJoinInfo = req.query.session && (req.query.initials || req.query.initials === '');
    res.sendFile(path.join(__dirname, hasJoinInfo ? 'html/track.html' : 'html/index-track.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'html/admin.html'));
});

app.get('/latency', (req, res) => {
    res.sendFile(path.join(__dirname, 'html/latency.html'));
});

app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'images/favicon.ico'));
});

app.use('/scripts', express.static(path.join(__dirname, 'scripts')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/sounds', express.static(path.join(__dirname, 'sounds')));

if (require.main === module) {
    server.listen(process.env.PORT || 3000);
}

module.exports = { server };
