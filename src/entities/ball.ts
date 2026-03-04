import { Vec2, vec2 } from '../utils/math';
import { BALL_RADIUS, BALL_SPEED, BALL_TRAIL_LENGTH } from '../utils/constants';
import { Enemy } from './enemy';

export type BallType = 'normal' | 'spectral' | 'explosive' | 'laser' | 'bleed' | 'burn' | 'poison' | 'lightning' | 'freeze';

export interface Ball {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  active: boolean;       // currently in flight (hitting enemies)
  age: number;           // lifetime in seconds
  trail: Vec2[];         // recent positions for trail effect
  type: BallType;
  queueSlot: number;
  spectralHitSet: Set<Enemy>;
}

export function createBall(
  x: number, y: number,
  dirX: number, dirY: number,
  type: BallType,
  queueSlot: number,
  speed: number = BALL_SPEED,
  radius: number = BALL_RADIUS,
): Ball {
  return {
    pos: vec2(x, y),
    vel: vec2(dirX * speed, dirY * speed),
    radius,
    active: true,
    age: 0,
    trail: [],
    type,
    queueSlot,
    spectralHitSet: new Set(),
  };
}

export function updateBallTrail(ball: Ball): void {
  ball.trail.unshift(vec2(ball.pos.x, ball.pos.y));
  if (ball.trail.length > BALL_TRAIL_LENGTH) {
    ball.trail.length = BALL_TRAIL_LENGTH;
  }
}
