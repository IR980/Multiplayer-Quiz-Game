# Quiz Battle — Multiplayer Quiz Game

A real-time multiplayer quiz game starter built with React + Vite, Node.js + Express, and Socket.IO. It is designed for 2–8 players on separate devices.

## Included in this MVP

- Create a private room with a five-character code and join from another browser/device.
- Lobby player list, host indicator, ready-up, room invite copying, and 2–8 player limit.
- 5/10/15/20 question match settings, English/Hindi selection, and optional category selection.
- Server-authoritative 15-second question timer and answer validation.
- Correct-answer points, speed bonus, streak bonuses, explanations, live leaderboard, results, rematch, and a tie-breaker option.
- Responsive dark-themed interface and health endpoint.

## Requirements

- Node.js 20+ recommended
- npm

## Run locally

Open two terminals.

### Terminal 1 — server

```bash
cd server
npm install
npm run dev
```

The API/socket server listens on `http://localhost:4000`. Health check: `http://localhost:4000/health`.

### Terminal 2 — client

```bash
cd client
npm install
npm run dev
```

Open the Vite URL shown in the terminal (usually `http://localhost:5173`) in two separate browser windows. Create a room in one, copy the room code, and join from the other. The first player is the host; both players must be ready before the host starts.

## Connect multiple devices on the same Wi-Fi

Run the server on a computer reachable on the LAN and set `VITE_SERVER_URL` in `client/.env` to that computer's LAN address, for example:

```env
VITE_SERVER_URL=http://192.168.1.20:4000
```

Restart Vite after changing the environment. Allow the server port through the computer firewall if required. For players on different networks, deploy the server and frontend to public hosts and configure their public URLs; this repository is not automatically deployed.

## Deployment notes

- Deploy `server` as a Node web service; set `PORT` as provided by the host and `CLIENT_ORIGIN` to the deployed frontend origin(s), comma-separated if needed.
- Deploy `client` as a Vite static site; set `VITE_SERVER_URL` to the deployed server URL and build with `npm run build`.
- Use HTTPS in production. Socket.IO will use secure WebSockets through the HTTPS origin.
- Rooms and scores are currently held in server memory. Restarting the server clears rooms; this MVP does not include accounts, persistent storage, public matchmaking, moderation, or a production question-management CMS.

## Important current limitations

This is a starting MVP, not a finished production service. It includes a small sample question bank and core private-room gameplay. Solo practice, daily challenges, custom quiz authoring/library, persistent backups, chat/reactions, spectators, accessibility review, production anti-abuse controls, and automated test coverage are not yet implemented. These should be added in subsequent phases after the multiplayer loop is verified.

## Project structure

```text
multiplayer-quiz-game/
├── client/
│   ├── src/App.jsx
│   ├── src/main.jsx
│   ├── src/styles.css
│   ├── index.html
│   └── package.json
├── server/
│   ├── src/index.js
│   ├── src/questions.js
│   └── package.json
└── README.md
```
