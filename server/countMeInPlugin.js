const fs = require('fs');
const path = require('path');
const { getMatchingSequences } = require('./sequences.js');

// Count-Me-In's app-specific server logic as a beatlink-core plugin.
// Sessions, roles, rounds-based turn-taking, the authoritative step grid
// (Pattern) and tempo (Transport) come from core; this plugin keeps the
// LEGACY wire format the clients already speak ('step update', 'play',
// 'create track', 'clear track', 'tempo update', admin events, ...) so
// client changes are limited to the connection handshake.

function isAdmin(socket) {
    return socket.handshake.query.admin !== undefined;
}

function activeClients(session) {
    return session.participants.snapshot().map(({ slot, socketID, initials }) => ({
        track: slot,
        initials,
        socketID
    }));
}

function adminState(session) {
    return {
        session: session.name,
        exists: true,
        ready: session.isReady(),
        playing: session.isPlaying(),
        tempo: session.transport ? session.transport.tempo : 98,
        clients: activeClients(session)
    };
}

function emitAdminState(ctx, session) {
    ctx.io.to(`admin:${session.name}`).emit('admin state', adminState(session));
}

function emitAdminClients(ctx, session) {
    ctx.io.to(`admin:${session.name}`).emit('admin clients', {
        session: session.name,
        clients: activeClients(session)
    });
}

function generateRandomString(length = 16) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

module.exports = function countMeInPlugin(ctx) {
    // Pure passthroughs, legacy names kept.
    ctx.relay({
        'give me my notes': 'broadcast',
        'track mute': 'broadcast',
        'track volume': 'broadcast',
        'veil-up': 'broadcast'
    });

    // --- slot lifecycle: legacy client notifications --------------------

    ctx.onActivate((session, { slot, socketID, initials }) => {
        // The joiner gets its track setup; everyone else learns about it.
        ctx.io.to(socketID).emit('create track', {
            track: slot,
            maxNumRounds: session.config.turnTaking.threshold
        });
        ctx.io.to(session.name).except(socketID).emit('track joined', {
            initials,
            track: slot,
            socketid: socketID
        });
        emitAdminClients(ctx, session);
    });

    ctx.onRelease((session, { slot, socketID, initials, reason }) => {
        ctx.emitToSession(session.name, 'clear track', { track: slot, initials });
        if (reason === 'evicted') {
            ctx.io.to(socketID).emit('exit session', { reason: 'Join again?' });
        }
        emitAdminClients(ctx, session);
    });

    // --- step grid: legacy events, Pattern is now authoritative ---------

    ctx.on('step update', (socket, session, msg) => {
        if (!session || !session.pattern || !msg) return;
        session.pattern.setCell(msg.track, msg.step, { note: msg.note, vel: msg.value });
        ctx.io.to(session.name).emit('step update', msg);
        let initials = session.participants.initialsOf(socket.id);
        if (session.hostId === socket.id) initials = 'seq';
        ctx.logger.info(`#${session.name} @${initials} step_update event: ${msg.action}` +
            ` track: ${msg.track} step: ${msg.step} note: ${msg.note} value: ${msg.value}`);
    });

    ctx.on('update all track notes', (socket, session, msg) => { // AI bulk update
        if (!session || !session.pattern || !msg || !Array.isArray(msg.notes)) return;
        session.pattern.setRow(msg.track, msg.notes.map(n => ({ note: n.note, vel: n.vel })));
        msg.notes.forEach((n, step) => {
            ctx.io.to(session.name).emit('step update', {
                track: msg.track, step, note: n.note, value: n.vel,
                action: 'ai-update', socketid: msg.socketid
            });
        });
    });

    ctx.on('track notes', (socket, session, msg) => { // sequencer -> one track
        if (msg && msg.socketid) {
            ctx.io.to(msg.socketid).emit('update track notes', msg);
        }
    });

    // --- clock: host-driven visual sync + rounds counting ----------------

    ctx.on('step tick', (socket, session, msg) => {
        if (!session || session.hostId !== socket.id) return;
        socket.broadcast.to(session.name).emit('step tick', msg);
        if (msg && msg.counter === session.config.pattern.steps - 1) {
            ctx.turnTaking.tick(session.name); // one loop completed
        }
    });

    ctx.on('play', (socket, session, msg) => {
        if (!session || session.hostId !== socket.id) return;
        session.play();
        socket.broadcast.to(session.name).emit('play', msg);
        ctx.logger.info(`#${session.name} Playing...`);
        emitAdminState(ctx, session);
    });

    ctx.on('stop', (socket, session, msg) => {
        if (!session || session.hostId !== socket.id) return;
        session.pause();
        socket.broadcast.to(session.name).emit('stop', msg);
        ctx.logger.info(`#${session.name} Stopped.`);
        emitAdminState(ctx, session);
    });

    ctx.on('tempo update', (socket, session, msg) => {
        if (!session || session.hostId !== socket.id || !msg) return;
        session.setTempo(msg.tempo);
        socket.broadcast.to(session.name).emit('tempo update', msg);
        emitAdminState(ctx, session);
    });

    // --- misc legacy events ----------------------------------------------

    ctx.on('hide toggle', (socket, session, msg) => {
        if (!session) return;
        socket.broadcast.to(session.name).emit('hide toggle track', { value: msg && msg.value });
    });

    ctx.on('expert-mode', (socket, session, msg) => {
        if (!session) return;
        const initials = session.participants.initialsOf(socket.id) || '?';
        ctx.logger.info(`#${session.name} @${initials} set expert mode to: ${msg && msg.value}`);
    });

    ctx.on('track solo', (socket, session, msg) => {
        ctx.logger.info(`Solo: ${msg && msg.value}`);
    });

    ctx.on('audio play', (socket, session, msg) => {
        ctx.logger.info(`Audio play: ${JSON.stringify(msg)}`);
    });

    // Experimental (Music AI workshop): generate a sample from a prompt,
    // cache it locally, then tell the session to reload it.
    ctx.on('reload my sample', (socket, session, msg) => {
        if (!session || !msg) return;
        fetch('https://stardate69-stableaudioopenendpoint2.hf.space/generate?prompt=' + msg.prompt)
            .then(response => response.arrayBuffer())
            .then(buffer => {
                const name = generateRandomString() + '.wav';
                fs.writeFile(path.resolve('./sounds/cache/' + name), Buffer.from(buffer), 'binary', (err) => {
                    if (err) {
                        ctx.logger.error(`Sample cache write failed: ${err.message}`);
                        return;
                    }
                    msg.sample = 'sounds/cache/' + name;
                    socket.broadcast.to(session.name).emit('reload track sample', msg);
                });
            })
            .catch(error => ctx.logger.error(`Sample generation failed: ${error.message}`));
        socket.broadcast.to(session.name).emit('reload sample notice', msg);
    });

    // --- admin surface (public role + `admin` handshake flag) ------------

    ctx.onConnect((socket, session, role) => {
        if (!session) return;
        if (role === 'host') {
            emitAdminState(ctx, session);
        } else if (role === 'public' && isAdmin(socket)) {
            socket.join(`admin:${session.name}`);
            ctx.logger.info(`#${session.name} @ADMIN connected`);
            socket.emit('admin state', adminState(session));
            socket.emit('admin clients', { session: session.name, clients: activeClients(session) });
        }
    });

    ctx.on('admin request state', (socket, session) => {
        if (!isAdmin(socket) || !session) return;
        socket.emit('admin state', adminState(session));
    });

    ctx.on('admin request clients', (socket, session) => {
        if (!isAdmin(socket) || !session) return;
        socket.emit('admin clients', { session: session.name, clients: activeClients(session) });
    });

    ctx.on('admin play', (socket, session) => {
        if (!isAdmin(socket) || !session) return;
        ctx.emitToHost(session, 'admin play', { socketID: socket.id, source: 'admin' });
        ctx.logger.info(`#${session.name} @ADMIN requested play`);
    });

    ctx.on('admin stop', (socket, session) => {
        if (!isAdmin(socket) || !session) return;
        ctx.emitToHost(session, 'admin stop', { socketID: socket.id, source: 'admin' });
        ctx.logger.info(`#${session.name} @ADMIN requested stop`);
    });

    ctx.on('admin set tempo', (socket, session, msg) => {
        if (!isAdmin(socket) || !session) return;
        let tempo = parseInt(msg && msg.tempo, 10);
        if (Number.isNaN(tempo)) {
            socket.emit('admin error', { reason: 'Invalid tempo' });
            return;
        }
        tempo = Math.min(250, Math.max(60, tempo));
        session.setTempo(tempo);
        ctx.emitToSession(session.name, 'tempo update', { tempo, socketID: socket.id, source: 'admin' });
        ctx.logger.info(`#${session.name} @ADMIN set tempo to ${tempo}`);
        emitAdminState(ctx, session);
    });

    ctx.on('admin clear all', (socket, session) => {
        if (!isAdmin(socket) || !session || !session.pattern) return;
        session.pattern.clear();
        ctx.emitToSession(session.name, 'clear all', { socketID: socket.id, source: 'admin' });
        ctx.logger.info(`#${session.name} @ADMIN cleared all steps`);
    });

    ctx.on('admin disconnect all', (socket, session) => {
        if (!isAdmin(socket) || !session) return;
        session.participants.snapshot().forEach(({ socketID }) => {
            ctx.io.to(socketID).emit('exit session', { reason: 'Disconnected by admin' });
            const participantSocket = ctx.io.sockets.sockets.get(socketID);
            if (participantSocket) {
                participantSocket.disconnect(true); // core release path emits 'clear track'
            }
        });
        ctx.logger.info(`#${session.name} @ADMIN disconnected all tracks`);
        emitAdminState(ctx, session);
    });

    // --- HTTP: mood-matched sequences + audio mock ------------------------

    ctx.route('get', '/randommock', (req, res) => {
        const notes = getMatchingSequences(parseInt(req.query.v, 10), parseInt(req.query.a, 10));
        res.send(JSON.stringify(notes ? notes.sequence : Array(16).fill(0)));
    });

    ctx.route('get', '/audiomock', (req, res) => {
        const sounds = ['bird.wav', 'frog.wav', 'owl.wav', 'mouse.wav', 'sheep.wav'];
        const soundUrl = 'sounds/seal/sounds/' + sounds[Math.floor(Math.random() * sounds.length)];
        res.send(JSON.stringify({ sound: soundUrl, prompt: req.query.prompt }));
    });
};
