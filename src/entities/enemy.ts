import { Vec2, vec2 } from '../utils/math';
import { ENEMY_PADDING } from '../utils/constants';
import { StatusEffects, createEmptyStatus } from '../systems/status';

const SPAWN_ANIM_DURATION = 0.2; // seconds for pop-in

export interface Enemy {
  pos: Vec2;            // top-left of cell
  hp: number;
  maxHp: number;
  width: number;
  height: number;
  gridW: number;
  gridH: number;
  alive: boolean;
  flashTimer: number;   // >0 means showing hit flash
  shakeX: number;       // horizontal shake offset
  spawnTimer: number;   // counts up from 0 to SPAWN_ANIM_DURATION
  status: StatusEffects;
}

/** Returns 0..1 spawn animation progress (1 = fully spawned). */
export function getSpawnScale(enemy: Enemy): number {
  if (enemy.spawnTimer >= SPAWN_ANIM_DURATION) return 1;
  const t = enemy.spawnTimer / SPAWN_ANIM_DURATION;
  // Elastic overshoot: rises to ~1.08 then settles to 1
  return t < 0.6
    ? (t / 0.6) * 1.15
    : 1.15 - 0.15 * ((t - 0.6) / 0.4);
}

export function createEnemy(
  col: number, y: number, hp: number,
  cellSize: number, corridorX: number,
  gridW = 1, gridH = 1,
): Enemy {
  return {
    pos: vec2(corridorX + col * cellSize + ENEMY_PADDING, y + ENEMY_PADDING),
    hp,
    maxHp: hp,
    width: cellSize * gridW - ENEMY_PADDING * 2,
    height: cellSize * gridH - ENEMY_PADDING * 2,
    gridW,
    gridH,
    alive: true,
    flashTimer: 0,
    shakeX: 0,
    spawnTimer: 0,
    status: createEmptyStatus(),
  };
}

// HP color tiers — bright saturated Ballz-style
const HP_TIERS: [number, string][] = [
  [20, '#4ade80'],   // Bright green
  [40, '#facc15'],   // Yellow
  [80, '#fb923c'],   // Orange
  [150, '#f87171'],  // Red
  [300, '#c084fc'],  // Purple
  [Infinity, '#f472b6'], // Pink
];

/** Look up enemy color from HP tier table. */
export function getEnemyColor(hp: number): string {
  for (const [threshold, color] of HP_TIERS) {
    if (hp <= threshold) return color;
  }
  return '#ec4899';
}

export function damageEnemy(enemy: Enemy, dmg: number): boolean {
  enemy.hp -= dmg;
  enemy.flashTimer = 0.08;
  enemy.shakeX = (Math.random() - 0.5) * 4;
  if (enemy.hp <= 0) {
    enemy.alive = false;
    return true; // killed
  }
  return false;
}

export function updateEnemy(enemy: Enemy, dt: number): void {
  if (enemy.flashTimer > 0) {
    enemy.flashTimer -= dt;
  }
  // Spawn animation
  if (enemy.spawnTimer < 0.2) {
    enemy.spawnTimer += dt;
  }
  // Decay shake
  enemy.shakeX *= 0.8;
  if (Math.abs(enemy.shakeX) < 0.1) enemy.shakeX = 0;
}
