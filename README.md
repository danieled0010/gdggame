# GDG Tech Challenge — Online & Local Multiplayer Quiz

**Version 4.0 · GDG on Campus student event · Sapienza**

A real multiplayer quiz for up to 60 participants (designed for 15–30). Deploy it online so players can join from any Internet connection, or run it on your MacBook and the venue Wi-Fi with no Internet during play. Phones need only Safari or Chrome. One presenter controls one shared game; this is not a platform for independent game rooms.

## Play over the Internet

The repository is [danieled0010/gdggame](https://github.com/danieled0010/gdggame). The Node.js server must run on a web hosting service; GitHub Pages only serves static sites and cannot run this multiplayer backend.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/danieled0010/gdggame)

The included `render.yaml` creates one free Node.js web service, generates a private `ADMIN_TOKEN`, and detects Render's public HTTPS address automatically. Open `/host` and enter that token from the service's Environment settings. Open `/screen` for the projector, then share `/join` or its QR code with players. The root URL also opens the player page online. Wi-Fi and mobile data both work; your Mac does not need to run the server.

**Free hosting limitation:** Render can sleep after inactivity, take time to wake, and erase the saved game on a restart, sleep or redeploy. Export results before closing the event. If uninterrupted operation and restart recovery matter, use a paid instance with a persistent disk and set `DATA_DIR` to its mount path. Keep exactly one server instance. Automatic deploys are disabled in the Blueprint to avoid interrupting a game; deploy updates manually between events. See [Render's free service limits](https://render.com/docs/free).

See **[ONLINE.md](ONLINE.md)** for the complete Italian deployment guide, environment settings and pre-event checklist. No hosting account, paid subscription or live deployment is created by running this repository's tests.

## Development and verification

Use Node.js 22+ (Node.js 24 is pinned for hosting) and Python 3.10+ for the integration tests. The app itself needs only Node.js, with no npm dependencies.

```sh
npm start
npm run check
npm test
```

Tests use temporary data directories and do not change your saved game. They cover a full quiz, moderation, presenter controls, 60 simultaneous SSE players, public URLs, host authentication, expired sessions and restart recovery. GitHub Actions runs the same checks for pushes and pull requests.

## What's included

- 12 editable questions in English (Git, Linux, Python, HTTP, JavaScript, Docker, Cybersecurity, SQL, Google Developer tools, AI).
- Large 16:9 projector screen; responsive player interface; private host dashboard.
- Local QR code, nickname + PIN entry, countdown, per-question answer reveal, on-demand leaderboard controlled by the host, top-3 podium.
- Correct answer = 1,000 points plus up to 300 for speed. Wrong or late = zero.
- Pause/resume, early reveal, reset, Excel-friendly CSV export, automatic reconnect and local session snapshot recovery.
- No CDN, Google Fonts, external APIs, analytics, Node packages, accounts or Internet calls.

## Start on your Mac (no npm install required)

1. Install **Node.js 22+** on your Mac *before the event* (if not already installed). Check in Terminal: `node -v`.
2. Extract the ZIP archive. Open the extracted `gdg-tech-challenge-v3` folder.
3. Double-click `START-MAC.command` (macOS may require right-click → Open once). Alternatively, open Terminal in the folder and run `node server.js`.
4. The Terminal prints three things:
   - **Private host link**: open on the Mac, do NOT project/share it.
   - **Projector link**: `http://localhost:3000/screen`, open in another browser window.
   - **Join link**: `http://<Mac-Wi-Fi-IP>:3000/join`, for phones.
5. Connect **Mac and phones to the same Wi-Fi network**. This works with Internet disconnected if the local network allows device-to-device communication.
6. On the projector screen choose your **Wi-Fi IP** in the dropdown (usually `en0`, often `192.168.x.x` or `10.x.x.x`). Ask a friend to scan the QR code and join with a nickname + 6-digit PIN.
7. From the host dashboard press **Start game**. At each round the server automatically closes answers and shows the explanation when time expires. Press the next button to proceed. The leaderboard appears ONLY when you click **SHOW LEADERBOARD** in the host dashboard after any completed question (suggestion: after question 6). Click **HIDE LEADERBOARD** to return to the result, or **NEXT QUESTION** to continue. After question 12, the podium appears when you advance.
8. Export final results as CSV from the host panel. End by pressing Control+C in the Terminal.

**Projecting with one MacBook:** set **System Settings → Displays** to *Extended Display* (not Mirroring). Put the `/screen` browser window on the projector and the `/host` dashboard on your Mac's screen. Make the projector window full-screen if appropriate (often Control+Command+F). The host link includes a private authentication code: never show it on the projector. If you can only mirror, the host dashboard will be visible whenever you switch to it; arrange a second operator or briefly hide the projection before switching.

## Mandatory venue test for local mode

The earlier home Wi-Fi test does **not** guarantee that a campus guest network will work. Some Wi-Fi networks enable **client isolation**, preventing a phone from connecting to a Mac on the same network. Perform the following **at the venue**:

1. Connect the Mac and a phone to the **same SSID**.
2. Run `node server.js` on the Mac.
3. On the phone, open `http://<Mac-IP>:3000/join` manually. The phone must see the Join screen.
4. Join and run at least 2 questions; disconnect/reconnect the phone and confirm its score remains intact.
5. Test as many simultaneous devices as realistically possible. Do not assume a 30-device capacity from the 2-device test.

If the host can't be reached, check Mac IP, same SSID/subnet, macOS firewall incoming access for Node, and any campus network client-isolation policy. Do not disable your Mac firewall entirely or bypass campus network controls.

### About Internet

During the event the app makes **only local HTTP requests** to the Mac. iOS or Android may warn *No Internet Connection*, but staying connected to this Wi-Fi is fine. If phones switch automatically to cellular, temporarily disabling that automatic switch can help. **Use local IP addresses, not `localhost`, on the phones.**

## v2: manual leaderboard, timer colors and focus deterrent

- **Leaderboard:** no automatic breaks every three questions. The dedicated **SHOW LEADERBOARD** button is always visible in `/host`, and available only after the answer reveal. During a live question it stays disabled so players do not lose the question. Choose any break (for example after question 6). Use **HIDE LEADERBOARD** to return to the results. **NEXT QUESTION** advances normally.
- **Lobby:** shows the live number of `player joined` / `players joined` without `/30+`.
- **Timer:** countdown progress bar 14px high; **green** with more than half the allotted time left, **yellow** at half or less, **red** at five seconds or less. The numeric countdown remains visible for accessibility.
- **Answer reveal:** graph only (four colored bars with A/B/C/D and counts); the tiny repeated option descriptions have been removed.
- **Page-switch reminder:** in `/host`, choose the rule **before pressing START GAME**:
  - `Warnings only` (**default / recommended**): a warning banner on the returning player's phone; **no points deducted**.
  - `After 3 warnings, -500`: after 3 separate flagged questions, each additional flagged question deducts **up to 500** points (never below zero; once per question).
  - A flag is recorded only if the player leaves the quiz tab while an **unanswered active question** is live, stays away for at least **2.5 seconds**, and returns during that question or its answer reveal. This uses only browser foreground/background changes; no tracking of visited websites, screen contents or app names.
  - Leaving the page for a second can happen due to calls, OS prompts or a browser background event. The browser may fail to report some app changes, and screenshots or another device are **not detectable**. It is a light deterrent, **not evidence of cheating**. Announce the rule before play; keep the warnings-only mode for casual games with prizes unless you have agreed otherwise.

## v3: nickname moderation (offline)

- On joining, the **server** checks each nickname against a configurable list in `nickname-rules.json`. It is not merely a cosmetic browser check, so direct HTTP submissions are checked too.
- Designed to discourage explicit references to current conflicts, extremist movements, discriminatory insults, and organizer impersonation. **An ethnic or religious identity term is not automatically an insult**; a small number of references are restricted **specifically for this event** at the organizer's request, to avoid provocative nicknames. The lists are not a judgement about a group of people.
- Matching ignores **case, accents, spaces, common punctuation, common leetspeak substitutions**, and a small set of Unicode lookalikes (not exhaustive). For example, adding dots or substituting `3` for `e` does not usually evade the checks.
- Rejected nicknames receive only a neutral message and are **not stored**. Names of accepted participants are still visible in the lobby and leaderboard.
- The lists are editable **offline**: open `nickname-rules.json`, add or remove terms in the arrays, save, then **stop and restart** the server. Keep entries specific: a broad fragment can also reject harmless nicknames. The list is on the server, not sent to participants. We recommend trying 10–20 sample nicknames before the presentation.
- The policy cannot catch every obfuscation or context. Participants can still invent ambiguous or indirect names. If someone bypasses it with a disruptive nickname, the safest fallback is to reset the lobby and ask for a new name (note: resetting clears the current game). There is no live kick or rename control in v3.

## Change the questions

Edit `questions.json` using a text editor. Each item has:

- `question` (English text), `options` (exactly four answers), `correct_index` (0=A, 1=B, 2=C, 3=D)
- `time_sec` (recommended 15–30), `code` (optional multi-line snippet), `category`, `explanation`.

Stop the server with Control+C, save the JSON file, and restart to load the new questions. The number of questions updates automatically. Existing sessions are preserved; to begin fresh, use **Reset Game** after restarting.

## Privacy, reliability and operation

- Nicknames, scores and per-question choices are stored on the quiz server in `DATA_DIR/session.json` (default: `data/session.json`). This directory and `.env` files are excluded from Git. You can erase the file to clear the stored session **when the server is stopped**.
- Browser player tokens are stored only on the participants' devices. Once the quiz starts, new players cannot join; those already joined can reconnect.
- A reset creates a new 6-digit PIN; players must rejoin.
- During active question disconnects, time continues. The presenter can pause/resume for a network problem.
- Ties in score share the same rank. If a prize cutoff has tied players, use an announced tie-break or another fair policy.
- Keep the Mac awake, connected to power, and Node allowed through macOS firewall. Avoid running multiple copies on port 3000.
- The quiz server binds all interfaces (`0.0.0.0`). For Internet play, use an HTTPS web service as described above. For local play, no router port forwarding is needed.

## Brand implementation

Inspired by the user-supplied *Google Developer Groups On Campus Brand Guidelines*, especially typography, swatches and 16:9 graphic templates:

- Off white `#f0f0f0`; black `#1e1e1e`; pastel blue `#c3ecf6`, green `#ccf6c5`, yellow `#ffe7a5`, red `#f8d8d8`.
- Core accents blue `#4285f4`, green `#34a853`, yellow `#f9ab00`, red `#ea4335`.
- Simple thick dark outlines, asymmetric rounded frames, dots and code-style labels.
- Uses Arial/system sans-serif and system monospace instead of shipping proprietary Google Sans/Google Sans Mono font files.
- Deliberately no copied or invented official chapter logo. Group identity can be updated after formal chapter naming/approval is confirmed.

The packaged QR encoder includes an adapted copy of Kazuhiko Arase's `QRCode for JavaScript`, via `qrcode-terminal`, licensed under MIT and Apache-2.0; see `vendor/NOTICE.txt` and license files.

## Troubleshooting

- `command not found: node` → install Node.js at home, then reopen Terminal.
- `EADDRINUSE` → another server is already on port 3000; stop it first (Control+C).
- Phones can't open link → ensure same Wi-Fi, correct Mac IP, local network permits client-to-client access and macOS firewall allows Node.
- Host controls locked → reopen the **private host link** printed in Terminal (host token is randomized on every restart).
- Changed Wi-Fi → refresh `/screen` and choose the new IP from the dropdown; players need the new local URL, but scores survive in the local server if connected again.
- Timer doesn't advance → check Terminal window is still running and the server is not paused.
