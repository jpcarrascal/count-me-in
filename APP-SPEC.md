# Count Me In - App Spec

## Purpose
`Count Me In` is a real-time collaborative step sequencer. One client acts as the sequencer host and multiple participant clients each control one track.

## Stack
- Backend: Node.js + Express + Socket.IO (`index.js`)
- Frontend: Vanilla JS + HTML + CSS (`html/`, `scripts/`, `css/`)
- Audio: Web Audio API + HTML5 audio elements (`scripts/audio.js`)
- MIDI: Web MIDI API (`scripts/midi.js`, `scripts/midi-device-select.js`)

## Runtime Entry Points
- Server start: `node index.js` (no npm scripts currently defined)
- Main pages:
1. `/sequencer` -> sequencer host UI
2. `/track` -> participant UI
3. `/` -> same as index sequencer page
4. `/latency` -> socket latency diagnostics

Note: `index.js` also has routes for `/hootbeat` and `/emoji`, but corresponding HTML files are not in `html/`.

## High-Level Architecture
- Server keeps in-memory session state using `AllSessions` (`scripts/sessionObj.js`).
- Sequencer host creates/owns a session (`seqID`) and drives global clock/playback.
- Participants are allocated to available tracks and update step notes/velocities.
- State sync is done via Socket.IO broadcast events.

## Key Server Components
- `index.js`
1. Express route serving and static assets (`/scripts`, `/css`, `/images`, `/sounds`)
2. Socket.IO connection handling and event relay
3. Session lifecycle (create, join, release, expire)
4. Experimental endpoints:
	- `/randommock?v=&a=` returns generated melodic pattern from hardcoded sequence map
	- `/audiomock?prompt=` returns mock animal sound path
- `scripts/sessionObj.js`
1. `Participant`: identity and round counters
2. `Sequencer`: per-track/per-step note data
3. `Session`: participant allocation and sequencer state
4. `AllSessions`: session registry

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
- Connection query: `initials`, `session`, `sequencer`, `lang`, `method`, `sounds`
- Core events:
1. `sequencer role`: assigns host role (`main`/`secondary`)
2. `create track` / `track joined` / `clear track`: participant lifecycle
3. `step update`: single step note/velocity changes
4. `track notes` / `give me my notes` / `update track notes`: per-track full sync
5. `step tick`: transport cursor sync and round counting
6. `play` / `stop`
7. `exit session`
8. `track mute` / `track volume` / `hide toggle`
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
- Event name mismatch: client emits `audio-play` in `scripts/audio.js`, server listens for `audio play` in `index.js`.
- `releaseAllParticipants` in `scripts/sessionObj.js` uses `==` instead of assignment (`=`), so full release may not clear participant slots correctly.
- `Session.stop()` references undefined symbols (`sessionName`, `findSession`) and is effectively broken/unused.
- Route handlers for `/hootbeat` and `/emoji` reference HTML files not present in this workspace.
- App state is in-memory only; server restart wipes sessions.
- No automated tests currently present.

## Suggested Next Engineering Steps
1. Add `npm` scripts (`start`, maybe `dev`) to `package.json`.
2. Introduce a shared socket event constants file to avoid string drift.
3. Add minimal integration tests for session join/play/stop and track allocation.
4. Fix the known quirks before adding larger features.

## Quick Dev Workflow
1. Run `npm install`.
2. Start server with `node index.js`.
3. Open host page: `/sequencer?session=test`.
4. Open participant page: `/track?session=test&initials=ABC`.

