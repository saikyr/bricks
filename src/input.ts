import { Vec2, vec2 } from './utils/math';
import { MIN_SWIPE_DISTANCE } from './utils/constants';

export interface InputState {
  swipeStart: Vec2 | null;
  swipeCurrent: Vec2 | null;
  swipeFired: { dirX: number; dirY: number; originX: number } | null;
  swiping: boolean;

  canvasRect: DOMRect | null;
  worldScale: number;
  worldOffsetX: number;
  worldOffsetY: number;
  tapped: boolean;
  tapPos: Vec2;
}

export function createInputState(): InputState {
  return {
    swipeStart: null,
    swipeCurrent: null,
    swipeFired: null,
    swiping: false,
    canvasRect: null,
    worldScale: 1,
    worldOffsetX: 0,
    worldOffsetY: 0,
    tapped: false,
    tapPos: vec2(0, 0),
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

function computeSwipeDir(start: Vec2, end: Vec2): { dirX: number; dirY: number; originX: number } | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < MIN_SWIPE_DISTANCE) return null;

  let dirX = dx / dist;
  let dirY = dy / dist;

  // Clamp upward — don't allow firing downward
  if (dirY > -0.1) {
    dirY = -0.1;
    const len = Math.sqrt(dirX * dirX + dirY * dirY);
    dirX /= len;
    dirY /= len;
  }

  return { dirX, dirY, originX: start.x };
}

export function setupInput(canvas: HTMLElement, input: InputState): void {
  // --- Mouse (desktop) ---
  let activeTouchId: number | null = null;

  canvas.addEventListener('mousedown', (e) => {
    const wp = screenToWorld(input, e.clientX, e.clientY);
    input.swipeStart = wp;
    input.swipeCurrent = wp;
    input.swiping = true;
    input.tapped = true;
    input.tapPos = wp;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!input.swiping) return;
    input.swipeCurrent = screenToWorld(input, e.clientX, e.clientY);
  });

  canvas.addEventListener('mouseup', (e) => {
    if (input.swiping && input.swipeStart) {
      const end = screenToWorld(input, e.clientX, e.clientY);
      const dir = computeSwipeDir(input.swipeStart, end);
      if (dir) input.swipeFired = dir;
    }
    input.swiping = false;
    input.swipeStart = null;
    input.swipeCurrent = null;
  });

  // --- Touch (mobile) ---
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (activeTouchId !== null) return; // ignore multitouch
    const t = e.changedTouches[0];
    activeTouchId = t.identifier;
    const wp = screenToWorld(input, t.clientX, t.clientY);
    input.swipeStart = wp;
    input.swipeCurrent = wp;
    input.swiping = true;
    input.tapped = true;
    input.tapPos = wp;
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === activeTouchId) {
        input.swipeCurrent = screenToWorld(input, t.clientX, t.clientY);
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier !== activeTouchId) continue;
      activeTouchId = null;

      if (input.swiping && input.swipeStart) {
        const end = screenToWorld(input, t.clientX, t.clientY);
        const dir = computeSwipeDir(input.swipeStart, end);
        if (dir) input.swipeFired = dir;
      }
      input.swiping = false;
      input.swipeStart = null;
      input.swipeCurrent = null;
    }
  }, { passive: false });

  canvas.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === activeTouchId) {
        activeTouchId = null;
        input.swiping = false;
        input.swipeStart = null;
        input.swipeCurrent = null;
      }
    }
  }, { passive: false });
}

export function consumeSwipe(input: InputState): { dirX: number; dirY: number; originX: number } | null {
  const result = input.swipeFired;
  input.swipeFired = null;
  return result;
}

export function consumeTap(input: InputState): boolean {
  if (input.tapped) {
    input.tapped = false;
    return true;
  }
  return false;
}
