/**
 * Input Manager - Keyboard + Touch abstraction
 */
import { CONFIG } from './config.js';

export class InputManager {
  constructor() {
    this.keys = new Set();
    this.touchState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      boost: false,
      horn: false
    };
    this.gamepadIndex = null;
    this.listenersAttached = false;
  }

  init() {
    if (this.listenersAttached) return;

    // Keyboard
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));

    // Prevent default for game keys
    window.addEventListener('keydown', (e) => {
      if (this.isGameKey(e.code)) e.preventDefault();
    }, { passive: false });

    // Gamepad
    window.addEventListener('gamepadconnected', (e) => {
      console.log('[Input] Gamepad connected:', e.gamepad.id);
      this.gamepadIndex = e.gamepad.index;
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      if (this.gamepadIndex === e.gamepad.index) this.gamepadIndex = null;
    });

    // Touch is handled by TouchControls class

    this.listenersAttached = true;
  }

  onKeyDown(e) {
    this.keys.add(e.code);
  }

  onKeyUp(e) {
    this.keys.delete(e.code);
  }

  isGameKey(code) {
    const { keyboard } = CONFIG.controls;
    return [...keyboard.forward, ...keyboard.backward, ...keyboard.left, ...keyboard.right,
      ...keyboard.boost, ...keyboard.horn].includes(code);
  }

  // Check if any of the key codes are pressed
  isAnyPressed(codes) {
    return codes.some(c => this.keys.has(c));
  }

  getState() {
    const { keyboard } = CONFIG.controls;

    // Keyboard state
    const kbForward = this.isAnyPressed(keyboard.forward);
    const kbBackward = this.isAnyPressed(keyboard.backward);
    const kbLeft = this.isAnyPressed(keyboard.left);
    const kbRight = this.isAnyPressed(keyboard.right);
    const kbBoost = this.isAnyPressed(keyboard.boost);
    const kbHorn = this.isAnyPressed(keyboard.horn);

    // Gamepad state
    let gpForward = false, gpBackward = false, gpLeft = false, gpRight = false, gpBoost = false, gpHorn = false;
    if (this.gamepadIndex !== null) {
      const gp = navigator.getGamepads()[this.gamepadIndex];
      if (gp) {
        // Left stick Y for forward/backward
        const ly = gp.axes[1] || 0;
        const lx = gp.axes[0] || 0;
        const deadzone = 0.15;
        gpForward = ly < -deadzone;
        gpBackward = ly > deadzone;
        gpLeft = lx < -deadzone;
        gpRight = lx > deadzone;

        // Buttons: A (0) = boost, B (1) = horn, RT (7) = boost
        gpBoost = gp.buttons[0]?.pressed || gp.buttons[7]?.pressed;
        gpHorn = gp.buttons[1]?.pressed;
      }
    }

    // Touch state (set by TouchControls)
    const t = this.touchState;

    // Combine all inputs (OR logic)
    return {
      forward: kbForward || gpForward || t.forward,
      backward: kbBackward || gpBackward || t.backward,
      left: kbLeft || gpLeft || t.left,
      right: kbRight || gpRight || t.right,
      boost: kbBoost || gpBoost || t.boost,
      horn: kbHorn || gpHorn || t.horn
    };
  }

  // Called by TouchControls
  setTouchState(state) {
    this.touchState = { ...this.touchState, ...state };
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.listenersAttached = false;
  }
}