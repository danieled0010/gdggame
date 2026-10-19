# GDG Tech Challenge · v2 change log

1. Leaderboard: only when the host explicitly clicks SHOW LEADERBOARD after any question. HIDE LEADERBOARD restores answer reveal; NEXT QUESTION continues.
2. Lobby shows only a player count and `player joined` or `players joined`.
3. Timer progress bar is 14px (previously 11px), green >50%, yellow <=50%, red <=5 s.
4. Answer distribution now shows only the four response bars (letter, bar, count); no duplicate small labels.
5. Optional player tab-switch deterrent: warn-only default, penalty option selected before game. Counts absences >=2.5 seconds during live unanswered question, once per round; fourth and subsequent flagged rounds may deduct up to 500 points each (not below zero). This is a rough signal, not a cheating detector; screenshots/second devices cannot be identified.

## How to launch
1. Stop your old server with Control+C.
2. Extract this ZIP and open its own `gdg-tech-challenge-v2` folder.
3. Double-click START-MAC.command (or run `node server.js`).
4. Use the private Host control URL printed in Terminal, and `/screen` for the projector.
5. Use the host's Page-switch deterrent selector before START GAME; for a lighthearted university event, use Warnings only.
6. Try SHOW LEADERBOARD after any completed question; confirm it is disabled during timed questions.

## Safety / practical limits
- A phone may background Safari/Chrome due to calls or OS behavior. Short interruptions <2.5 s do not count.
- Browser visibility events may be blocked or throttled by the OS, and do not detect screenshots or consulting another device.
- Declare any scoring rule to students *before* play; avoid using penalties if network or phones are unpredictable.
