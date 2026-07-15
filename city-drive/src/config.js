/**
 * Game Configuration - Tweak these for feel/performance
 */
export const CONFIG = {
  // Canvas & Rendering
  canvas: {
    backgroundColor: '#1a1a2e',
    roadColor: '#2d2d44',
    roadLineColor: '#4a4a6a',
    buildingColors: ['#2a2a3e', '#3a3a4e', '#252535', '#303040'],
    buildingWindowColor: '#ffd70055',
    carColors: ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#e67e22', '#1abc9c', '#ecf0f1'],
    minimap: {
      enabled: true,
      size: 150,
      position: 'bottom-right',
      playerDotColor: '#ffffff',
      otherDotColor: '#ff6b6b',
      roadColor: '#444466',
      backgroundColor: '#0a0a1a'
    }
  },

  // World
  world: {
    citySize: 3000,        // World size in pixels
    blockSize: 200,        // City block size
    roadWidth: 40,         // Road width
    sidewalkWidth: 8,      // Sidewalk width
    buildingDensity: 0.7,  // 0-1 chance of building per lot
    minBuildingHeight: 60,
    maxBuildingHeight: 180
  },

  // Car Physics (Arcade style)
  car: {
    width: 28,
    length: 50,
    maxSpeed: 350,         // px/sec
    acceleration: 600,     // px/sec^2
    brakeForce: 900,       // px/sec^2
    driftFactor: 0.85,     // Lateral grip (lower = more drift)
    turnSpeed: 3.5,        // rad/sec at max speed
    turnSpeedMin: 2.0,     // rad/sec at low speed
    drag: 0.98,            // Air resistance per frame
    mass: 1
  },

  // Camera
  camera: {
    followLerp: 0.12,      // Camera smoothing
    lookAhead: 120,        // Look ahead distance
    zoom: 1.0,
    zoomMin: 0.5,
    zoomMax: 2.0
  },

  // Multiplayer
  multiplayer: {
    roomId: 'city-drive-lobby',  // Single shared room
    maxPlayers: 16,
    stateSendRate: 30,     // Hz - how often to send position
    interpolationDelay: 50 // ms - buffer for smooth interpolation
  },

  // Controls
  controls: {
    touch: {
      buttonSize: 80,
      buttonMargin: 20,
      opacity: 0.7,
      activeOpacity: 1.0
    },
    keyboard: {
      forward: ['ArrowUp', 'KeyW'],
      backward: ['ArrowDown', 'KeyS'],
      left: ['ArrowLeft', 'KeyA'],
      right: ['ArrowRight', 'KeyD'],
      boost: ['ShiftLeft', 'Space'],
      horn: ['KeyH'],
      cameraZoomIn: ['Equal', 'NumpadAdd'],
      cameraZoomOut: ['Minus', 'NumpadSubtract']
    }
  },

  // Performance
  performance: {
    targetFPS: 60,
    maxDeltaTime: 100,     // ms - cap for tab in background
    cullingMargin: 200     // Extra pixels around screen for culling
  }
};