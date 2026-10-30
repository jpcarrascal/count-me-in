# Count Me In - App Spec

## Purpose
`Count Me In` is a real-time collaborative step sequencer. One client acts as the sequencer host and multiple participant clients each control one track.

## Stack
- Backend: Node.js on the `beatlink-core` framework (Express + Socket.IO) (`index.js`, `server/countMeInPlugin.js`)
- Frontend: Vanilla JS + HTML + CSS (`html/`, `scripts/`, `css/`)
- Audio: Web Audio API + HTML5 audio elements (`scripts/audio.js`)
- MIDI: Web MIDI API (`scripts/midi.js`, `scripts/midi-device-select.js`)

## Runtime Entry Points
- Server start: `npm start` (tests: `npm test`)
- Main pages:
1. `/sequencer` -> sequencer host UI
2. `/track` -> participant UI
3. `/` -> same as index sequencer page
4. `/admin` -> admin console
5. `/latency` -> socket latency diagnostics

## High-Level Architecture
- Sessions, roles (`host` / `participant` / `public`), track allocation, the waiting line and rounds-based eviction come from `beatlink-core`. State is in memory only.
- The sequencer host connects as `host`, owns the session and drives the clock/playback (its browser runs the audio).
- Participants are allocated a free track; when none is free they wait in line (see Turn-Taking).
- The step grid is core's `Pattern` (authoritative, server-side); tempo is core's `Transport`.
- `server/countMeInPlugin.js` keeps the legacy wire format the clients speak (`step update`, `create track`, `clear track`, ...).

## Key Server Components
- `index.js`
1. `createServer` config: roles, session sizing (from the sound set), turn-taking, transport, pattern
2. Page routes and static assets (`/scripts`, `/css`, `/images`, `/sounds`)
- `server/countMeInPlugin.js`
1. Slot lifecycle hooks -> `create track` / `track joined` / `clear track`
2. Step grid, transport and clock events; rounds counting on loop wrap
3. Admin events
4. Experimental endpoints:
	- `/randommock?v=&a=` returns generated melodic pattern from hardcoded sequence map
	- `/audiomock?prompt=` returns mock animal sound path
- `scripts/sessionObj.js`: browser-side `Sequencer` note store only (the server no longer uses this file)

## Turn-Taking
Configured as `turnTaking: { count: 'rounds', threshold: MAX_NUM_ROUNDS, queue: true }` (16 by default, `scripts/config.js`).
1. A round is one full sequencer loop: the plugin calls `ctx.turnTaking.tick()` when the host's `step tick` reaches the last step.
2. A participant's rounds only count once they interact (any app event, e.g. `step update`). Fetching the pattern with `request-pattern-snapshot` does not count.
3. After each loop the server sends each active participant `rounds update { remaining }`; the track page shows it as "Remaining rounds". 0 means the current loop is the last.
4. When rounds exceed the threshold, core evicts: the track is freed (`clear track`; its pattern keeps playing and passes to the next occupant), and the player gets `slot-expired` then `queue-status { position, total }`. They stay on the page, in line.
5. Joiners who find no free track (or people already waiting) get `queue-status` and wait on the paused screen: "All tracks are taken. You are #N in line."
6. Promotion: core promotes when a track is released; the plugin also retries at every loop wrap, before counting, so an evicted player waits at least one loop and free tracks never sit empty while someone waits. A promoted player receives `create track` as usual.
7. Leaving to the join page (`exit session`, `session-unavailable`, `session-ended`, Exit button) passes an English reason in `exitreason`; the join page translates it.

## Client Composition
- `html/sequencer.html`
1. Host matrix UI + transport controls + session info/QR modal
2. Loads `sequencer.js`, `include.js`, `audio.js`, `midi.js`, optional experimental script
- `html/track.html`
1. Participant single-track UI + expert mode + optional experimental controls
2. Loads `track.js`, `include.js`, shared sequencer helpers, optional experimental script
- Shared helpers
1. `scripts/include.js`: constants, matrix DOM builders, step update logic, cookies, i18n, URL helpers
2. `scripts/noteOperations.js`: note frequency table, tonality/transpose helpers

## Audio Model
- Soundset is data-driven from `sounds/<set>/index.json`
- Track types:
1. `sampler`: HTML `<audio>` element through gain nodes
2. `synth`: oscillator per track with gain envelope
- Main playback loop:
1. Scheduler uses tempo-derived interval for internal clock
2. Each tick emits `step tick` and plays notes for current step
3. External clock can drive ticking via MIDI start/stop/clock messages

## Socket Event Contract
- Connection query: `role`, `initials`, `session`, `lang`, `method`, `sounds`
- Core events:
1. `sequencer role`: assigns host role (`main`/`secondary`)
2. `create track` / `track joined` / `clear track`: participant lifecycle
3. `step update`: single step note/velocity changes
4. `pattern-snapshot` / `request-pattern-snapshot` (core): full grid sync; the track page requests one once its row is built
5. `step tick`: transport cursor sync and round counting
6. `rounds update`, `slot-expired`, `queue-status` (core): turn-taking, see above
7. `play` / `stop`
8. `exit session` (admin disconnect)
9. `track mute` / `track volume` / `hide toggle`
- Experimental events:
1. `update all track notes`
2. `reload my sample` -> server fetches generated wav and emits `reload track sample`

## Query Parameters Used
- Common:
1. `session`
2. `lang` (currently EN/ES)
3. `sounds` (soundset folder, default `tr808`)
- Sequencer page:
1. `method` participant allocation strategy (`random`, `asc`, `desc`)
2. `extclock`
3. `hideinfo`
- Track page:
1. `initials`
2. `experiment`

## Data Shapes
- Step object (session state):
```json
{"note": 36, "vel": 100}
```
- `step update` message:
```json
{"track": 0, "step": 4, "note": 36, "value": 100, "action": "stepClick", "socketID": "..."}
```
- Soundset entry (`sounds/*/index.json`):
```json
{"type":"sampler","sound":"BD.WAV","image":"0.png","params":{"note":36}}
```

## Feature Implementation Hotspots
- Add/modify UI behavior:
1. `scripts/include.js` (step widgets, update logic)
2. `scripts/sequencer.js` (host-only controls and transport)
3. `scripts/track.js` (participant behavior)
- Add new socket behavior:
1. Server handler in `index.js`
2. Client emit/listen points in `scripts/sequencer.js`, `scripts/track.js`, `scripts/midi.js`, or experimental scripts
- Add a new instrument/soundset:
1. Add `sounds/<name>/index.json`
2. Add files under `sounds/<name>/sounds/` and `sounds/<name>/images/`
3. Open with `?sounds=<name>`

## Known Quirks and Risks
- Event name mismatch: client emits `audio-play` in `scripts/audio.js`, server listens for `audio play` in `server/countMeInPlugin.js`.
- `scripts/sessionObj.js` still contains the unused legacy server classes (`Session`, `AllSessions`), with known bugs.
- App state is in-memory only; server restart wipes sessions.

## Suggested Next Engineering Steps
1. Introduce a shared socket event constants file to avoid string drift.
2. Trim `scripts/sessionObj.js` to the browser-side `Sequencer`.

## Quick Dev Workflow
1. Run `npm install`.
2. Start server with `npm start`; run tests with `npm test`.
3. Open host page: `/sequencer?session=test`.
4. Open participant page: `/track?session=test&initials=ABC`.

