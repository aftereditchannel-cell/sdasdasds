/**
 * Main Game Class - Orchestrates city, cars, multiplayer, input, rendering
 */
import { CONFIG } from './config.js';
import { City } from './city.js';
import { Car } from './car.js';
import { Multiplayer, FIREBASE_CONFIG } from './multiplayer.js';
import { InputManager } from './input.js';
import { TouchControls } from './touch.js';
import { Minimap } from './minimap.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.running = false;
    this.lastTime = 0;
    this.frameCount = 0;
    this.fps = 0;
    this.fpsTimer = 0;

    // Core systems
    this.city = new City();
    this.localCar = null;
    this.remoteCars = new Map(); // id -> Car
    this.multiplayer = new Multiplayer();
    this.input = new InputManager();
    this.touchControls = null;
    this.minimap = null;

    // Camera
    this.camera = {
      x: 0, y: 0,
      zoom: CONFIG.camera.zoom,
      targetX: 0, targetY: 0
    };

    // Setup multiplayer callbacks
    this.multiplayer.onPlayerJoin = (id, data) => this.onPlayerJoin(id, data);
    this.multiplayer.onPlayerLeave = (id) => this.onPlayerLeave(id);
    this.multiplayer.onStateUpdate = (id, state) => this.onRemoteStateUpdate(id, state);
  }

  async init(firebaseConfig = null) {
    // Initialize city
    this.city.init();

    // Create local car
    const spawn = this.city.getRandomSpawnPoint();
    const color = CONFIG.canvas.carColors[Math.floor(Math.random() * CONFIG.canvas.carColors.length)];
    this.localCar = new Car(this.multiplayer.getPlayerId(), color, true);
    this.localCar.spawn(spawn.x, spawn.y, spawn.angle);
    this.multiplayer.setLocalCar(this.localCar);

    // Camera starts at car
    this.camera.x = this.localCar.x;
    this.camera.y = this.localCar.y;
    this.camera.targetX = this.localCar.x;
    this.camera.targetY = this.localCar.y;

    // Initialize input
    this.input.init();

    // Initialize touch controls (for mobile)
    this.touchControls = new TouchControls(this.canvas, this.input);

    // Initialize minimap
    this.minimap = new Minimap(this.canvas, this.city, this.camera);

    // Connect to multiplayer
    const connected = await this.multiplayer.init(firebaseConfig);
    if (!connected) {
      console.log('[Game] Running in offline mode (no Firebase config)');
    }

    // Listen for signals (must be after init)
    if (this.multiplayer.db) {
      this.multiplayer.listenForSignals();
    }

    return connected;
  }

  onPlayerJoin(id, data) {
    console.log('[Game] Player joined:', id);
    const color = data.car?.color || CONFIG.canvas.carColors[this.remoteCars.size % CONFIG.canvas.carColors.length];
    const car = new Car(id, color, false);
    if (data.car) {
      car.spawn(data.car.x, data.car.y, data.car.angle);
      car.netX = data.car.x;
      car.netY = data.car.y;
      car.netAngle = data.car.angle;
      car.netSpeed = data.car.speed;
    }
    this.remoteCars.set(id, car);
  }

  onPlayerLeave(id) {
    console.log('[Game] Player left:', id);
    this.remoteCars.delete(id);
  }

  onRemoteStateUpdate(id, state) {
    const car = this.remoteCars.get(id);
    if (car) {
      car.updateNetworkState(state, performance.now());
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  stop() {
    this.running = false;
    this.multiplayer.disconnect();
  }

  gameLoop(currentTime) {
    if (!this.running) return;

    const dt = Math.min((currentTime - this.lastTime) / 1000, CONFIG.performance.maxDeltaTime / 1000);
    this.lastTime = currentTime;

    this.update(dt);
    this.render();

    // FPS counter
    this.frameCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 1) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    requestAnimationFrame(this.gameLoop.bind(this));
  }

  update(dt) {
    // Get input state
    const inputState = this.input.getState();

    // Update local car
    this.localCar.setInput(
      inputState.forward,
      inputState.backward,
      inputState.left,
      inputState.right,
      inputState.boost,
      inputState.horn
    );
    this.localCar.update(dt, this.city);

    // Update remote cars
    for (const car of this.remoteCars.values()) {
      car.update(dt, this.city);
    }

    // Update camera
    this.updateCamera(dt);

    // Update touch controls visibility
    this.touchControls.update(inputState);
  }

  updateCamera(dt) {
    const { followLerp, lookAhead } = CONFIG.camera;

    // Look ahead in direction of travel
    const lookX = Math.cos(this.localCar.angle) * lookAhead * (this.localCar.speed / CONFIG.car.maxSpeed);
    const lookY = Math.sin(this.localCar.angle) * lookAhead * (this.localCar.speed / CONFIG.car.maxSpeed);

    this.camera.targetX = this.localCar.x + lookX;
    this.camera.targetY = this.localCar.y + lookY;

    // Smooth follow
    this.camera.x += (this.camera.targetX - this.camera.x) * followLerp;
    this.camera.y += (this.camera.targetY - this.camera.y) * followLerp;

    // Clamp to world bounds
    const bounds = this.city.getWorldBounds();
    const halfW = this.canvas.width / 2 / this.camera.zoom;
    const halfH = this.canvas.height / 2 / this.camera.zoom;
    this.camera.x = Math.max(bounds.minX + halfW, Math.min(bounds.maxX - halfW, this.camera.x));
    this.camera.y = Math.max(bounds.minY + halfH, Math.min(bounds.maxY - halfH, this.camera.y));
  }

  render() {
    const { width, height } = this.canvas;
    const ctx = this.ctx;

    // Clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Apply camera transform
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    // Render city
    this.city.render(ctx, this.camera);

    // Render remote cars (behind local for depth)
    for (const car of this.remoteCars.values()) {
      car.render(ctx, this.camera, false);
    }

    // Render local car (on top)
    this.localCar.render(ctx, this.camera, true);

    ctx.restore();

    // Render UI (minimap, HUD, touch controls)
    this.minimap.render(ctx);
    this.renderHUD(ctx);
    this.touchControls.render(ctx);
  }

  renderHUD(ctx) {
    const { width, height } = this.canvas;

    // Speedometer
    const speed = Math.abs(Math.round(this.localCar.speed * 3.6)); // Convert to km/h
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(10, 10, 140, 60);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`${speed} km/h`, 20, 45);
    ctx.font = '12px Arial';
    ctx.fillStyle = '#aaa';
    ctx.fillText(this.multiplayer.isOfflineMode() ? 'OFFLINE' : 'ONLINE', 20, 60);

    // Player count
    const playerCount = 1 + this.remoteCars.size;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(width - 120, 10, 110, 40);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`${playerCount} / ${CONFIG.multiplayer.maxPlayers}`, width - 20, 35);

    // FPS (debug)
    if (this.fps < 30) {
      ctx.fillStyle = '#ff4444';
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`FPS: ${this.fps}`, 10, height - 10);
    }

    // Instructions
    if (this.frameCount < 300) { // Show for first 5 seconds
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(width / 2 - 150, height - 80, 300, 70);
      ctx.fillStyle = '#fff';
      ctx.font = '13px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('WASD / Arrows: Drive  |  Shift: Boost  |  H: Horn', width / 2, height - 55);
      ctx.fillText('Mouse wheel / Pinch: Zoom  |  Share URL to play with friends!', width / 2, height - 30);
    }
  }

  // Handle resize
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.scale(dpr, dpr);
    this.touchControls?.resize();
    this.minimap?.resize();
  }

  // Zoom control
  setZoom(delta) {
    this.camera.zoom = Math.max(CONFIG.camera.zoomMin, Math.min(CONFIG.camera.zoomMax, this.camera.zoom + delta));
  }
}