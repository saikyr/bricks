import { Vec2, vec2, randAngle, randRange } from '../utils/math';
import { DMG_NUMBER_LIFE, DMG_NUMBER_RISE_SPEED } from '../utils/constants';

export type ParticleShape = 'circle' | 'square' | 'triangle' | 'ring';

export interface Particle {
  pos: Vec2;
  vel: Vec2;
  color: string;
  life: number;
  maxLife: number;
  radius: number;
  shape?: ParticleShape;
  rotation?: number;
  rotationSpeed?: number;
  growRate?: number; // for ring particles: radius grows per second
}

export interface DamageNumber {
  pos: Vec2;
  value: number;
  life: number;
  maxLife: number;
  color?: string;     // override color (e.g. orange for burn, green for poison)
  glowColor?: string; // override glow
}

/** 10 death particles: mix of squares + triangles, punchy burst */
export function spawnDeathParticles(x: number, y: number, color: string): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = randAngle();
    const speed = randRange(150, 300);
    const isTriangle = i >= 7; // last 3 are triangles
    particles.push({
      pos: vec2(x, y),
      vel: vec2(Math.cos(angle) * speed, Math.sin(angle) * speed),
      color,
      life: 0.35,
      maxLife: 0.35,
      radius: randRange(2, 5),
      shape: isTriangle ? 'triangle' : 'square',
      rotation: isTriangle ? randAngle() : 0,
      rotationSpeed: isTriangle ? randRange(-8, 8) : 0,
    });
  }
  return particles;
}

/** 14 explosion particles (bright fire tones) + 1 ring shockwave */
export function spawnExplosionParticles(x: number, y: number): Particle[] {
  const particles: Particle[] = [];
  const colors = ['#f97316', '#fb923c', '#facc15', '#fbbf24'];
  for (let i = 0; i < 14; i++) {
    const angle = randAngle();
    const speed = randRange(200, 350);
    particles.push({
      pos: vec2(x, y),
      vel: vec2(Math.cos(angle) * speed, Math.sin(angle) * speed),
      color: colors[i % colors.length],
      life: 0.35,
      maxLife: 0.35,
      radius: randRange(2, 5),
      shape: i % 3 === 0 ? 'triangle' : 'square',
      rotation: randAngle(),
      rotationSpeed: randRange(-6, 6),
    });
  }
  // Shockwave ring
  particles.push({
    pos: vec2(x, y),
    vel: vec2(0, 0),
    color: '#fb923c',
    life: 0.2,
    maxLife: 0.2,
    radius: 2,
    shape: 'ring',
    growRate: 250,
  });
  return particles;
}

export function updateParticle(p: Particle, dt: number): void {
  p.pos.x += p.vel.x * dt;
  p.pos.y += p.vel.y * dt;
  // Snappier friction for death/explosion particles
  p.vel.x *= 0.94;
  p.vel.y *= 0.94;
  p.life -= dt;
  if (p.rotation !== undefined && p.rotationSpeed) {
    p.rotation += p.rotationSpeed * dt;
  }
  // Ring particles grow over time
  if (p.shape === 'ring' && p.growRate) {
    p.radius += p.growRate * dt;
  }
}

/** Sparks along a lightning chain path */
export function spawnLightningParticles(x1: number, y1: number, x2: number, y2: number): Particle[] {
  const particles: Particle[] = [];
  const count = 6;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const px = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 8;
    const py = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 8;
    const angle = randAngle();
    const speed = randRange(40, 100);
    particles.push({
      pos: vec2(px, py),
      vel: vec2(Math.cos(angle) * speed, Math.sin(angle) * speed),
      color: Math.random() > 0.5 ? '#88ddff' : '#ffffff',
      life: 0.2,
      maxLife: 0.2,
      radius: randRange(1, 2.5),
      shape: 'circle',
    });
  }
  return particles;
}

/** Green cloud when poison spreads on kill */
export function spawnPoisonSpreadParticles(x: number, y: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = randAngle();
    const speed = randRange(60, 140);
    particles.push({
      pos: vec2(x, y),
      vel: vec2(Math.cos(angle) * speed, Math.sin(angle) * speed),
      color: i < 5 ? '#44cc44' : '#88ff88',
      life: 0.35,
      maxLife: 0.35,
      radius: randRange(2, 4),
      shape: 'circle',
    });
  }
  // Expanding green ring
  particles.push({
    pos: vec2(x, y),
    vel: vec2(0, 0),
    color: '#44cc44',
    life: 0.25,
    maxLife: 0.25,
    radius: 3,
    shape: 'ring',
    growRate: 200,
  });
  return particles;
}

export function spawnDamageNumber(x: number, y: number, value: number, color?: string, glowColor?: string): DamageNumber {
  return {
    pos: vec2(x, y),
    value,
    life: DMG_NUMBER_LIFE,
    maxLife: DMG_NUMBER_LIFE,
    color,
    glowColor,
  };
}

export function updateDamageNumber(dn: DamageNumber, dt: number): void {
  dn.pos.y -= 80 * dt; // faster rise (80px/s vs old 60)
  dn.life -= dt;
}
