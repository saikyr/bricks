import { Vec2, vec2, clamp } from '../utils/math';
import { GEM_MAGNET_RADIUS, GEM_COLLECT_RADIUS, WORLD_H } from '../utils/constants';

export interface Gem {
  pos: Vec2;
  value: number;
  radius: number;
  alive: boolean;
  magnetized: boolean;
}

const GEM_SCATTER = 25; // max random offset
const GEM_EDGE_MARGIN = 30; // keep gems this far from top/bottom

export function createGem(x: number, y: number, value: number): Gem {
  // Random offset
  let gx = x + (Math.random() - 0.5) * GEM_SCATTER * 2;
  let gy = y + (Math.random() - 0.5) * GEM_SCATTER * 2;

  // Bias away from edges
  gy = clamp(gy, GEM_EDGE_MARGIN, WORLD_H - GEM_EDGE_MARGIN);

  return {
    pos: vec2(gx, gy),
    value,
    radius: 5,
    alive: true,
    magnetized: false,
  };
}

/** Returns true if collected by player. */
export function updateGem(gem: Gem, dt: number, playerPos: Vec2): boolean {
  if (!gem.alive) return false;

  const dx = playerPos.x - gem.pos.x;
  const dy = playerPos.y - gem.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Collect immediately when close enough
  if (dist < GEM_COLLECT_RADIUS) {
    gem.alive = false;
    return true;
  }

  // Magnetic pull — lerp directly toward player, faster as they get closer
  if (dist < GEM_MAGNET_RADIUS) {
    gem.magnetized = true;
    // Speed ramps from ~400 at edge to ~1200 when close
    const t = 1 - dist / GEM_MAGNET_RADIUS;
    const speed = (400 + 800 * t * t) * dt;
    const move = Math.min(speed, dist);
    gem.pos.x += (dx / dist) * move;
    gem.pos.y += (dy / dist) * move;
  } else {
    gem.magnetized = false;
  }

  return false;
}
