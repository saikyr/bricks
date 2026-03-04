import { Ball } from './entities/ball';
import { Enemy } from './entities/enemy';
import { Vec2, vec2, clamp } from './utils/math';
import { WORLD_H } from './utils/constants';

export interface CollisionResult {
  enemy: Enemy;
  hitPos: Vec2;
}

export interface BallPhysicsResult {
  hits: CollisionResult[];
  bounced: boolean; // ball bounced off the floor this frame
  wallBounced: boolean; // ball bounced off a wall or ceiling
}

export function updateBallPhysics(ball: Ball, dt: number, enemies: Enemy[], corridorX: number, corridorRight: number): BallPhysicsResult {
  if (!ball.active) return { hits: [], bounced: false, wallBounced: false };

  const hits: CollisionResult[] = [];
  let bounced = false;
  let wallBounced = false;
  const steps = 4;
  const subDt = dt / steps;
  const r = ball.radius;
  const isSpectral = ball.type === 'spectral'; // only spectral passes through

  for (let s = 0; s < steps; s++) {
    ball.pos.x += ball.vel.x * subDt;
    ball.pos.y += ball.vel.y * subDt;

    // Corridor wall collisions
    if (ball.pos.x - r < corridorX) {
      ball.pos.x = corridorX + r;
      ball.vel.x = Math.abs(ball.vel.x);
      wallBounced = true;
    }
    if (ball.pos.x + r > corridorRight) {
      ball.pos.x = corridorRight - r;
      ball.vel.x = -Math.abs(ball.vel.x);
      wallBounced = true;
    }

    // Ceiling
    if (ball.pos.y - r < 0) {
      ball.pos.y = r;
      ball.vel.y = Math.abs(ball.vel.y);
      wallBounced = true;
    }

    // Floor — ball bounces off and enters returning state
    if (ball.pos.y + r > WORLD_H) {
      ball.pos.y = WORLD_H - r;
      ball.vel.y = -Math.abs(ball.vel.y);
      bounced = true;
    }

    // Enemy collisions
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (isSpectral && ball.spectralHitSet.has(enemy)) continue;
      if (circleRectOverlap(ball, enemy)) {
        if (isSpectral) {
          // Spectral: record hit but don't bounce — passes through
          hits.push({ enemy, hitPos: vec2(ball.pos.x, ball.pos.y) });
          ball.spectralHitSet.add(enemy);
        } else {
          // Normal/explosive: bounce off enemy
          bounceOffRect(ball, enemy);
          hits.push({ enemy, hitPos: vec2(ball.pos.x, ball.pos.y) });
          break; // one hit per substep for bouncing balls
        }
      }
    }
  }

  return { hits, bounced, wallBounced };
}

/** Check overlap without modifying ball state */
function circleRectOverlap(ball: Ball, enemy: Enemy): boolean {
  const ex = enemy.pos.x + enemy.shakeX;
  const ey = enemy.pos.y;
  const ew = enemy.width;
  const eh = enemy.height;
  const r = ball.radius;

  const closestX = clamp(ball.pos.x, ex, ex + ew);
  const closestY = clamp(ball.pos.y, ey, ey + eh);

  const dx = ball.pos.x - closestX;
  const dy = ball.pos.y - closestY;
  return dx * dx + dy * dy < r * r;
}

/** Push ball out and reflect velocity */
function bounceOffRect(ball: Ball, enemy: Enemy): void {
  const ex = enemy.pos.x + enemy.shakeX;
  const ey = enemy.pos.y;
  const ew = enemy.width;
  const eh = enemy.height;
  const r = ball.radius;

  const closestX = clamp(ball.pos.x, ex, ex + ew);
  const closestY = clamp(ball.pos.y, ey, ey + eh);

  const dx = ball.pos.x - closestX;
  const dy = ball.pos.y - closestY;
  const distSq = dx * dx + dy * dy;
  const dist = Math.sqrt(distSq);

  let nx: number, ny: number;

  if (dist > 0.0001) {
    nx = dx / dist;
    ny = dy / dist;
  } else {
    const penLeft = (ball.pos.x - ex) + r;
    const penRight = (ex + ew - ball.pos.x) + r;
    const penTop = (ball.pos.y - ey) + r;
    const penBottom = (ey + eh - ball.pos.y) + r;
    const minPen = Math.min(penLeft, penRight, penTop, penBottom);
    if (minPen === penLeft) { nx = -1; ny = 0; }
    else if (minPen === penRight) { nx = 1; ny = 0; }
    else if (minPen === penTop) { nx = 0; ny = -1; }
    else { nx = 0; ny = 1; }
  }

  // Push ball out
  const penetration = r - dist;
  ball.pos.x += nx * penetration;
  ball.pos.y += ny * penetration;

  // Reflect velocity
  const dot = ball.vel.x * nx + ball.vel.y * ny;
  if (dot < 0) {
    ball.vel.x -= 2 * dot * nx;
    ball.vel.y -= 2 * dot * ny;
  }
}
