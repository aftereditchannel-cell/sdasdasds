/**
 * Touch Controls - Virtual joystick + buttons for mobile
 */
import { CONFIG } from './config.js';

export class TouchControls {
  constructor(canvas, inputManager) {
    this.canvas = canvas;
    this.input = inputManager;
    this.active = false;
    this.visible = false;

    // Joystick (left side)
    this.joystick = {
      x: 0, y: 0,
      baseX: 0, baseY: 0,
      radius: 0,
      touchId: null,
      active: false
    };

    // Buttons (right side)
    this.buttons = {
      boost: { x: 0, y: 0, radius: 0, touchId: null, pressed: false },
      horn: { x: 0, y: 0, radius: 0, touchId: null, pressed: false }
    };

    this.bindEvents();
    this.resize();
  }

  bindEvents() {
    this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
    this.canvas.addEventListener('touchcancel', this.onTouchEnd.bind(this), { passive: false });

    // Also handle pointer events for hybrid devices
    this.canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
    this.canvas.addEventListener('pointermove', this.onPointerMove.bind(this));
    this.canvas.addEventListener('pointerup', this.onPointerUp.bind(this));
    this.canvas.addEventListener('pointerleave', this.onPointerUp.bind(this));
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const { buttonSize, buttonMargin } = CONFIG.controls.touch;

    // Joystick base position (bottom left)
    this.joystick.baseX = buttonMargin + buttonSize;
    this.joystick.baseY = rect.height - buttonMargin - buttonSize;
    this.joystick.radius = buttonSize * 1.2;
    this.joystick.x = this.joystick.baseX;
    this.joystick.y = this.joystick.baseY;

    // Buttons (bottom right)
    const rightMargin = buttonMargin;
    this.buttons.boost.radius = buttonSize;
    this.buttons.boost.x = rect.width - rightMargin - buttonSize;
    this.buttons.boost.y = rect.height - rightMargin - buttonSize * 2 - buttonMargin;

    this.buttons.horn.radius = buttonSize * 0.7;
    this.buttons.horn.x = rect.width - rightMargin - this.buttons.horn.radius;
    this.buttons.horn.y = rect.height - rightMargin - this.buttons.horn.radius;
  }

  // Touch events
  onTouchStart(e) {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      this.handleTouchStart(touch.identifier, touch.clientX, touch.clientY);
    }
    this.updateVisibility(true);
  }

  onTouchMove(e) {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      this.handleTouchMove(touch.identifier, touch.clientX, touch.clientY);
    }
  }

  onTouchEnd(e) {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      this.handleTouchEnd(touch.identifier);
    }
    // Check if any touches remain
    if (e.touches.length === 0) {
      this.updateVisibility(false);
    }
  }

  // Pointer events (mouse/pen/touch unified)
  onPointerDown(e) {
    if (e.pointerType === 'mouse') return; // Don't interfere with mouse
    this.handleTouchStart(e.pointerId, e.clientX, e.clientY);
    this.updateVisibility(true);
    e.preventDefault();
  }

  onPointerMove(e) {
    if (e.pointerType === 'mouse') return;
    this.handleTouchMove(e.pointerId, e.clientX, e.clientY);
    e.preventDefault();
  }

  onPointerUp(e) {
    if (e.pointerType === 'mouse') return;
    this.handleTouchEnd(e.pointerId);
    if (e.buttons === 0) this.updateVisibility(false);
    e.preventDefault();
  }

  handleTouchStart(id, x, y) {
    // Check joystick area (left side)
    const dx = x - this.joystick.baseX;
    const dy = y - this.joystick.baseY;
    const distJoy = Math.hypot(dx, dy);

    if (distJoy <= this.joystick.radius * 1.5 && x < this.canvas.getBoundingClientRect().width / 2) {
      this.joystick.touchId = id;
      this.joystick.active = true;
      this.updateJoystick(x, y);
      return;
    }

    // Check boost button
    const dxB = x - this.buttons.boost.x;
    const dyB = y - this.buttons.boost.y;
    if (Math.hypot(dxB, dyB) <= this.buttons.boost.radius * 1.2) {
      this.buttons.boost.touchId = id;
      this.buttons.boost.pressed = true;
      this.input.setTouchState({ boost: true });
      return;
    }

    // Check horn button
    const dxH = x - this.buttons.horn.x;
    const dyH = y - this.buttons.horn.y;
    if (Math.hypot(dxH, dyH) <= this.buttons.horn.radius * 1.2) {
      this.buttons.horn.touchId = id;
      this.buttons.horn.pressed = true;
      this.input.setTouchState({ horn: true });
      return;
    }
  }

  handleTouchMove(id, x, y) {
    if (this.joystick.touchId === id && this.joystick.active) {
      this.updateJoystick(x, y);
    } else if (this.buttons.boost.touchId === id) {
      // Check if still over button
      const dx = x - this.buttons.boost.x;
      const dy = y - this.buttons.boost.y;
      const over = Math.hypot(dx, dy) <= this.buttons.boost.radius * 1.5;
      if (this.buttons.boost.pressed !== over) {
        this.buttons.boost.pressed = over;
        this.input.setTouchState({ boost: over });
      }
    } else if (this.buttons.horn.touchId === id) {
      const dx = x - this.buttons.horn.x;
      const dy = y - this.buttons.horn.y;
      const over = Math.hypot(dx, dy) <= this.buttons.horn.radius * 1.5;
      if (this.buttons.horn.pressed !== over) {
        this.buttons.horn.pressed = over;
        this.input.setTouchState({ horn: over });
      }
    }
  }

  handleTouchEnd(id) {
    if (this.joystick.touchId === id) {
      this.joystick.touchId = null;
      this.joystick.active = false;
      this.joystick.x = this.joystick.baseX;
      this.joystick.y = this.joystick.baseY;
      this.input.setTouchState({ forward: false, backward: false, left: false, right: false });
    }
    if (this.buttons.boost.touchId === id) {
      this.buttons.boost.touchId = null;
      this.buttons.boost.pressed = false;
      this.input.setTouchState({ boost: false });
    }
    if (this.buttons.horn.touchId === id) {
      this.buttons.horn.touchId = null;
      this.buttons.horn.pressed = false;
      this.input.setTouchState({ horn: false });
    }
  }

  updateJoystick(x, y) {
    const dx = x - this.joystick.baseX;
    const dy = y - this.joystick.baseY;
    const dist = Math.hypot(dx, dy);
    const maxDist = this.joystick.radius;

    if (dist > maxDist) {
      this.joystick.x = this.joystick.baseX + (dx / dist) * maxDist;
      this.joystick.y = this.joystick.baseY + (dy / dist) * maxDist;
    } else {
      this.joystick.x = x;
      this.joystick.y = y;
    }

    // Normalize to -1..1
    const nx = (this.joystick.x - this.joystick.baseX) / maxDist;
    const ny = (this.joystick.y - this.joystick.baseY) / maxDist;

    // Deadzone
    const deadzone = 0.15;
    this.input.setTouchState({
      forward: ny < -deadzone,
      backward: ny > deadzone,
      left: nx < -deadzone,
      right: nx > deadzone
    });
  }

  updateVisibility(visible) {
    this.visible = visible;
    // Only show on touch devices
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.active = visible && isTouch;
  }

  update(inputState) {
    // Keep visibility in sync
    if (inputState.forward || inputState.backward || inputState.left || inputState.right ||
        inputState.boost || inputState.horn) {
      this.updateVisibility(true);
    }
  }

  render(ctx) {
    if (!this.active) return;

    const { buttonSize, opacity, activeOpacity } = CONFIG.controls.touch;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Scale for high DPI
    ctx.save();
    ctx.scale(1 / dpr, 1 / dpr);

    // Joystick base
    ctx.globalAlpha = this.joystick.active ? activeOpacity : opacity;
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(this.joystick.baseX, this.joystick.baseY, this.joystick.radius, 0, Math.PI * 2);
    ctx.fill();

    // Joystick stick
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(this.joystick.x, this.joystick.y, this.joystick.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Direction indicators
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.joystick.baseX, this.joystick.baseY - this.joystick.radius);
    ctx.lineTo(this.joystick.baseX, this.joystick.baseY + this.joystick.radius);
    ctx.moveTo(this.joystick.baseX - this.joystick.radius, this.joystick.baseY);
    ctx.lineTo(this.joystick.baseX + this.joystick.radius, this.joystick.baseY);
    ctx.stroke();

    // Boost button
    ctx.globalAlpha = this.buttons.boost.pressed ? activeOpacity : opacity;
    ctx.fillStyle = this.buttons.boost.pressed ? '#e74c3c' : '#444';
    ctx.beginPath();
    ctx.arc(this.buttons.boost.x, this.buttons.boost.y, this.buttons.boost.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${buttonSize * 0.4}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BOOST', this.buttons.boost.x, this.buttons.boost.y);

    // Horn button
    ctx.globalAlpha = this.buttons.horn.pressed ? activeOpacity : opacity;
    ctx.fillStyle = this.buttons.horn.pressed ? '#f39c12' : '#444';
    ctx.beginPath();
    ctx.arc(this.buttons.horn.x, this.buttons.horn.y, this.buttons.horn.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${this.buttons.horn.radius * 0.5}px Arial`;
    ctx.fillText('📢', this.buttons.horn.x, this.buttons.horn.y + 2);

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  destroy() {
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
    this.canvas.removeEventListener('touchcancel', this.onTouchEnd);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointerleave', this.onPointerUp);
  }
}