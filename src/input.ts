import { Vec2, vec2 } from './utils/math';
import { WORLD_W, WORLD_H } from './utils/constants';

export interface InputState {
  // Movement (WASD on desktop, left-half joystick on mobile)
  moveDir: Vec2;         // normalized movement direction (0,0 = idle)
  // Aim (mouse on desktop, right-half joystick on mobile)
  aimPos: Vec2;          // world position to aim toward
  aimActive: boolean;    // true if player is actively aiming somewhere

  canvasRect: DOMRect | null;
  worldScale: number;
  worldOffsetX: number;
  worldOffsetY: number;
  tapped: boolean;       // true for one frame after a tap
  tapPos: Vec2;          // world position of last tap (for UI clicks)
  mouseActive: boolean;  // true once mouse has moved (desktop detection)
}

export function createInputState(): InputState {
  return {
    moveDir: vec2(0, 0),
    aimPos: vec2(WORLD_W / 2, 0),
    aimActive: false,
    canvasRect: null,
    worldScale: 1,
    worldOffsetX: 0,
    worldOffsetY: 0,
    tapped: false,
    tapPos: vec2(0, 0),
    mouseActive: false,
  };
}

function screenToWorld(input: InputState, screenX: number, screenY: number): Vec2 {
  if (!input.canvasRect) return vec2(0, 0);
  const cx = screenX - input.canvasRect.left;
  const cy = screenY - input.canvasRect.top;
  return vec2(
    (cx - input.worldOffsetX) / input.worldScale,
    (cy - input.worldOffsetY) / input.worldScale,
  );
}

// Track which keys are held
const keysDown = new Set<string>();

export function setupInput(canvas: HTMLElement, input: InputState): void {
  // --- Keyboard (desktop movement) ---
  window.addEventListener('keydown', (e) => {
    keysDown.add(e.key.toLowerCase());
  });
  window.addEventListener('keyup', (e) => {
    keysDown.delete(e.key.toLowerCase());
  });

  // --- Mouse (desktop aim) ---
  canvas.addEventListener('mousedown', (e) => {
    input.mouseActive = true;
    input.tapped = true;
    const wp = screenToWorld(input, e.clientX, e.clientY);
    input.tapPos = wp;
    input.aimPos = wp;
    input.aimActive = true;
  });

  canvas.addEventListener('mousemove', (e) => {
    input.mouseActive = true;
    input.aimPos = screenToWorld(input, e.clientX, e.clientY);
    input.aimActive = true;
  });

  // --- Touch (mobile: left half = move joystick, right half = aim) ---
  // Track touch origins to compute relative joystick directions
  const touchOrigins = new Map<number, { start: Vec2; isMove: boolean }>();

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const wp = screenToWorld(input, t.clientX, t.clientY);
      const halfW = WORLD_W / 2;
      const isMove = wp.x < halfW;
      touchOrigins.set(t.identifier, { start: wp, isMove });

      if (!isMove) {
        // Right-half tap = aim
        input.aimPos = wp;
        input.aimActive = true;
      }

      input.tapped = true;
      input.tapPos = wp;
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const origin = touchOrigins.get(t.identifier);
      if (!origin) continue;

      const wp = screenToWorld(input, t.clientX, t.clientY);

      if (origin.isMove) {
        // Left-half drag = relative joystick
        const dx = wp.x - origin.start.x;
        const dy = wp.y - origin.start.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const deadzone = 8;
        if (dist > deadzone) {
          const scale = Math.min(1, (dist - deadzone) / 40);
          input.moveDir = vec2((dx / dist) * scale, (dy / dist) * scale);
        } else {
          input.moveDir = vec2(0, 0);
        }
      } else {
        // Right-half drag = aim direction
        input.aimPos = wp;
        input.aimActive = true;
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const origin = touchOrigins.get(t.identifier);
      if (origin?.isMove) {
        input.moveDir = vec2(0, 0); // stop moving when finger lifts
      }
      touchOrigins.delete(t.identifier);
    }
  }, { passive: false });

  canvas.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const origin = touchOrigins.get(t.identifier);
      if (origin?.isMove) {
        input.moveDir = vec2(0, 0);
      }
      touchOrigins.delete(t.identifier);
    }
  }, { passive: false });
}

/** Call once per frame to sync keyboard state into moveDir */
export function pollKeyboard(input: InputState): void {
  if (!input.mouseActive) return; // only on desktop

  let mx = 0, my = 0;
  if (keysDown.has('a') || keysDown.has('arrowleft'))  mx -= 1;
  if (keysDown.has('d') || keysDown.has('arrowright')) mx += 1;
  if (keysDown.has('w') || keysDown.has('arrowup'))    my -= 1;
  if (keysDown.has('s') || keysDown.has('arrowdown'))  my += 1;

  // Normalize diagonal
  if (mx !== 0 && my !== 0) {
    const inv = 1 / Math.SQRT2;
    mx *= inv;
    my *= inv;
  }

  input.moveDir = vec2(mx, my);
}

export function consumeTap(input: InputState): boolean {
  if (input.tapped) {
    input.tapped = false;
    return true;
  }
  return false;
}
