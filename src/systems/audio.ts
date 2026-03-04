// Procedural sound effects using Web Audio API — zero audio files
// All sounds routed through a master compressor + gain to prevent clipping

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;
let muted = false;
let lastHitTime = 0;
let lastShootTime = 0;
let lastWallTime = 0;

function ensureContext(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
      compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 12;
      compressor.ratio.value = 8;
      master = ctx.createGain();
      master.gain.value = 0.4; // global volume
      compressor.connect(master).connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function dest(): AudioNode {
  return compressor!;
}

export function initAudio(): void {
  ensureContext();
}

export function toggleMute(): boolean {
  muted = !muted;
  return muted;
}

export function isMuted(): boolean {
  return muted;
}

// --- Helpers ---

function tone(ac: AudioContext, type: OscillatorType, freq: number, endFreq: number, dur: number, vol: number, startTime?: number): void {
  const t = startTime ?? ac.currentTime;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (endFreq !== freq) {
    o.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 20), t + dur * 0.8);
  }
  g.gain.setValueAtTime(vol, t);
  g.gain.setValueAtTime(vol, t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(dest());
  o.start(t);
  o.stop(t + dur);
}

function noise(ac: AudioContext, dur: number, vol: number, filterFreq: number, filterQ: number): void {
  const now = ac.currentTime;
  const bufLen = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filt = ac.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = filterFreq;
  filt.Q.value = filterQ;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);
  src.connect(filt).connect(g).connect(dest());
  src.start(now);
  src.stop(now + dur);
}

// --- Sound triggers ---

/** Soft thud — ball bounces off enemy */
export function playHit(): void {
  const ac = ensureContext();
  if (!ac) return;
  const now = ac.currentTime;
  if (now - lastHitTime < 0.015) return;
  lastHitTime = now;

  tone(ac, 'triangle', 520, 320, 0.05, 0.12);
}

/** Satisfying pop — enemy destroyed */
export function playKill(): void {
  const ac = ensureContext();
  if (!ac) return;

  tone(ac, 'sine', 600, 200, 0.1, 0.14);
  noise(ac, 0.04, 0.06, 2000, 2);
}

/** Low rumble — player takes damage */
export function playDamage(): void {
  const ac = ensureContext();
  if (!ac) return;

  tone(ac, 'triangle', 150, 90, 0.18, 0.13);
  tone(ac, 'triangle', 155, 85, 0.18, 0.10);
}

/** Soft coin pickup — gem collected */
export function playGem(): void {
  const ac = ensureContext();
  if (!ac) return;

  // Lower, warmer pitch — E5 → G5 instead of C6 → E6
  tone(ac, 'sine', 659, 784, 0.07, 0.07);
}

/** Rising arpeggio — level up */
export function playLevelUp(): void {
  const ac = ensureContext();
  if (!ac) return;
  const now = ac.currentTime;

  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  for (let i = 0; i < notes.length; i++) {
    const t = now + i * 0.09;
    tone(ac, 'sine', notes[i], notes[i] * 1.01, 0.12, 0.10, t);
    tone(ac, 'sine', notes[i] * 2, notes[i] * 2.02, 0.10, 0.04, t);
  }
}

/** Descending tone — game over */
export function playGameOver(): void {
  const ac = ensureContext();
  if (!ac) return;

  tone(ac, 'triangle', 392, 130, 0.45, 0.12);
  tone(ac, 'sine', 392, 130, 0.45, 0.06);
}

/** Quick pew — ball fired */
export function playShoot(): void {
  const ac = ensureContext();
  if (!ac) return;
  const now = ac.currentTime;
  if (now - lastShootTime < 0.03) return;
  lastShootTime = now;

  tone(ac, 'sine', 440, 880, 0.04, 0.06);
}

/** Soft catch — ball returns to player */
export function playCatch(): void {
  const ac = ensureContext();
  if (!ac) return;

  tone(ac, 'sine', 660, 440, 0.05, 0.06);
}

/** Subtle click — ball bounces off wall/ceiling */
export function playWallBounce(): void {
  const ac = ensureContext();
  if (!ac) return;
  const now = ac.currentTime;
  if (now - lastWallTime < 0.02) return;
  lastWallTime = now;

  tone(ac, 'triangle', 380, 280, 0.03, 0.05);
}

// --- Ball-type specific sounds ---

/** Zap — laser beam fires */
export function playLaser(): void {
  const ac = ensureContext();
  if (!ac) return;

  tone(ac, 'square', 1200, 400, 0.08, 0.06);
  tone(ac, 'sine', 800, 1600, 0.06, 0.04);
}

/** Boom — explosive splash */
export function playExplosion(): void {
  const ac = ensureContext();
  if (!ac) return;

  tone(ac, 'sine', 200, 60, 0.15, 0.12);
  noise(ac, 0.1, 0.08, 800, 1);
}

/** Wet slice — bleed applied */
export function playBleed(): void {
  const ac = ensureContext();
  if (!ac) return;

  noise(ac, 0.05, 0.05, 3000, 3);
  tone(ac, 'triangle', 300, 200, 0.04, 0.06);
}

/** Crackle — burn applied */
export function playBurn(): void {
  const ac = ensureContext();
  if (!ac) return;

  noise(ac, 0.06, 0.05, 4000, 2);
  tone(ac, 'sine', 500, 700, 0.05, 0.05);
}

/** Bubble — poison applied */
export function playPoison(): void {
  const ac = ensureContext();
  if (!ac) return;

  tone(ac, 'sine', 300, 500, 0.06, 0.06);
  tone(ac, 'sine', 350, 550, 0.05, 0.04);
}

/** Crackle-zap — lightning chains */
export function playLightning(): void {
  const ac = ensureContext();
  if (!ac) return;

  tone(ac, 'square', 900, 1800, 0.04, 0.05);
  tone(ac, 'square', 1100, 600, 0.05, 0.04);
  noise(ac, 0.03, 0.04, 5000, 3);
}

/** Crystalline ping — freeze applied */
export function playFreeze(): void {
  const ac = ensureContext();
  if (!ac) return;
  const now = ac.currentTime;

  tone(ac, 'sine', 1500, 1500, 0.08, 0.06);
  tone(ac, 'sine', 2000, 2000, 0.06, 0.03, now + 0.02);
}
