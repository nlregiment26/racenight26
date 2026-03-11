const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
// ── DIRECTOR PASSWORD ──
const DIRECTOR_PASSWORD = process.env.DIRECTOR_PASSWORD || 'regiment';

function basicAuth(req, res, next) {
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
    const [, pass] = decoded.split(':');
    if (pass === DIRECTOR_PASSWORD) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Director Access"');
  res.status(401).send('Unauthorized');
}

// Protect director page before static middleware
app.get('/director.html', basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'director.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

const LAPS_TO_WIN = 3;

let state = {
  active: false, ended: false, game_id: null,
  duration: 60, taps_per_lap: 200,
  started_at: null, upper_taps: 0, lower_taps: 0,
  upper_players: 0, lower_players: 0,
  winner: null,  // 'upper' | 'lower' | 'tie' | null
};

const teamMap = new Map();
let gameTimer = null;

function updatePlayerCounts() {
  let u = 0, l = 0;
  for (const t of teamMap.values()) { if (t === 'upper') u++; else if (t === 'lower') l++; }
  state.upper_players = u;
  state.lower_players = l;
}
function broadcast() { io.emit('state', state); }

function checkWin() {
  if (!state.active) return;
  const uLaps = Math.floor(state.upper_taps / state.taps_per_lap);
  const lLaps = Math.floor(state.lower_taps / state.taps_per_lap);
  if (uLaps >= LAPS_TO_WIN || lLaps >= LAPS_TO_WIN) {
    clearTimeout(gameTimer);
    state.active = false;
    state.ended = true;
    if (uLaps >= LAPS_TO_WIN && lLaps >= LAPS_TO_WIN) state.winner = 'tie';
    else if (uLaps >= LAPS_TO_WIN) state.winner = 'upper';
    else state.winner = 'lower';
    broadcast();
    console.log(`[WIN] ${state.winner} | W:${state.upper_taps} M:${state.lower_taps}`);
  }
}

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`);
  teamMap.set(socket.id, null);
  socket.emit('state', state);

  socket.on('join_team', ({ bowl }) => {
    teamMap.set(socket.id, bowl);
    updatePlayerCounts();
    broadcast();
  });

  socket.on('tap', ({ bowl }) => {
    if (!state.active) return;
    if (bowl === 'upper') state.upper_taps++;
    else if (bowl === 'lower') state.lower_taps++;
    if (!teamMap.get(socket.id)) { teamMap.set(socket.id, bowl); updatePlayerCounts(); }
    broadcast();
    checkWin();
  });

  socket.on('director:start', ({ duration, taps_per_lap }) => {
    if (state.active) return;
    clearTimeout(gameTimer);
    state = { ...state, active: true, ended: false, game_id: 'game_' + Date.now(),
      winner: null,
      duration: duration || 60, taps_per_lap: taps_per_lap || 200,
      started_at: Date.now(), upper_taps: 0, lower_taps: 0 };
    broadcast();
    console.log(`[START] ${state.game_id} | ${state.duration}s | ${state.taps_per_lap} taps/lap`);
    // Fallback timer — game should end via lap win, but keep as safety net
    gameTimer = setTimeout(() => {
      if (!state.active) return;
      state.active = false; state.ended = true;
      const uLaps = Math.floor(state.upper_taps / state.taps_per_lap);
      const lLaps = Math.floor(state.lower_taps / state.taps_per_lap);
      state.winner = uLaps > lLaps ? 'upper' : lLaps > uLaps ? 'lower' : 'tie';
      broadcast();
      console.log(`[TIMEOUT] W:${state.upper_taps} M:${state.lower_taps}`);
    }, state.duration * 1000);
  });

  socket.on('director:stop', () => {
    clearTimeout(gameTimer); state.active = false; state.ended = true; broadcast();
  });

  socket.on('director:reset', () => {
    clearTimeout(gameTimer);
    state = { ...state, active: false, ended: false, game_id: null, started_at: null, upper_taps: 0, lower_taps: 0 };
    broadcast();
  });

  socket.on('disconnect', () => {
    teamMap.delete(socket.id); updatePlayerCounts(); broadcast();
    console.log(`[-] ${socket.id}`);
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Race Night server on port ${PORT}`));
