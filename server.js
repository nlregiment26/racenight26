const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

// ── GAME STATE ──
let state = {
  active: false,
  ended: false,
  game_id: null,
  duration: 60,
  started_at: null,
  upper_taps: 0,
  lower_taps: 0,
};

let gameTimer = null;

function broadcastState() {
  io.emit('state', state);
}

// ── SOCKET EVENTS ──
io.on('connection', (socket) => {
  console.log(`[+] connected: ${socket.id}`);

  // Send current state immediately on connect
  socket.emit('state', state);

  // Fan taps
  socket.on('tap', ({ bowl }) => {
    if (!state.active) return;
    if (bowl === 'upper') state.upper_taps++;
    else if (bowl === 'lower') state.lower_taps++;
    broadcastState();
  });

  // Director: start game
  socket.on('director:start', ({ duration }) => {
    if (state.active) return;
    clearTimeout(gameTimer);

    state = {
      active: true,
      ended: false,
      game_id: 'game_' + Date.now(),
      duration: duration || 60,
      started_at: Date.now(),
      upper_taps: 0,
      lower_taps: 0,
    };

    broadcastState();
    console.log(`[START] game ${state.game_id} | ${state.duration}s`);

    gameTimer = setTimeout(() => {
      state.active = false;
      state.ended = true;
      broadcastState();
      console.log(`[END] auto-ended | W:${state.upper_taps} P:${state.lower_taps}`);
    }, state.duration * 1000);
  });

  // Director: stop early
  socket.on('director:stop', () => {
    clearTimeout(gameTimer);
    state.active = false;
    state.ended = true;
    broadcastState();
    console.log(`[STOP] manual stop | W:${state.upper_taps} P:${state.lower_taps}`);
  });

  // Director: reset
  socket.on('director:reset', () => {
    clearTimeout(gameTimer);
    state = {
      active: false, ended: false, game_id: null,
      duration: 60, started_at: null,
      upper_taps: 0, lower_taps: 0,
    };
    broadcastState();
    console.log('[RESET]');
  });

  socket.on('disconnect', () => {
    console.log(`[-] disconnected: ${socket.id}`);
  });
});

// Health check for Railway
app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Race Night server running on port ${PORT}`);
});
