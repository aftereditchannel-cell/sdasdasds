/**
 * Minimap - Shows city layout and player positions
 */
import { CONFIG } from './config.js';

export class Minimap {
  constructor(canvas, city, camera) {
    this.canvas = canvas;
    this.city = city;
    this.camera = camera;
    this.enabled = CONFIG.canvas.minimap.enabled;
    this.size = CONFIG.canvas.minimap.size;
    this.position = CONFIG.canvas.minimap.position;
    this.localCar = null;
    this.remoteCars = null;
  }

  setCars(localCar, remoteCars) {
    this.localCar = localCar;
    this.remoteCars = remoteCars;
  }

  resize() {
    // Size is fixed in CSS pixels
  }

  render(ctx) {
    if (!this.enabled || !this.localCar) return;

    const { width, height } = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = width / dpr;
    const cssHeight = height / dpr;

    // Calculate minimap position
    let mx, my;
    const margin = 10;
    const size = this.size;

    switch (this.position) {
      case 'bottom-right':
        mx = cssWidth - size - margin;
        my = cssHeight - size - margin;
        break;
      case 'bottom-left':
        mx = margin;
        my = cssHeight - size - margin;
        break;
      case 'top-right':
        mx = cssWidth - size - margin;
        my = margin;
        break;
      case 'top-left':
      default:
        mx = margin;
        my = margin;
        break;
    }

    const { backgroundColor, roadColor, playerDotColor, otherDotColor } = CONFIG.canvas.minimap;
    const worldBounds = this.city.getWorldBounds();
    const worldSize = worldBounds.maxX - worldBounds.minX;

    // Scale factor: world -> minimap
    const scale = size / worldSize;

    // Save context
    ctx.save();

    // Background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(mx, my, size, size);

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, size, size);

    // Draw roads
    ctx.fillStyle = roadColor;
    for (const road of this.city.roads) {
      if (!road.type.endsWith('-driving')) continue;

      const rx = mx + (road.x - worldBounds.minX) * scale;
      const ry = my + (road.y - worldBounds.minY) * scale;
      const rw = road.width * scale;
      const rh = road.height * scale;

      // Only draw if visible
      if (rx + rw >= mx && rx <= mx + size && ry + rh >= my && ry <= my + size) {
        ctx.fillRect(Math.max(mx, rx), Math.max(my, ry),
          Math.min(mx + size, rx + rw) - Math.max(mx, rx),
          Math.min(my + size, ry + rh) - Math.max(my, ry));
      }
    }

    // Draw remote cars
    if (this.remoteCars) {
      ctx.fillStyle = otherDotColor;
      for (const car of this.remoteCars.values()) {
        const px = mx + (car.x - worldBounds.minX) * scale;
        const py = my + (car.y - worldBounds.minY) * scale;
        if (px >= mx && px <= mx + size && py >= my && py <= my + size) {
          ctx.beginPath();
          ctx.arc(px, py, Math.max(2, 3 * scale), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Draw local car (on top)
    ctx.fillStyle = playerDotColor;
    const lx = mx + (this.localCar.x - worldBounds.minX) * scale;
    const ly = my + (this.localCar.y - worldBounds.minY) * scale;
    if (lx >= mx && lx <= mx + size && ly >= my && ly <= my + size) {
      // Triangle pointing in car direction
      const arrowSize = Math.max(3, 5 * scale);
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(this.localCar.angle);
      ctx.beginPath();
      ctx.moveTo(0, -arrowSize);
      ctx.lineTo(-arrowSize * 0.6, arrowSize * 0.6);
      ctx.lineTo(arrowSize * 0.6, arrowSize * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Camera view indicator
    const camScale = 1 / this.camera.zoom;
    const viewW = size * camScale;
    const viewH = size * camScale;
    const viewX = mx + (this.camera.x - worldBounds.minX) * scale - viewW / 2;
    const viewY = my + (this.camera.y - worldBounds.minY) * scale - viewH / 2;

    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1 / dpr;
    ctx.setLineDash([4 / dpr, 4 / dpr]);
    ctx.strokeRect(viewX, viewY, viewW, viewH);
    ctx.setLineDash([]);

    ctx.restore();
  }
}