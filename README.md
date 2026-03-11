# Race Night 🏒

Real-time fan tap race game for arena videoboards. Fans tap on their phones, two balls race on the videoboard.

## Pages

| URL | Description |
|-----|-------------|
| `/` | Fan phone app — pick White or Purple, then tap |
| `/director.html` | Director control panel — start/stop/reset races |
| `/videoboard.html` | Fullscreen videoboard display |

---

## Deploy to Railway (5 minutes)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Race Night initial commit"
gh repo create race-night --public --push
```

### 2. Deploy on Railway
1. Go to [railway.app](https://railway.app) → **New Project**
2. Click **Deploy from GitHub repo**
3. Select your `race-night` repo
4. Railway auto-detects Node.js and deploys

### 3. Set your director password (recommended)
In Railway, go to your service → **Variables** → add:
```
DIRECTOR_PASSWORD=yourchosenpassword
```
The default password is `regiment` if no variable is set. Anyone visiting `/director.html` will get a browser login prompt — username can be anything, only the password matters.

### 4. Get your URLs
After deploy, Railway gives you a public URL like:
```
https://race-night-production.up.railway.app
```

- **Fan app**: `https://your-app.up.railway.app/`
- **Director**: `https://your-app.up.railway.app/director.html`
- **Videoboard**: `https://your-app.up.railway.app/videoboard.html`

Make a QR code pointing to the fan app URL and display it on the videoboard before the race.

---

## Local Development

```bash
npm install
npm run dev    # uses nodemon for auto-reload
```

Open `http://localhost:3000`

---

## How It Works

- **Socket.IO** handles all real-time communication (no polling)
- Director emits `director:start` → server starts the game, broadcasts to all clients
- Fan taps emit `tap` events → server increments score, broadcasts immediately  
- Server auto-ends race when timer expires
- All three pages react instantly via WebSocket state updates

## Game Flow

1. Director opens `/director.html`, sets duration, clicks **START RACE**
2. Fans who already picked their bowl see the race begin instantly
3. Fans tap the big button as fast as possible
4. Progress bars + scores update live on all screens
5. Timer hits 0 → race ends automatically
6. Videoboard shows winner with confetti, fan phones show result
7. Director clicks **RESET** to clear for next race
