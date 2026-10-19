# GDG Tech Challenge — offline LAN app specification

> This document records the original offline v1–v3 scope. Version 4 adds online hosting, public HTTPS join links/QR, a persistent host secret and configurable storage. The current deployment and runtime instructions are in `README.md` and `ONLINE.md`.

## Goal and scope
- Host an offline, Kahoot-inspired multiple-choice quiz in a university lecture hall.
- 15–30 participants on iPhone/Android browser; a MacBook runs the server and presenter view.
- No external network requests during the event. Local Wi-Fi only; a venue-network client-isolation check is mandatory.
- Language: English questions and public UI; host settings can be in Italian.

## Proposed stack
- Node.js runtime on macOS.
- Local HTTP server with Express (or Node built-in HTTP) + Socket.IO for realtime sessions.
- Static frontend HTML/CSS/JS with all fonts/assets bundled locally (no CDN, remote auth, analytics or Google Fonts).
- In-memory session state sufficient for v1; optionally write recovery snapshot and anonymous results to a local JSON file.
- Run on 0.0.0.0, default port 3000. Participant URL: http://<Mac-LAN-IPv4>:3000/join. Generate an offline QR code locally from this URL.

## Screens
1. `/host` — presenter-only control panel on Mac screen: lobby, names, start/pause/skip, reveal, next question, scores, reset, export. Protected by a random session admin token; not shown on projector.
2. `/screen` — projector fullscreen: question number, code snippet, timer, A/B/C/D options, count of submitted answers; after reveal, correct answer and answer distribution; leaderboard is displayed only on host request.
3. `/join` — mobile players: nickname, game PIN, ready, answer A/B/C/D, locked acknowledgment, own points and ranking.

## Rules
- Nickname max 18 characters; trim/case-fold for duplicate handling. Anonymous; no sign-in.
- One active submission per question and participant ID. Server is authoritative for start/end, correctness, and score; answers locked on receipt.
- Scoring: 1000 points for a correct answer, plus up to 300 time bonus (normalized by question time). Wrong/timeout = 0.
- Example: `1000 + floor(300 * max(0, remaining_ms) / duration_ms)`.
- If client disconnects: display reconnect status; retain player identity in localStorage and reconnect to the same session with the same nickname/ID. Player may answer after reconnection only if timer is still running.
- Leaderboard only on host demand after a question reveal, final top 3 podium. If prizes are provided, tie-break with a final bonus question or an explicit pre-announced rule; do not silently break perfect ties.
- Host can pause between questions, not silently extend an active question. On pause due to network failure, stop the timer server-side for all.

## Visual direction
- Compatible with user's Canva deck: minimal 16:9, generous whitespace and bold black titles for lobby/results; dark charcoal quiz stage matching the existing slide 14.
- Palette: blue #4285F4, red #EA4335, yellow #FBBC05, green #34A853; restrained for navigation, one accent per answer tile.
- Monospace terminal labels (`> whoami`, `$ gdg quiz --start`, `// challenge 04`) to echo deck's command-line motif.
- Large readable code blocks, contrast-conscious answer colors, phone tap targets >= 44px; visual labels A/B/C/D never rely solely on color.
- No unsupported claims of Google endorsement or official brand assets unless approved.

## Running order (target 9–11 minutes)
- 60–90 s: entry/QR and lobby (can begin while closing slide is shown).
- 255 s (4m15): timers across 12 questions.
- 3–4 min: short answer reveals and an optional leaderboard pause selected by the host.
- 60–90 s: Top 3/podium, photo/prizes if available, handoff.
- The planning guidelines reserve 8 minutes for interaction within a 30-minute talk; 9–11 minutes requires shortening the earlier segment or obtaining extra time.

## Operational checklist
1. Preinstall Node/npm packages at home, start app while offline, verify local assets are self-hosted.
2. Recheck Mac-to-phone connectivity on the *actual venue Wi-Fi* (home network success is not enough). Some university/guest WLANs enable client isolation.
3. Test with iOS Safari + Android Chrome and as many concurrent clients as realistically possible.
4. Allow inbound connections in macOS firewall if prompted. Keep Mac awake and on power.
5. Use the Mac's real LAN IPv4 for QR/link, not `localhost`; if IP changes, regenerate QR.
6. Have an offline slide-based A/B/C/D backup and manual Top 3 fallback.
7. If interest/registration form needs Internet, prepare paper or local form collection as a backup.

## Implementation update — v1, brand guide integration (Oct 2026)
- **Delivered**: zero-dependency built-in Node.js HTTP server; SSE (Server-Sent Events) pushes and POST answer actions; works on a local Wi-Fi without Internet. `server.js`, `public/app.js`, `public/app.css`, `questions.json`.
- **Offline QR**: local MIT-licensed QR encoding code stored under `vendor/QRCode`, served by `/api/qr.svg` for an approved LAN IP address.
- **Actual views**: `/screen` lobby/question/reveal/top-five intervals/podium; `/join` nickname+PIN, options, reveal and player score; `/host` private token-based controls and CSV.
- **Style revision**: light/off-white and pastel backgrounds from the official GDG on Campus guide; black outlines, abstract four-color symbol (not an official GDG logo), mono terminal labels; rich code block dark area only. Match brand-guide core #4285f4, #34a853, #f9ab00, #ea4335 and pastels #c3ecf6, #ccf6c5, #ffe7a5, #f8d8d8, neutral #f0f0f0/#1e1e1e. No proprietary font files distributed.
- **Projector**: 16:9-oriented layout for lecture halls; QR code and network IP selector. Separate private host view on the Mac's extended desktop.
- **Recovery**: state persisted in `data/session.json`; active timers restored in paused mode on server restart; participant tokens preserved in browser localStorage. A player cannot join after game has started, but can reconnect.
- **Backup**: `OFFLINE-BACKUP.html` is a complete browser-only question projector for A/B/C/D paper-card or show-of-hands if campus WLAN isolates participants. It provides no automatic scoring.
- **Important deviation**: browser state transport is SSE+POST, not Socket.IO, deliberately removing runtime package dependencies and external network setup.
- **Venue readiness**: confirm campus client-to-client reachability and test with multiple simultaneous phones. Mac OS X Node availability, local IPv4, firewall and extended display are operational prerequisites.

## v2.0 changes (October 2026)

- All leaderboard pauses are host-triggered via dedicated **SHOW LEADERBOARD** / **HIDE LEADERBOARD** commands. The game never inserts an automatic leaderboard at question 3, 6 or 9. Control is enabled on reveal only, not while answers are live. Host can move straight to the next question from either reveal or leaderboard.
- Lobby shows count + singular/plural players joined, without capacity display.
- Projector/player time bar: 14px, green above 50% time, yellow at/below 50%, red at/below five seconds.
- Answer reveal shows only response distribution bar chart, no repeated small answer text below.
- Attention reminder uses Page Visibility API in player browser and local server-provided timestamps. In lobby the host chooses `warn` (default) or `penalty`. A reported absence during an unanswered live question, lasting at least 2500ms until returning during the same question/reveal, increments warnings up to once per question. From warning #4, optional penalty mode deducts up to 500 score per additional flagged question, clamped at zero. A banner shows players a notice on return. Server never receives browsing destinations, app names or screenshots. No foolproof anti-cheat claims; avoid treating page blur as proof.
- Existing v1 score recovery migration defaults any older session to warning-only. Mode is locked once game begins.


## v3 — Nickname moderation

Nicknames are validated by `nickname-filter.js` before creating the player entry in `/api/join`. Edit `nickname-rules.json` to add/remove event-specific forbidden fragments or exact reserved presenter names. Case/accent/spacing/leet normalization is for screening only; accepted nicknames retain their display spelling after whitespace and control-character sanitation. The API returns a neutral English error and never returns the matching rule or list. The policy uses specific substring matching and is not a comprehensive abuse detector; avoid short fragments and verify false positives. A server restart reloads the rules. Existing players are unaffected.
