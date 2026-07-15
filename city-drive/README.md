# 🏎️ City Drive - Multiplayer Freeroam Driving Game

A lightweight, multiplayer city driving game that runs entirely on **GitHub Pages** (static hosting). No backend server required!

![City Drive](https://img.shields.io/badge/Play-Online-brightgreen) ![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-blue) ![PWA](https://img.shields.io/badge/PWA-Ready-purple)

## 🎮 Features

- **Multiplayer**: Real-time P2P via WebRTC, signaled through Firebase (free tier)
- **Freeroam City**: Procedurally generated infinite city with roads, buildings, intersections
- **Cross-platform**: Works on desktop (keyboard/gamepad) and mobile (touch controls)
- **Zero-config hosting**: Deploy to GitHub Pages in minutes
- **Offline support**: Service Worker caches everything for offline play
- **PWA**: Installable as an app on mobile/desktop
- **Shareable links**: Send a URL to friends, they join instantly

## 🚀 Quick Start (Local Development)

```bash
# Clone and install
cd city-drive
npm install

# Start dev server
npm run dev
```

Open http://localhost:3000 - you'll be in **offline mode** (single player).

## 🌐 Multiplayer Setup (Required for playing with friends)

### 1. Create a Firebase Project (Free)
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Enable **Realtime Database** (not Firestore!)
   - In Database tab → Create database → Start in **test mode** (for development)
4. Add a **Web App** (</> icon)
5. Copy the config object

### 2. Configure the Game
**Option A: URL Parameter (Easiest for sharing)**
```
https://yourusername.github.io/city-drive/?firebase={"apiKey":"...","authDomain":"...","databaseURL":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}
```

**Option B: Edit the config file**
Edit `src/multiplayer.js` and replace `FIREBASE_CONFIG` with your credentials.

### 3. Deploy to GitHub Pages
```bash
# Build and deploy
npm run deploy
```

This uses `gh-pages` to push the `dist` folder to the `gh-pages` branch.

**Enable GitHub Pages:**
1. Go to your repo Settings → Pages
2. Source: "Deploy from a branch"
3. Branch: `gh-pages` / `(root)`
4. Save - your site will be at `https://username.github.io/repo-name/`

## 🎯 How to Play with Friends

1. **You** open the game URL (with Firebase config)
2. **Share** the exact same URL with friends (click "Share Link" button)
3. **They open it** - instantly appear in your city!
4. **Drive together** - no lobby, no waiting, just join and go

## 🎮 Controls

| Platform | Forward | Backward | Left | Right | Boost | Horn | Zoom |
|----------|---------|----------|------|-------|-------|------|------|
| **Keyboard** | W / ↑ | S / ↓ | A / ← | D / → | Shift / Space | H | Mouse wheel |
| **Gamepad** | Left Stick ↑ | Left Stick ↓ | Left Stick ← | Left Stick → | A / RT | B | - |
| **Touch** | 🕹️ Virtual Joystick | | | | 🔥 BOOST | 📢 HORN | Pinch |

## 🛠️ Tech Stack

- **Rendering**: Canvas 2D (no WebGL dependencies, runs everywhere)
- **Physics**: Custom arcade physics (drift, boost, responsive)
- **Networking**: WebRTC DataChannels (P2P) + Firebase Realtime Database (signaling)
- **Build**: Vite (fast, modern)
- **Deployment**: GitHub Pages (free static hosting)

## 📁 Project Structure

```
city-drive/
├── index.html          # Main HTML + UI
├── vite.config.js      # Vite configuration
├── package.json        # Dependencies & scripts
├── public/
│   ├── sw.js           # Service Worker (offline)
│   └── manifest.json   # PWA manifest
└── src/
    ├── main.js         # Entry point
    ├── game.js         # Game loop & orchestration
    ├── city.js         # Procedural city generation
    ├── car.js          # Car physics & rendering
    ├── multiplayer.js  # Firebase + WebRTC networking
    ├── input.js        # Keyboard/Gamepad input
    ├── touch.js        # Touch controls (mobile)
    ├── minimap.js      # Minimap rendering
    └── config.js       # All tweakable constants
```

## ⚙️ Configuration

Edit `src/config.js` to tweak:
- Car physics (speed, acceleration, drift, turn rate)
- City size, density, building heights
- Camera behavior
- Multiplayer settings (send rate, max players)
- Visual style (colors, minimap)
- Touch control layout

## 🔧 Troubleshooting

### "Firebase config not found" / Offline mode
- Make sure you added Firebase config via URL param or edited `multiplayer.js`
- Check browser console for errors
- Verify Realtime Database is in **test mode** (read/write: true)

### Can't connect to friends
- Both must use the **exact same URL** (including firebase param)
- Check browser console for WebRTC errors
- Try refreshing - ICE connection can be flaky on some networks
- Corporate/school WiFi may block WebRTC (try mobile hotspot)

### Low FPS on mobile
- Reduce `citySize` in config.js
- Lower `buildingDensity`
- Disable minimap in config

### GitHub Pages 404 on refresh
- GitHub Pages doesn't support SPA routing
- This game is single-page so it should work
- If using custom domain, ensure HTTPS is enabled (required for WebRTC)

## 📱 PWA Installation

- **Chrome/Edge (Desktop/Android)**: Click "Install App" button or browser menu → Install
- **Safari (iOS)**: Share → Add to Home Screen
- Works offline after first load!

## 🤝 Contributing

PRs welcome! Ideas:
- Better building variety
- Car customization (colors, skins)
- Chat system (WebRTC data channel)
- Stunts/jumps scoring
- Day/night cycle
- Traffic AI

## 📄 License

MIT License - Feel free to use, modify, share!

## 🙏 Credits

- Firebase for free realtime signaling
- Google STUN servers for WebRTC
- Vite for blazing fast builds
- All open source dependencies

---

**Made with ❤️ for playing with friends across cities**

*Deploy your own in 5 minutes - just add Firebase config and push to GitHub!*