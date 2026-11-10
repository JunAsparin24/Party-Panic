# 🎉 Party Panic

A chaotic multiplayer party game for 2–20 players. One laptop/TV is the shared host screen; everyone plays on their phone's browser. No app install.

## Run it

```bash
npm install
npm start
```

- **Host:** open `http://localhost:3000` on the big screen and click **Create Party**.
- **Players:** scan the QR code on the host screen, or open the "Join on your phone" address it shows and type the 6-digit room code. Phones must be on the same Wi-Fi network as the host computer.
- If phones can't connect, allow Node.js through the Windows firewall (private networks) and check the address printed in the terminal.

`npm run dev` restarts the server automatically when server files change.

## Deploy on Render

Deploying puts the game on a public `https://` address, so phones can join from anywhere, including mobile data. They no longer need to share Wi-Fi with the host.

1. Push this repo to GitHub.
2. In the [Render dashboard](https://dashboard.render.com), click **New → Blueprint**, pick this repo and click **Apply**. Render reads `render.yaml` and sets everything up.
   - Or create it by hand: **New → Web Service**, choose the repo, Runtime **Node**, Build command `npm ci`, Start command `npm start`, Health check path `/healthz`.
3. Open `https://<your-service>.onrender.com` on the big screen and click **Create Party**. The QR code and join link automatically use the public address.

Notes:
- Keep it at **one instance**. Parties live in server memory, so a second instance wouldn't know about them.
- Render's free plan sleeps after about 15 minutes without visitors. The first visit after that takes up to a minute to wake it, so open the site before your guests arrive. A restart or redeploy ends any party in progress.
- To use a custom domain, set the `PUBLIC_URL` environment variable to it (for example `https://party.example.com`).

## What's in the box

**10 minigames:** Perfect Timing, Memory Meltdown, Spot the Difference, Number Rush, Tower Trouble, Word Scramble, Catch or Crash, Double or Nothing, Maze Dash, Red Light Panic.

**4 modes:**

| Mode | How it works |
|---|---|
| Classic | Everyone plays every round. The final round is worth double. |
| Elimination | The lowest scorers are knocked out after each round, so two players reach a final duel. |
| Teams | Players are split into 2–4 teams; team score is the average of its members. |
| Chaos | Every round rolls modifiers: Double Points, Reversed Controls, Turbo Timer, Golden Player, Underdog Boost, Point Heist, Upside Down. |

The host picks the mode, 5/10/15/20 rounds, and which minigames are in the mix. During a game, the host can skip ahead or end the tournament early.

**Scoring:** each round is ranked on the game's raw score; 1st place earns 100 points and last place (with a non-zero score) earns 30. Flawless runs earn a +25 "Perfect" bonus. Comebacks, lead changes, close races and photo finishes get called out on the big screen.

## How it works

- **Server-authoritative.** The server generates every puzzle, holds every answer, runs every timer and decides every score. Phones only send inputs ("tapped", "picked chest 2", "moved left"). Timing games work out where the marker or block *was* when the tap happened, using lag measured by the server itself, so a modified client cannot report a fake score.
- **Fair puzzles.** Within a round every player gets the same puzzles, mazes and falling items, from a shared seed.
- **Reconnects.** Each phone stores a session token. Refreshing, locking the phone or dropping Wi-Fi puts the player straight back into the round they were in. Players who leave mid-game are removed without breaking the tournament.
- **Live sync.** Phones sync their clock with the server so countdowns match the big screen.

```
server/
  index.js        Express + Socket.IO, rooms, rate limiting, QR codes
  room.js         Tournament state machine (lobby → wheel → tutorial → countdown → playing → results → standings → final)
  scoring.js      Placement points and multipliers
  games/*.js      One file per minigame (server rules)
shared/
  games.js        Minigame names, colours, durations, tutorials
  config.js       Modes, teams, chaos modifiers
  avatar.js       Avatar options and SVG renderer
public/
  js/host.js      Big-screen views
  js/player.js    Phone views
  js/games/*.js   One file per minigame (phone controls, host extras, tutorial demo)
scripts/bots.js   Load test
```

### Adding a minigame

1. Add its metadata to `shared/games.js`.
2. Create `server/games/<id>.js` exporting `create(api)`, which returns `{ playerInit, onInput, progress, finish }` (plus optional `tick` and `hostInit`). Register it in `server/games/index.js`.
3. Create `public/js/games/<id>.js` exporting `{ player(ctx), demo?(), host?(ctx) }`. Register it in `public/js/games/index.js`.

It then appears automatically in the lobby, on the wheel and in the tutorials.

## Testing

```bash
npm run test:bots            # 20 bots, every mode, with reconnects, kicks and a mid-game leaver
node scripts/bots.js 12 5 6  # players, classic rounds, speed multiplier
```
