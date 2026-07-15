/**
 * Car Physics & Rendering - Arcade style
 */
import { CONFIG } from './config.js';

export class Car {
  constructor(id, color, isLocal = false) {
    this.id = id;
    this.color = color;
    this.isLocal = isLocal;

    // Physics state
    this.x = 0;
    this.y = 0;
    this.angle = 0;          // Radians, 0 = right, -PI/2 = up
    this.speed = 0;          // Current speed (px/sec)
    this.targetSpeed = 0;    // Input target
    this.steering = 0;       // -1 to 1

    // Visual
    this.width = CONFIG.car.width;
    this.length = CONFIG.car.length;
    this.hornTimer = 0;
    this.boostTimer = 0;

    // Network interpolation
    this.netX = 0;
    this.netY = 0;
    this.netAngle = 0;
    this.netSpeed = 0;
    this.lastUpdate = 0;
    this.interpolated = true;
  }

  // Spawn at a position
  spawn(x, y, angle = 0) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 0;
    this.netX = x;
    this.netY = y;
    this.netAngle = angle;
    this.netSpeed = 0;
  }

  // Input for local car
  setInput(forward, backward, left, right, boost, horn) {
    if (!this.isLocal) return;

    let targetAccel = 0;
    if (forward) targetAccel = 1;
    if (backward) targetAccel = -1;

    this.targetSpeed = targetAccel * (boost ? CONFIG.car.maxSpeed * 1.5 : CONFIG.car.maxSpeed);
    this.steering = (right ? 1 : 0) - (left ? 1 : 0);

    if (horn) this.hornTimer = 0.3;
    if (boost) this.boostTimer = 0.1;
  }

  // Update from network (for remote cars)
  updateNetworkState(data, now) {
    if (this.isLocal) return;

    this.netX = data.x;
    this.netY = data.y;
    this.netAngle = data.angle;
    this.netSpeed = data.speed;
    this.lastUpdate = now;
    this.interpolated = true;
  }

  // Physics update
  update(dt, city) {
    const { maxSpeed, acceleration, brakeForce, driftFactor, turnSpeed, turnSpeedMin, drag } = CONFIG.car;

    if (this.isLocal) {
      // Local physics simulation
      this.physicsStep(dt);
      // Clamp to world bounds
      this.clampToWorld(city);
    } else {
      // Network interpolation for remote cars
      this.interpolate(dt);
    }

    // Visual effects timers
    if (this.hornTimer > 0) this.hornTimer -= dt;
    if (this.boostTimer > 0) this.boostTimer -= dt;
  }

  physicsStep(dt) {
    const { maxSpeed, acceleration, brakeForce, driftFactor, turnSpeed, turnSpeedMin, drag } = CONFIG.car;

    // Speed change
    const speedDiff = this.targetSpeed - this.speed;
    const accelForce = this.targetSpeed === 0 ? brakeForce : acceleration;
    const maxSpeedChange = accelForce * dt;
    this.speed += Math.max(-maxSpeedChange, Math.min(maxSpeedChange, speedDiff));

    // Drag
    this.speed *= Math.pow(drag, dt * 60);

    // Turning (speed dependent)
    const speedRatio = Math.abs(this.speed) / maxSpeed;
    const currentTurnSpeed = turnSpeedMin + (turnSpeed - turnSpeedMin) * speedRatio;
    this.angle += this.steering * currentTurnSpeed * dt * (this.speed >= 0 ? 1 : -1);

    // Velocity vector
    const forwardX = Math.cos(this.angle);
    const forwardY = Math.sin(this.angle);

    // Drift: lateral velocity reduction
    const lateralX = -forwardY * this.speed * (1 - driftFactor);
    const lateralY = forwardX * this.speed * (1 - driftFactor);

    // Apply movement
    this.x += (forwardX * this.speed + lateralX) * dt;
    this.y += (forwardY * this.speed + lateralY) * dt;
  }

  interpolate(dt) {
    if (!this.interpolated) return;

    const lerpFactor = Math.min(1, dt * 15); // Smooth interpolation
    this.x += (this.netX - this.x) * lerpFactor;
    this.y += (this.netY - this.y) * lerpFactor;

    // Angle interpolation (shortest path)
    let angleDiff = this.netAngle - this.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.angle += angleDiff * lerpFactor;

    this.speed += (this.netSpeed - this.speed) * lerpFactor;
  }

  clampToWorld(city) {
    const bounds = city.getWorldBounds();
    const margin = Math.max(this.width, this.length) / 2;

    this.x = Math.max(bounds.minX + margin, Math.min(bounds.maxX - margin, this.x));
    this.y = Math.max(bounds.minY + margin, Math.min(bounds.maxY - margin, this.y));
  }

  // Get state for network broadcast
  getNetworkState() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      angle: this.angle,
      speed: this.speed,
      color: this.color
    };
  }

  // Render car
  render(ctx, camera, isLocal = false) {
    const { x: camX, y: camY, zoom } = camera;
    const sx = (this.x - camX) * zoom;
    const sy = (this.y - camY) * zoom;
    const sw = this.width * zoom;
    const sl = this.length * zoom;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.angle);

    // Car body shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(2 * zoom, 4 * zoom, sw * 0.6, sl * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Car body
    const gradient = ctx.createLinearGradient(-sw/2, -sl/2, -sw/2, sl/2);
    gradient.addColorStop(0, this.lightenColor(this.color, 0.2));
    gradient.addColorStop(0.5, this.color);
    gradient.addColorStop(1, this.darkenColor(this.color, 0.3));
    ctx.fillStyle = gradient;

    this.drawCarBody(ctx, sw, sl, zoom);

    // Windows
    ctx.fillStyle = 'rgba(20, 20, 40, 0.8)';
    this.drawWindows(ctx, sw, sl, zoom);

    // Headlights / Taillights
    this.drawLights(ctx, sw, sl, zoom);

    // Boost effect
    if (this.boostTimer > 0 && isLocal) {
      this.drawBoost(ctx, sw, sl, zoom);
    }

    // Horn visual
    if (this.hornTimer > 0) {
      this.drawHorn(ctx, sw, sl, zoom);
    }

    // Player name/ID label
    if (isLocal) {
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(10, 12 * zoom)}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('YOU', 0, -sl/2 - 8 * zoom);
    }

    ctx.restore();
  }

  drawCarBody(ctx, w, l, zoom) {
    const r = 4 * zoom; // Corner radius
    const hw = w / 2;
    const hl = l / 2;

    ctx.beginPath();
    // Rounded rectangle for car body
    ctx.moveTo(-hw + r, -hl);
    ctx.lineTo(hw - r, -hl);
    ctx.quadraticCurveTo(hw, -hl, hw, -hl + r);
    ctx.lineTo(hw, hl - r * 2);
    ctx.quadraticCurveTo(hw, hl, hw - r * 1.5, hl);
    ctx.lineTo(-hw + r * 1.5, hl);
    ctx.quadraticCurveTo(-hw, hl, -hw, hl - r * 2);
    ctx.lineTo(-hw, -hl + r);
    ctx.quadraticCurveTo(-hw, -hl, -hw + r, -hl);
    ctx.closePath();
    ctx.fill();
  }

  drawWindows(ctx, w, l, zoom) {
    const hw = w / 2;
    const hl = l / 2;
    const inset = 3 * zoom;

    // Windshield
    ctx.beginPath();
    ctx.moveTo(-hw + inset, -hl + inset);
    ctx.lineTo(hw - inset, -hl + inset);
    ctx.lineTo(hw * 0.5 - inset, -hl * 0.3);
    ctx.lineTo(-hw * 0.5 + inset, -hl * 0.3);
    ctx.closePath();
    ctx.fill();

    // Rear window
    ctx.beginPath();
    ctx.moveTo(-hw * 0.5 + inset, hl * 0.3);
    ctx.lineTo(hw * 0.5 - inset, hl * 0.3);
    ctx.lineTo(hw - inset, hl - inset);
    ctx.lineTo(-hw + inset, hl - inset);
    ctx.closePath();
    ctx.fill();

    // Side windows
    ctx.fillRect(-hw + inset, -hl * 0.3, w - inset * 2, hl * 0.6);
  }

  drawLights(ctx, w, l, zoom) {
    const hw = w / 2;
    const hl = l / 2;

    // Headlights (front)
    ctx.fillStyle = '#fff8cc';
    ctx.beginPath();
    ctx.ellipse(-hw * 0.6, -hl + 2 * zoom, 4 * zoom, 3 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(hw * 0.6, -hl + 2 * zoom, 4 * zoom, 3 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    // Taillights (rear)
    ctx.fillStyle = '#ff3333';
    ctx.beginPath();
    ctx.ellipse(-hw * 0.6, hl - 2 * zoom, 4 * zoom, 3 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(hw * 0.6, hl - 2 * zoom, 4 * zoom, 3 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    // Brake lights when reversing or braking
    if (this.speed < -10 || (this.targetSpeed === 0 && Math.abs(this.speed) > 5)) {
      ctx.fillStyle = '#ff0000';
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.ellipse(-hw * 0.6, hl - 2 * zoom, 5 * zoom, 4 * zoom, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(hw * 0.6, hl - 2 * zoom, 5 * zoom, 4 * zoom, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  drawBoost(ctx, w, l, zoom) {
    const hl = l / 2;
    const intensity = this.boostTimer / 0.1;

    // Exhaust particles
    ctx.fillStyle = `rgba(255, 165, 0, ${0.6 * intensity})`;
    for (let i = 0; i < 4; i++) {
      const offsetX = (Math.random() - 0.5) * w * 0.5;
      const offsetY = hl + Math.random() * 15 * zoom * intensity;
      const size = (2 + Math.random() * 4) * zoom * intensity;
      ctx.beginPath();
      ctx.ellipse(offsetX, offsetY, size, size * 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Blue flame
    ctx.fillStyle = `rgba(0, 200, 255, ${0.5 * intensity})`;
    for (let i = 0; i < 3; i++) {
      const offsetX = (Math.random() - 0.5) * w * 0.3;
      const offsetY = hl + 10 * zoom + Math.random() * 20 * zoom * intensity;
      const size = (3 + Math.random() * 5) * zoom * intensity;
      ctx.beginPath();
      ctx.ellipse(offsetX, offsetY, size, size * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawHorn(ctx, w, l, zoom) {
    const hw = w / 2;
    const hl = l / 2;
    const alpha = this.hornTimer / 0.3;

    // Sound wave rings
    ctx.strokeStyle = `rgba(255, 255, 100, ${0.5 * alpha})`;
    ctx.lineWidth = 2 * zoom;
    for (let i = 0; i < 3; i++) {
      const r = (10 + i * 8 + (1 - alpha) * 20) * zoom;
      ctx.beginPath();
      ctx.ellipse(0, -hl - 10 * zoom, r, r * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  lightenColor(hex, factor) {
    const rgb = this.hexToRgb(hex);
    return `rgb(${Math.min(255, rgb.r + 255 * factor)}, ${Math.min(255, rgb.g + 255 * factor)}, ${Math.min(255, rgb.b + 255 * factor)})`;
  }

  darkenColor(hex, factor) {
    const rgb = this.hexToRgb(hex);
    return `rgb(${Math.max(0, rgb.r - 255 * factor)}, ${Math.max(0, rgb.g - 255 * factor)}, ${Math.max(0, rgb.b - 255 * factor)})`;
  }

  hexToRgb(hex) {
    const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 200, g: 50, b: 50 };
  }
}