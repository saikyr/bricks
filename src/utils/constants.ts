// World is defined in logical units; canvas scales to fit
export const WORLD_W = 400;
export const WORLD_H = 711; // ~9:16

// Enemy spacing (must be before grid calc)
export const ENEMY_PADDING = 1;

// Grid — fixed 7 columns, square cells, full width
export const GRID_COLS = 7;
export const CELL_SIZE = (WORLD_W - ENEMY_PADDING * 2) / GRID_COLS;
export const GRID_LEFT = ENEMY_PADDING;
export const GRID_TOP_Y = 40;

// Ball
export const BALL_RADIUS = 6;
export const BALL_SPEED = 400; // px/s in world units
export const BALL_TRAIL_LENGTH = 6;
export const BALL_MAX_AGE = 8; // seconds before ball expires

// Ball queue system
import type { BallType } from '../entities/ball';
export const START_BALL_QUEUE: BallType[] = ['normal', 'normal', 'normal'];
export const MAGAZINE_CAP = 5;
export const START_BALL_DAMAGE = 10;
export const BALL_RECYCLE_COOLDOWN = 0.3; // seconds before slot reopens
export const MIN_SWIPE_DISTANCE = 20; // world units, min drag to fire
export const BALL_SPAWN_Y = WORLD_H - 20;

// Player
export const PLAYER_MAX_HP = 10;

// XP
export const XP_LEVEL_BASE = 20;
export const XP_LEVEL_GROWTH = 1.35;

// Enemy
export const ENEMY_CORNER_RADIUS = 4;
export const ENEMY_SCROLL_SPEED = 10; // px/s base scroll speed (gentle start)
export const MAX_SCROLL_SPEED = 60; // cap so it never gets insane

// Spawn
export const SPAWN_INTERVAL = 3.0; // seconds between new row spawns

// Juice
export const SHAKE_DECAY = 0.88;
export const FLASH_DURATION = 0.15;
export const SLOW_MO_DURATION = 0.3;
export const SLOW_MO_FACTOR = 0.2;

// Particles
export const PARTICLE_COUNT_ON_DEATH = 12;
export const PARTICLE_SPEED = 200;
export const PARTICLE_LIFE = 0.5;

// Damage numbers
export const DMG_NUMBER_LIFE = 0.6;
export const DMG_NUMBER_RISE_SPEED = 60;

// Status effects
export const BLEED_DMG_PER_STACK = 0.3; // multiplier of baseDmg per stack
export const BURN_DURATION = 3.0;
export const BURN_TICK_INTERVAL = 0.5;
export const BURN_DMG_FRACTION = 0.2; // of baseDmg per tick
export const POISON_DURATION = 5.0;
export const POISON_TICK_INTERVAL = 1.0;
export const POISON_DMG_FRACTION = 0.1; // of baseDmg per tick
export const POISON_SPREAD_RADIUS = 1.5; // in CELL_SIZE units
export const LIGHTNING_CHAIN_COUNT = 3;
export const LIGHTNING_CHAIN_RADIUS = 2.0; // in CELL_SIZE units
export const LIGHTNING_DMG_FRACTION = 0.4; // of baseDmg
export const FREEZE_CHANCE = 0.3;
export const FREEZE_DURATION = 2.0;
export const FREEZE_DMG_MULT = 1.5;
export const LASER_HIT_DMG_FRACTION = 0.25; // of baseDmg (was 0.6 on kill)
export const LASER_BEAM_LIFE = 0.15;
export const EXPLOSIVE_HIT_DMG_FRACTION = 0.3; // of baseDmg (was 0.5 on kill)
export const EXPLOSIVE_HIT_RADIUS = 0.9; // in CELL_SIZE units (was 1.2)
