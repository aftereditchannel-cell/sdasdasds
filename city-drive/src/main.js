/**
 * Entry Point - Initialize and start the game
 */
import { Game } from './game.js';
import { FIREBASE_CONFIG } from './multiplayer.js';

// Get canvas
const canvas = document.getElementById('game-canvas');
if (!canvas) {
  console.error('Canvas element not found!');
  throw new Error('Canvas element not found');
}

// Create game instance
const game = new Game(canvas);

// Handle resize
function resize() {
  game.resize();
}
window.addEventListener('resize', resize);
resize();

// Handle zoom with mouse wheel
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  game.setZoom(delta);
}, { passive: false });

// Handle pinch zoom (touch)
let initialPinchDistance = null;
let initialZoom = null;

canvas.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    initialPinchDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    initialZoom = game.camera.zoom;
  }
}, { passive: true });

canvas.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2 && initialPinchDistance !== null) {
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const currentDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    const scale = currentDistance / initialPinchDistance;
    game.camera.zoom = Math.max(0.5, Math.min(2.0, initialZoom * scale));
    e.preventDefault();
  }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  if (e.touches.length < 2) {
    initialPinchDistance = null;
    initialZoom = null;
  }
}, { passive: true });

// Prevent context menu on long press
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Initialize and start
async function start() {
  // Show loading
  const loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.textContent = 'Loading city...';

  try {
    // Allow Firebase config to be passed via URL param for easy testing
    const urlParams = new URLSearchParams(window.location.search);
    const firebaseParam = urlParams.get('firebase');
    let firebaseConfig = null;

    if (firebaseParam) {
      try {
        firebaseConfig = JSON.parse(decodeURIComponent(firebaseParam));
      } catch (e) {
        console.warn('Invalid firebase config in URL');
      }
    }

    const connected = await game.init(firebaseConfig);

    if (loadingEl) {
      loadingEl.textContent = connected ? 'Connected! Driving...' : 'Offline mode - Add Firebase config for multiplayer';
      setTimeout(() => loadingEl.style.display = 'none', 2000);
    }

    game.start();

    // Share button
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
      shareBtn.onclick = () => {
        const url = window.location.href.split('?')[0];
        navigator.clipboard.writeText(url).then(() => {
          shareBtn.textContent = 'Copied!';
          setTimeout(() => shareBtn.textContent = 'Share Link', 2000);
        });
      };
    }

    // Firebase config helper
    const configBtn = document.getElementById('config-btn');
    const configPanel = document.getElementById('config-panel');
    const configForm = document.getElementById('config-form');

    if (configBtn && configPanel) {
      configBtn.onclick = () => configPanel.style.display = configPanel.style.display === 'none' ? 'block' : 'none';
    }

    if (configForm) {
      configForm.onsubmit = (e) => {
        e.preventDefault();
        const config = {
          apiKey: document.getElementById('fb-apiKey').value,
          authDomain: document.getElementById('fb-authDomain').value,
          databaseURL: document.getElementById('fb-databaseURL').value,
          projectId: document.getElementById('fb-projectId').value,
          storageBucket: document.getElementById('fb-storageBucket').value,
          messagingSenderId: document.getElementById('fb-messagingSenderId').value,
          appId: document.getElementById('fb-appId').value
        };
        // Reload with config in URL
        const url = new URL(window.location.href);
        url.searchParams.set('firebase', encodeURIComponent(JSON.stringify(config)));
        window.location.href = url.toString();
      };
    }

  } catch (e) {
    console.error('Failed to start game:', e);
    if (loadingEl) loadingEl.textContent = 'Error: ' + e.message;
  }
}

start();

// Export for debugging
window.game = game;