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

    test('rounds eviction: participant who played is kicked after threshold loops', async () => {
        const seq = await setupSequencer('c5');
        const track = connect({ role: 'participant', session: 'c5', initials: 'JP' });
        const created = await waitFor(track, 'create track');

        // Interact so rounds start counting.
        const ackPromise = waitFor(seq, 'step update');
        track.emit('step update', { track: created.track, step: 0, note: 60, value: 100, action: 'on' });
        await ackPromise;

        const exitPromise = waitFor(track, 'exit session');
        const clearPromise = waitFor(seq, 'clear track');
        // threshold=16: 17 completed loops push rounds past it.
        for (let i = 0; i < 17; i++) {
            seq.emit('step tick', { counter: 15 });
        }
        const exit = await exitPromise;
        expect(exit.reason).toBe('Join again?');
        const cleared = await clearPromise;
        expect(cleared.track).toBe(created.track);
        // The notes persist: the loop keeps sounding and the next occupant
        // inherits the pattern (clearOnRelease is off, legacy behavior).
        expect(server.sessions.get('c5').pattern.getCell(created.track, 0)).toEqual({ note: 60, vel: 100 });
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
