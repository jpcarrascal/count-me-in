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

    test('notes sent as strings are saved and reach the next player on that track', async () => {
        await setupSequencer('c3b', { method: 'asc' });
        const first = await joinTrack('c3b', 'AA');

        // The page reads track/step/note from DOM attributes: all strings.
        const ackPromise = waitFor(first.socket, 'step update');
        first.socket.emit('step update', {
            track: `${first.created.track}`, step: '3', note: '36', value: 100, action: 'stepClick'
        });
        expect(await ackPromise).toMatchObject({ track: first.created.track, step: 3, note: 36, value: 100 });

        first.socket.disconnect();
        await new Promise(resolve => setTimeout(resolve, 100));
        const second = await joinTrack('c3b', 'BB');
        expect(second.created.track).toBe(first.created.track);

        const snapshotPromise = waitFor(second.socket, 'pattern-snapshot');
        second.socket.emit('request-pattern-snapshot');
        const snapshot = await snapshotPromise;
        expect(snapshot.grid[second.created.track][3]).toEqual({ note: 36, vel: 100 });
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

    test('tracks are veiled while the sequencer is away and keep their slot', async () => {
        const seq = await setupSequencer('c4b');
        const { socket: track, created } = await joinTrack('c4b', 'JP');

        const veilPromise = waitFor(track, 'veil-on');
        seq.disconnect();
        expect(await veilPromise).toEqual({ reason: 'host-away' });
        expect(server.sessions.get('c4b').participants.slotOf(track.id)).toBe(created.track);
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

    // Let players in (the browser's Play, or the device's Audience toggle).
    async function openSession(seq) {
        const modePromise = waitFor(seq, 'session-mode');
        seq.emit('session-play');
        expect(await modePromise).toEqual({ isPlaying: true });
    }

    test('rounds eviction: participant who played is moved to the line after threshold loops', async () => {
        const seq = await setupSequencer('c5');
        await openSession(seq);
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

    test('evicted player alone in line gets a track back right away', async () => {
        const seq = await setupSequencer('c5b');
        await openSession(seq);
        const { socket: track, created } = await joinTrack('c5b', 'JP');
        await editStep(seq, track, created);

        const expiredPromise = waitFor(track, 'slot-expired');
        const recreatedPromise = waitFor(track, 'create track');
        loops(seq, 17);
        await expiredPromise;
        expect((await recreatedPromise).maxNumRounds).toBe(16);
    });

    test('rounds update counts down only after the participant edits a step', async () => {
        const seq = await setupSequencer('c5c');
        await openSession(seq);
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
        await openSession(seq);
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

    test('play/stop only describe the clock: they reach clients but leave the session closed', async () => {
        const seq = await setupSequencer('c6');
        const track = connect({ role: 'participant', session: 'c6', initials: 'JP' });
        await waitFor(track, 'create track');

        const playPromise = waitFor(track, 'play');
        seq.emit('play', { socketID: 'seq' });
        await playPromise;
        expect(server.sessions.get('c6').isPlaying()).toBe(false);

        const stopPromise = waitFor(track, 'stop');
        seq.emit('stop', { socketID: 'seq' });
        await stopPromise;
        expect(server.sessions.get('c6').isPlaying()).toBe(false);
    });

    test('opening and closing the session unveils and veils tracks', async () => {
        const seq = await setupSequencer('c6b');
        const track = connect({ role: 'participant', session: 'c6b', initials: 'JP' });
        // Joining a closed session: paused screen first.
        const [veil] = await Promise.all([waitFor(track, 'veil-on'), waitFor(track, 'create track')]);
        expect(veil).toMatchObject({ socketID: track.id });

        const offPromise = waitFor(track, 'veil-off');
        await openSession(seq);
        await offPromise;

        const onPromise = waitFor(track, 'veil-on');
        seq.emit('session-pause');
        await onPromise;
        expect(server.sessions.get('c6b').isPlaying()).toBe(false);
    });

    test('a player joining an open session is unveiled', async () => {
        const seq = await setupSequencer('c6c');
        await openSession(seq);
        const track = connect({ role: 'participant', session: 'c6c', initials: 'JP' });
        await Promise.all([waitFor(track, 'veil-off'), waitFor(track, 'create track')]);
    });

    test('ticks while the session is closed neither count rounds nor evict', async () => {
        const seq = await setupSequencer('c6d');
        const { socket: track, created } = await joinTrack('c6d', 'JP');
        await editStep(seq, track, created);
        const roundsSpy = jest.fn();
        const expiredSpy = jest.fn();
        track.on('rounds update', roundsSpy);
        track.on('slot-expired', expiredSpy);

        // Live playing with the device's Audience off.
        loops(seq, 20);
        // The ticks themselves still reach the track (proof they were handled).
        await new Promise(resolve => {
            let count = 0;
            track.on('step tick', () => { if (++count === 20) resolve(); });
        });
        expect(roundsSpy).not.toHaveBeenCalled();
        expect(expiredSpy).not.toHaveBeenCalled();
        expect(server.sessions.get('c6d').participants.get(created.track).rounds).toBe(0);
    });

    test('a reconnecting sequencer starts with the session closed', async () => {
        const seq = await setupSequencer('c6e');
        await openSession(seq);
        seq.disconnect();
        await new Promise(resolve => setTimeout(resolve, 100));

        const reloaded = connect({ role: 'host', session: 'c6e' });
        const [, mode] = await Promise.all([waitFor(reloaded, 'host-accepted'), waitFor(reloaded, 'session-mode')]);
        expect(mode).toEqual({ isPlaying: false });
        expect(server.sessions.get('c6e').isPlaying()).toBe(false);
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
});
