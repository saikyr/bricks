import {
  BLEED_DMG_PER_STACK,
  BURN_TICK_INTERVAL,
  POISON_TICK_INTERVAL,
} from '../utils/constants';

export interface BleedEffect {
  stacks: number;
}

export interface BurnEffect {
  damagePerTick: number;
  tickTimer: number;
  remaining: number;
}

export interface PoisonEffect {
  damagePerTick: number;
  tickTimer: number;
  remaining: number;
  spreadOnKill: boolean;
}

export interface FreezeEffect {
  remaining: number;
  damageMult: number;
}

export interface StatusEffects {
  bleed: BleedEffect | null;
  burn: BurnEffect | null;
  poison: PoisonEffect | null;
  freeze: FreezeEffect | null;
}

export function createEmptyStatus(): StatusEffects {
  return { bleed: null, burn: null, poison: null, freeze: null };
}

export function hasAnyStatus(s: StatusEffects): boolean {
  return s.bleed !== null || s.burn !== null || s.poison !== null || s.freeze !== null;
}

/** Returns damage multiplier from status effects (e.g. freeze = 1.5x). */
export function getDamageMult(s: StatusEffects): number {
  if (s.freeze) return s.freeze.damageMult;
  return 1;
}

export function applyBleed(s: StatusEffects, stacks: number): void {
  if (s.bleed) {
    s.bleed.stacks += stacks;
  } else {
    s.bleed = { stacks };
  }
}

/** Consume bleed stacks and return the count (for bonus damage calc). */
export function popBleed(s: StatusEffects): number {
  if (!s.bleed) return 0;
  const count = s.bleed.stacks;
  s.bleed = null;
  return count;
}

export function applyBurn(s: StatusEffects, damagePerTick: number, duration: number): void {
  if (s.burn) {
    s.burn.damagePerTick = damagePerTick;
    s.burn.remaining = duration; // refresh
  } else {
    s.burn = { damagePerTick, tickTimer: BURN_TICK_INTERVAL, remaining: duration };
  }
}

export function applyPoison(s: StatusEffects, damagePerTick: number, duration: number): void {
  if (s.poison) {
    s.poison.damagePerTick = damagePerTick;
    s.poison.remaining = duration; // refresh
  } else {
    s.poison = { damagePerTick, tickTimer: POISON_TICK_INTERVAL, remaining: duration, spreadOnKill: true };
  }
}

export function applyFreeze(s: StatusEffects, duration: number, damageMult: number): void {
  if (s.freeze) {
    s.freeze.remaining = duration; // refresh
  } else {
    s.freeze = { remaining: duration, damageMult };
  }
}

export interface StatusTickResult {
  burnDamage: number;
  poisonDamage: number;
}

/** Tick all active status effects. Returns per-type DoT damage dealt this frame. */
export function updateStatusEffects(s: StatusEffects, dt: number): StatusTickResult {
  let burnDamage = 0;
  let poisonDamage = 0;

  // Burn ticks
  if (s.burn) {
    s.burn.remaining -= dt;
    s.burn.tickTimer -= dt;
    while (s.burn.tickTimer <= 0) {
      burnDamage += s.burn.damagePerTick;
      s.burn.tickTimer += BURN_TICK_INTERVAL;
    }
    if (s.burn.remaining <= 0) s.burn = null;
  }

  // Poison ticks
  if (s.poison) {
    s.poison.remaining -= dt;
    s.poison.tickTimer -= dt;
    while (s.poison.tickTimer <= 0) {
      poisonDamage += s.poison.damagePerTick;
      s.poison.tickTimer += POISON_TICK_INTERVAL;
    }
    if (s.poison.remaining <= 0) s.poison = null;
  }

  // Freeze countdown
  if (s.freeze) {
    s.freeze.remaining -= dt;
    if (s.freeze.remaining <= 0) s.freeze = null;
  }

  return { burnDamage, poisonDamage };
}
