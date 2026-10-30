const Client = require('socket.io-client');
const { server } = require('../index.js');

// Integration tests for count-me-in on beatlink-core: legacy wire format
// (create track / step update / play / tempo update / admin events) backed
// by core sessions, Pattern, Transport and rounds-based turn-taking.

describe('count-me-in server', () => {
    let port, clients = [];

    beforeAll((done) => {
        server.logger.transports.forEach(t => { t.silent = true; });
        server.httpServer.listen(0, () => {
            port = server.httpServer.address().port;
            done();
        });
    });

    afterEach(() => {
        clients.forEach(s => s.connected && s.disconnect());
        clients = [];
        server.sessions.all().forEach(s => server.sessions.remove(s.name));
    });

    afterAll(async () => {
        await server.close();
    });

    function connect(query) {
        const socket = Client(`http://localhost:${port}`, {
            query,
            forceNew: true,
            transports: ['websocket']
        });
        clients.push(socket);
        return socket;
    }

    function waitFor(socket, event) {
        return new Promise(resolve => socket.once(event, resolve));
    }

    async function setupSequencer(sessionName, extra = {}) {
        const seq = connect({ role: 'host', session: sessionName, ...extra });
        await waitFor(seq, 'host-accepted');
        return seq;
    }

    test('session is sized from the sound set; track gets legacy create track', async () => {
        const seq = await setupSequencer('c1', { sounds: 'tr808' });
        const session = server.sessions.get('c1');
        expect(session.config.numParticipants).toBeGreaterThan(0);
        expect(session.pattern.tracks).toBe(session.config.numParticipants);
        expect(session.transport.tempo).toBe(98);

        const joinedPromise = waitFor(seq, 'track joined');
        const track = connect({ role: 'participant', session: 'c1', initials: 'JP' });
        const [created, joined] = await Promise.all([
            waitFor(track, 'create track'),
            joinedPromise
        ]);
        expect(created.maxNumRounds).toBe(16);
        expect(joined).toMatchObject({ initials: 'JP', track: created.track, socketid: track.id });
    });

    test('second sequencer is told the host exists (secondary role)', async () => {
        await setupSequencer('c2');
        const second = connect({ role: 'host', session: 'c2' });
        await waitFor(second, 'host-exists');
    });

    test('step update reaches the session and lands in the Pattern grid', async () => {
        const seq = await setupSequencer('c3');
        const track = connect({ role: 'participant', session: 'c3', initials: 'JP' });
        const created = await waitFor(track, 'create track');

        const updatePromise = waitFor(seq, 'step update');
        track.emit('step update', { track: created.track, step: 3, note: 60, value: 100, action: 'on' });
        const update = await updatePromise;
        expect(update).toMatchObject({ track: created.track, step: 3, note: 60, value: 100 });

        const cell = server.sessions.get('c3').pattern.getCell(created.track, 3);
        expect(cell).toEqual({ note: 60, vel: 100 });
    });

    test('sequencer disconnect preserves the session; reload reclaims it', async () => {
        const seq = await setupSequencer('c4');
        const track = connect({ role: 'participant', session: 'c4', initials: 'JP' });
        await waitFor(track, 'create track');

        seq.disconnect();
        await new Promise(resolve => setTimeout(resolve, 100));
        const session = server.sessions.get('c4');
        expect(session).not.toBeNull();
        expect(session.participants.activeCount()).toBe(1);

        const reloaded = connect({ role: 'host', session: 'c4' });
        await waitFor(reloaded, 'host-accepted');
    });

    async function joinTrack(sessionName, initials) {
        const socket = connect({ role: 'participant', session: sessionName, initials });
        const created = await waitFor(socket, 'create track');
        return { socket, created };
    }

    // Interact so rounds start counting.
    async function editStep(seq, track, created) {
        const ackPromise = waitFor(seq, 'step update');
        track.emit('step update', { track: created.track, step: 0, note: 60, value: 100, action: 'on' });
        await ackPromise;
    }

    function loops(seq, n) {
        for (let i = 0; i < n; i++) seq.emit('step tick', { counter: 15 });
    }

    test('rounds eviction: participant who played is moved to the line after threshold loops', async () => {
        const seq = await setupSequencer('c5');
        const { socket: track, created } = await joinTrack('c5', 'JP');
        await editStep(seq, track, created);

        const exitSpy = jest.fn();
        track.on('exit session', exitSpy);
        const expiredPromise = waitFor(track, 'slot-expired');
        const queuedPromise = waitFor(track, 'queue-status');
        const clearPromise = waitFor(seq, 'clear track');
        // threshold=16: 17 completed loops push rounds past it.
        loops(seq, 17);
        await expiredPromise;
        expect((await queuedPromise).position).toBe(1);
        const cleared = await clearPromise;
        expect(cleared.track).toBe(created.track);
        expect(exitSpy).not.toHaveBeenCalled();
        // The notes persist: the loop keeps sounding and the next occupant
        // inherits the pattern (clearOnRelease is off, legacy behavior).
        expect(server.sessions.get('c5').pattern.getCell(created.track, 0)).toEqual({ note: 60, vel: 100 });
    });

    test('evicted player alone in line gets a track back on the next loop', async () => {
        const seq = await setupSequencer('c5b');
        const { socket: track, created } = await joinTrack('c5b', 'JP');
        await editStep(seq, track, created);

        const expiredPromise = waitFor(track, 'slot-expired');
        loops(seq, 17);
        await expiredPromise;

        const recreatedPromise = waitFor(track, 'create track');
        loops(seq, 1);
        expect((await recreatedPromise).maxNumRounds).toBe(16);
    });

    test('rounds update counts down only after the participant edits a step', async () => {
        const seq = await setupSequencer('c5c');
        const { socket: track, created } = await joinTrack('c5c', 'JP');

        // Fetching the pattern on join is not interaction.
        const snapshotPromise = waitFor(track, 'pattern-snapshot');
        track.emit('request-pattern-snapshot');
        await snapshotPromise;

        let updatePromise = waitFor(track, 'rounds update');
        loops(seq, 1);
        expect(await updatePromise).toEqual({ remaining: 16 });

        await editStep(seq, track, created);
        updatePromise = waitFor(track, 'rounds update');
        loops(seq, 1);
        expect(await updatePromise).toEqual({ remaining: 15 });
    });

    test('idle participant is never evicted', async () => {
        const seq = await setupSequencer('c5d');
        const { socket: track } = await joinTrack('c5d', 'JP');
        const expiredSpy = jest.fn();
        track.on('slot-expired', expiredSpy);

        const lastUpdate = new Promise(resolve => {
            let count = 0;
            track.on('rounds update', () => { if (++count === 20) resolve(); });
        });
        loops(seq, 20);
        await lastUpdate;
        expect(expiredSpy).not.toHaveBeenCalled();
    });

    test('overflow joiner waits in line and gets the track that frees up', async () => {
        await setupSequencer('c5e');
        const numTracks = server.sessions.get('c5e').config.numParticipants;
        const players = [];
        for (let i = 0; i < numTracks; i++) {
            players.push(await joinTrack('c5e', `P${i}`));
        }

        const waiting = connect({ role: 'participant', session: 'c5e', initials: 'W' });
        expect(await waitFor(waiting, 'queue-status')).toMatchObject({ position: 1, total: 1 });

        const createdPromise = waitFor(waiting, 'create track');
        players[0].socket.disconnect();
        expect((await createdPromise).track).toBe(players[0].created.track);
    });

    test('play/stop from the sequencer update session and reach clients', async () => {
        const seq = await setupSequencer('c6');
        const track = connect({ role: 'participant', session: 'c6', initials: 'JP' });
        await waitFor(track, 'create track');

        const playPromise = waitFor(track, 'play');
        seq.emit('play', { socketID: 'seq' });
        await playPromise;
        expect(server.sessions.get('c6').isPlaying()).toBe(true);

        const stopPromise = waitFor(track, 'stop');
        seq.emit('stop', { socketID: 'seq' });
        await stopPromise;
        expect(server.sessions.get('c6').isPlaying()).toBe(false);
    });

    test('admin: state, tempo (clamped), and forwarding play to the sequencer', async () => {
        const seq = await setupSequencer('c7');
        const admin = connect({ role: 'public', session: 'c7', admin: 'true' });
        const state = await waitFor(admin, 'admin state');
        expect(state).toMatchObject({ session: 'c7', exists: true, tempo: 98 });

        const tempoPromise = waitFor(seq, 'tempo update');
        admin.emit('admin set tempo', { tempo: 999 });
        const tempo = await tempoPromise;
        expect(tempo.tempo).toBe(250); // clamped
        expect(server.sessions.get('c7').transport.tempo).toBe(250);

        const forwardPromise = waitFor(seq, 'admin play');
        admin.emit('admin play');
        expect((await forwardPromise).source).toBe('admin');
    });

    test('admin connecting before the session exists is told to wait', async () => {
        const admin = connect({ role: 'public', session: 'ghost', admin: 'true' });
        await waitFor(admin, 'session-unavailable');
    });

    test('mood-matched sequence endpoint still serves', async () => {
        const response = await fetch(`http://localhost:${port}/randommock?v=6&a=5`);
        const notes = await response.json();
        expect(Array.isArray(notes)).toBe(true);
        expect(notes).toHaveLength(16);
    });
});
