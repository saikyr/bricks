import { SLOW_MO_DURATION, SLOW_MO_FACTOR } from '../utils/constants';
import { randRange } from '../utils/math';
import { activeTheme } from '../theme';

export interface JuiceState {
  shakeX: number;
  shakeY: number;
  shakeMagnitude: number;
  flashAlpha: number;          // screen white flash
  flashColor: string;
  slowMoTimer: number;
  hitStopTimer: number;
  screenPulse: number;
  combo: number;
  comboPulse: number;
  comboDisplayTimer: number;
}

export function createJuiceState(): JuiceState {
  return {
    shakeX: 0,
    shakeY: 0,
    shakeMagnitude: 0,
    flashAlpha: 0,
    flashColor: '#ffffff',
    slowMoTimer: 0,
    hitStopTimer: 0,
    screenPulse: 0,
    combo: 0,
    comboPulse: 0,
    comboDisplayTimer: 0,
  };
}

export function triggerShake(juice: JuiceState, magnitude: number): void {
  juice.shakeMagnitude = Math.min(
    juice.shakeMagnitude + magnitude,
    activeTheme.effects.maxShake,
  );
}

export function triggerFlash(juice: JuiceState, color: string = '#ffffff', alpha: number = 0.3): void {
  juice.flashAlpha = Math.max(juice.flashAlpha, alpha);
  juice.flashColor = color;
}

export function triggerSlowMo(juice: JuiceState): void {
  juice.slowMoTimer = SLOW_MO_DURATION;
}

export function triggerHitStop(juice: JuiceState, duration: number): void {
  juice.hitStopTimer = Math.max(juice.hitStopTimer, duration);
}

export function triggerScreenPulse(juice: JuiceState, amount: number): void {
  juice.screenPulse = Math.min(1.2, juice.screenPulse + amount);
}

export function triggerComboPulse(juice: JuiceState, amount: number): void {
  juice.comboPulse = Math.min(1.2, juice.comboPulse + amount);
}

export function incrementCombo(juice: JuiceState): void {
  juice.combo++;
  juice.comboDisplayTimer = 1.5;
}

export function resetCombo(juice: JuiceState): void {
  juice.combo = 0;
}

export function getTimeScale(juice: JuiceState): number {
  if (juice.hitStopTimer > 0) return 0;
  if (juice.slowMoTimer > 0) return SLOW_MO_FACTOR;
  return 1;
}

export function updateJuice(juice: JuiceState, dt: number): void {
  // Shake
  if (juice.shakeMagnitude > 0.5) {
    juice.shakeX = randRange(-1, 1) * juice.shakeMagnitude;
    juice.shakeY = randRange(-1, 1) * juice.shakeMagnitude;
    juice.shakeMagnitude *= activeTheme.effects.shakeDecay;
  } else {
    juice.shakeX = 0;
    juice.shakeY = 0;
    juice.shakeMagnitude = 0;
  }

  // Flash
  if (juice.flashAlpha > 0) {
    juice.flashAlpha -= dt / activeTheme.effects.flashDuration;
    if (juice.flashAlpha < 0) juice.flashAlpha = 0;
  }

  // Slow-mo
  if (juice.slowMoTimer > 0) {
    juice.slowMoTimer -= dt; // real dt, not scaled
    if (juice.slowMoTimer < 0) juice.slowMoTimer = 0;
  }

  // Hit-stop
  if (juice.hitStopTimer > 0) {
    juice.hitStopTimer -= dt;
    if (juice.hitStopTimer < 0) juice.hitStopTimer = 0;
  }

  // Screen pulse
  if (juice.screenPulse > 0) {
    juice.screenPulse -= dt * activeTheme.effects.screenPulseDecay;
    if (juice.screenPulse < 0) juice.screenPulse = 0;
  }

  // Combo pulse
  if (juice.comboPulse > 0) {
    juice.comboPulse -= dt * activeTheme.effects.comboPulseDecay;
    if (juice.comboPulse < 0) juice.comboPulse = 0;
  }

  // Combo display
  if (juice.comboDisplayTimer > 0) {
    juice.comboDisplayTimer -= dt;
    if (juice.comboDisplayTimer <= 0) {
      juice.combo = 0;
    }
  }
}
