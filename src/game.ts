import { Ball, BallType, createBall, updateBallTrail } from './entities/ball';
import { Enemy, damageEnemy, updateEnemy, getEnemyColor } from './entities/enemy';
import { Gem, createGem, updateGem } from './entities/gem';
import { Particle, DamageNumber, updateParticle, spawnDamageNumber, updateDamageNumber, spawnDeathParticles, spawnExplosionParticles, spawnLightningParticles, spawnPoisonSpreadParticles } from './entities/particle';
import { InputState, consumeTap, pollKeyboard } from './input';
import { updateBallPhysics } from './physics';
import {
  JuiceState,
  createJuiceState,
  updateJuice,
  triggerShake,
  triggerFlash,
  incrementCombo,
  getTimeScale,
  triggerHitStop,
  triggerScreenPulse,
  triggerComboPulse,
} from './systems/juice';
import {
  getDamageMult, popBleed, applyBleed, applyBurn, applyPoison, applyFreeze,
  updateStatusEffects, hasAnyStatus,
} from './systems/status';
import { WaveState, createWaveState, updateWave } from './systems/wave';
import { PlayerStats, UpgradeOption, rollUpgradeChoices } from './systems/upgrade';
import { Vec2, vec2, clamp } from './utils/math';
import {
  playHit, playKill, playDamage, playGem, playLevelUp, playGameOver,
  playShoot, playCatch, playWallBounce,
  playLaser, playExplosion, playBleed, playBurn, playPoison, playLightning, playFreeze,
} from './systems/audio';
import { activeTheme } from './theme';
import {
  WORLD_W, WORLD_H, PLAYER_RADIUS, PLAYER_MAX_HP,
  BALL_SPEED, BALL_RADIUS,
  START_BALL_QUEUE, START_FIRE_INTERVAL, START_BALL_DAMAGE,
  BALL_CATCH_RADIUS,
  XP_LEVEL_BASE, XP_LEVEL_GROWTH,
  CELL_SIZE, GRID_LEFT, GRID_COLS, ENEMY_PADDING,
  BLEED_DMG_PER_STACK,
  BURN_DURATION, BURN_DMG_FRACTION,
  POISON_DURATION, POISON_DMG_FRACTION, POISON_SPREAD_RADIUS,
  LIGHTNING_CHAIN_COUNT, LIGHTNING_CHAIN_RADIUS, LIGHTNING_DMG_FRACTION,
  FREEZE_CHANCE, FREEZE_DURATION, FREEZE_DMG_MULT,
  LASER_HIT_DMG_FRACTION, LASER_BEAM_LIFE,
  EXPLOSIVE_HIT_DMG_FRACTION, EXPLOSIVE_HIT_RADIUS,
} from './utils/constants';

// Fixed grid bounds
const GRID_RIGHT = GRID_LEFT + GRID_COLS * CELL_SIZE;

export type GameState = 'PLAYING' | 'GAME_OVER' | 'LEVEL_UP';

export interface LaserBeam {
  x: number;       // center x (for vertical) or start x
  y: number;       // center y (for horizontal) or start y
  dir: 'h' | 'v';  // horizontal or vertical
  life: number;     // remaining lifetime
  maxLife: number;
}

export interface LightningArc {
  x1: number; y1: number;
  x2: number; y2: number;
  life: number;
  maxLife: number;
}

export interface Game {
  state: GameState;
  balls: Ball[];
  enemies: Enemy[];
  particles: Particle[];
  damageNumbers: DamageNumber[];
  gems: Gem[];
  laserBeams: LaserBeam[];
  lightningArcs: LightningArc[];
  juice: JuiceState;
  wave: WaveState;
  playerHp: number;
  score: number;
  fireTimer: number;
  input: InputState;
  playerPos: Vec2;
  stats: PlayerStats;
  ballQueue: BallType[];
  queueIndex: number;
  xp: number;
  xpToLevel: number;
  level: number;
  upgradeChoices: UpgradeOption[];
}

function xpForLevel(level: number): number {
  return Math.floor(XP_LEVEL_BASE * Math.pow(XP_LEVEL_GROWTH, level - 1));
}

function getLevelUpCardBounds(index: number): { x: number; y: number; w: number; h: number } {
  const w = activeTheme.layout.levelUpCardW;
  const h = activeTheme.layout.levelUpCardH;
  const gap = activeTheme.layout.levelUpGap;
  const x = (WORLD_W - w) / 2;
  const y = activeTheme.layout.levelUpStartY + index * (h + gap);
  return { x, y, w, h };
}

export function createGame(input: InputState): Game {
  return {
    state: 'PLAYING',
    balls: [],
    enemies: [],
    particles: [],
    damageNumbers: [],
    gems: [],
    laserBeams: [],
    lightningArcs: [],
    juice: createJuiceState(),
    wave: createWaveState(),
    playerHp: PLAYER_MAX_HP,
    score: 0,
    fireTimer: 0,
    input,
    playerPos: vec2(WORLD_W / 2, WORLD_H - 60),
    stats: {
      fireInterval: START_FIRE_INTERVAL,
      damage: START_BALL_DAMAGE,
      ballSpeed: BALL_SPEED,
      ballRadius: BALL_RADIUS,
      critChance: 0,
      xpMult: 1.0,
    },
    ballQueue: [...START_BALL_QUEUE],
    queueIndex: 0,
    xp: 0,
    xpToLevel: xpForLevel(1),
    level: 1,
    upgradeChoices: [],
  };
}

export function updateGame(game: Game, rawDt: number): void {
  const timeScale = getTimeScale(game.juice);
  const dt = rawDt * timeScale;

  // Always update juice with raw dt
  updateJuice(game.juice, rawDt);

  // Update particles
  game.particles = game.particles.filter(p => p.life > 0);
  for (const p of game.particles) updateParticle(p, dt);

  // Update damage numbers
  game.damageNumbers = game.damageNumbers.filter(dn => dn.life > 0);
  for (const dn of game.damageNumbers) updateDamageNumber(dn, dt);

  // Sync enemies from wave
  game.enemies = game.wave.enemies;

  // Update enemies (flash/shake decay)
  for (const e of game.enemies) updateEnemy(e, dt);

  // Poll keyboard for movement each frame
  pollKeyboard(game.input);

  if (game.state === 'PLAYING') {
    game.input.tapped = false;
    updatePlaying(game, dt);
  } else if (game.state === 'LEVEL_UP') {
    updateLevelUp(game);
  } else {
    updateGameOver(game);
  }
}

/** Find which queue slots are currently in flight */
function getOccupiedSlots(game: Game): Set<number> {
  const occupied = new Set<number>();
  for (const b of game.balls) {
    if (b.active || b.returning) {
      occupied.add(b.queueSlot);
    }
  }
  return occupied;
}

function spreadPoison(game: Game, source: Enemy, cx: number, cy: number): void {
  const spreadRadius = CELL_SIZE * POISON_SPREAD_RADIUS;
  for (const other of game.enemies) {
    if (!other.alive || other === source) continue;
    const ox = other.pos.x + other.width / 2;
    const oy = other.pos.y + other.height / 2;
    const ddx = ox - cx;
    const ddy = oy - cy;
    if (ddx * ddx + ddy * ddy < spreadRadius * spreadRadius) {
      applyPoison(other.status, game.stats.damage * POISON_DMG_FRACTION, POISON_DURATION);
    }
  }
  game.particles.push(...spawnPoisonSpreadParticles(cx, cy));
}

function handleEnemyKill(game: Game, enemy: Enemy, cx: number, cy: number): void {
  game.score++;
  const color = getEnemyColor(enemy.maxHp);
  game.particles.push(...spawnDeathParticles(cx, cy, color));
  triggerShake(game.juice, 2 + Math.min(game.juice.combo * 0.22, 4));
  triggerFlash(game.juice, activeTheme.colors.flashKill, 0.16);
  triggerScreenPulse(game.juice, 0.24);
  triggerHitStop(game.juice, 0.022);
  triggerComboPulse(game.juice, 0.28);
  playKill();
  const gemValue = Math.max(1, Math.ceil(enemy.maxHp * 0.1));
  game.gems.push(createGem(cx, cy, gemValue));
}

function updatePlaying(game: Game, dt: number): void {
  // 1. Player movement
  const occupied = getOccupiedSlots(game);
  const speed = 220;
  const md = game.input.moveDir;
  if (Math.abs(md.x) > 0.01 || Math.abs(md.y) > 0.01) {
    game.playerPos.x += md.x * speed * dt;
    game.playerPos.y += md.y * speed * dt;
  }

  // Clamp to grid bounds
  game.playerPos.x = clamp(game.playerPos.x, GRID_LEFT + PLAYER_RADIUS, GRID_RIGHT - PLAYER_RADIUS);
  game.playerPos.y = clamp(game.playerPos.y, PLAYER_RADIUS, WORLD_H - PLAYER_RADIUS);

  // 2. Queue-based firing
  game.fireTimer -= dt;
  if (game.fireTimer <= 0) {
    // Find next available slot starting from queueIndex
    const len = game.ballQueue.length;
    for (let i = 0; i < len; i++) {
      const slot = (game.queueIndex + i) % len;
      if (!occupied.has(slot)) {
        // Aim
        let aimDx = game.input.aimPos.x - game.playerPos.x;
        let aimDy = game.input.aimPos.y - game.playerPos.y;
        const aimDist = Math.sqrt(aimDx * aimDx + aimDy * aimDy);
        if (aimDist > 1) {
          aimDx /= aimDist;
          aimDy /= aimDist;
        } else {
          aimDx = 0;
          aimDy = -1;
        }
        // Clamp: don't fire downward
        if (aimDy > -0.1) {
          aimDy = -0.1;
          const len2 = Math.sqrt(aimDx * aimDx + aimDy * aimDy);
          aimDx /= len2;
          aimDy /= len2;
        }
        const spread = (Math.random() - 0.5) * (6 * Math.PI / 180);
        const cos = Math.cos(spread);
        const sin = Math.sin(spread);
        const dirX = aimDx * cos - aimDy * sin;
        const dirY = aimDx * sin + aimDy * cos;

        const ballType = game.ballQueue[slot];
        const ballRadius = ballType === 'normal' ? game.stats.ballRadius : game.stats.ballRadius * 1.6; // special balls are 60% larger
        const ball = createBall(
          game.playerPos.x, game.playerPos.y - PLAYER_RADIUS,
          dirX, dirY,
          ballType,
          slot,
          game.stats.ballSpeed,
          ballRadius,
        );
        game.balls.push(ball);
        playShoot();
        game.queueIndex = (slot + 1) % len;
        game.fireTimer = game.stats.fireInterval;
        break;
      }
    }
  }

  // 3. Update all balls
  const RETURN_SPEED = game.stats.ballSpeed * 0.8;
  for (const ball of game.balls) {
    ball.age += dt;
    updateBallTrail(ball);

    if (ball.active) {
      // Check if active ball passes close to player — catch it early
      const catchDx = game.playerPos.x - ball.pos.x;
      const catchDy = game.playerPos.y - ball.pos.y;
      const catchDist = Math.sqrt(catchDx * catchDx + catchDy * catchDy);
      if (catchDist < BALL_CATCH_RADIUS && ball.age > 0.15) {
        // Caught an active ball — slot becomes available
        ball.active = false;
        ball.returning = false;
        playCatch();
        continue;
      }

      // Active ball — normal physics, hits enemies
      const result = updateBallPhysics(ball, dt, game.enemies, GRID_LEFT, GRID_RIGHT);
      if (result.wallBounced) playWallBounce();

      for (const hit of result.hits) {
        const baseDmg = game.stats.damage;
        let totalDmg = baseDmg;
        const isCrit = Math.random() < game.stats.critChance;
        if (isCrit) totalDmg *= 2;

        // Freeze bonus: frozen enemies take extra damage
        totalDmg = Math.ceil(totalDmg * getDamageMult(hit.enemy.status));

        // Bleed pop: consume stacks for bonus damage when hit by ANY ball
        const bleedStacks = popBleed(hit.enemy.status);
        if (bleedStacks > 0) {
          totalDmg += Math.ceil(bleedStacks * BLEED_DMG_PER_STACK * baseDmg);
        }

        const killed = damageEnemy(hit.enemy, totalDmg);
        game.damageNumbers.push(
          isCrit
            ? spawnDamageNumber(hit.hitPos.x, hit.hitPos.y, totalDmg, '#ffe066', '#ffaa00')
            : spawnDamageNumber(hit.hitPos.x, hit.hitPos.y, totalDmg)
        );
        triggerShake(game.juice, isCrit ? 1.2 : 0.65);
        triggerComboPulse(game.juice, 0.2);
        incrementCombo(game.juice);
        playHit();

        // === On-hit effects (fire every hit, not just kill) ===
        const cx = hit.enemy.pos.x + hit.enemy.width / 2;
        const cy = hit.enemy.pos.y + hit.enemy.height / 2;

        // Laser: beam on every hit
        if (ball.type === 'laser') {
          const absVX = Math.abs(ball.vel.x);
          const absVY = Math.abs(ball.vel.y);
          const dir: 'h' | 'v' = absVX > absVY ? 'v' : 'h';
          const beamDmg = Math.ceil(baseDmg * LASER_HIT_DMG_FRACTION);

          game.laserBeams.push({ x: cx, y: cy, dir, life: LASER_BEAM_LIFE, maxLife: LASER_BEAM_LIFE });

          for (const other of game.enemies) {
            if (!other.alive || other === hit.enemy) continue;
            const ox = other.pos.x + other.width / 2;
            const oy = other.pos.y + other.height / 2;
            let intersects = false;
            if (dir === 'v') {
              intersects = cx >= other.pos.x && cx <= other.pos.x + other.width;
            } else {
              intersects = cy >= other.pos.y && cy <= other.pos.y + other.height;
            }
            if (intersects) {
              const laserKilled = damageEnemy(other, beamDmg);
              game.damageNumbers.push(spawnDamageNumber(ox, oy, beamDmg));
              if (laserKilled) {
                handleEnemyKill(game, other, ox, oy);
              }
            }
          }
          triggerShake(game.juice, 1.2);
          triggerFlash(game.juice, '#b388ff', 0.08);
          triggerScreenPulse(game.juice, 0.12);
          playLaser();
        }

        // Explosive: AoE splash on every hit
        if (ball.type === 'explosive') {
          const splashDmg = Math.ceil(baseDmg * EXPLOSIVE_HIT_DMG_FRACTION);
          const splashRadius = CELL_SIZE * EXPLOSIVE_HIT_RADIUS;
          let chainKills = 0;
          for (const other of game.enemies) {
            if (!other.alive || other === hit.enemy) continue;
            const ox = other.pos.x + other.width / 2;
            const oy = other.pos.y + other.height / 2;
            const ddx = ox - cx;
            const ddy = oy - cy;
            if (ddx * ddx + ddy * ddy < splashRadius * splashRadius) {
              const splashKilled = damageEnemy(other, splashDmg);
              game.damageNumbers.push(spawnDamageNumber(ox, oy, splashDmg));
              if (splashKilled) {
                chainKills++;
                handleEnemyKill(game, other, ox, oy);
              }
            }
          }
          game.particles.push(...spawnExplosionParticles(cx, cy));
          playExplosion();
          triggerShake(game.juice, 1.5 + chainKills * 0.2);
          triggerFlash(game.juice, activeTheme.colors.flashChain, 0.1);
          triggerScreenPulse(game.juice, 0.15 + Math.min(chainKills * 0.04, 0.15));
        }

        // Bleed: add 1 stack
        if (ball.type === 'bleed' && hit.enemy.alive) {
          applyBleed(hit.enemy.status, 1);
          playBleed();
        }

        // Burn: apply DoT
        if (ball.type === 'burn' && hit.enemy.alive) {
          applyBurn(hit.enemy.status, baseDmg * BURN_DMG_FRACTION, BURN_DURATION);
          playBurn();
        }

        // Poison: apply DoT
        if (ball.type === 'poison' && hit.enemy.alive) {
          applyPoison(hit.enemy.status, baseDmg * POISON_DMG_FRACTION, POISON_DURATION);
          playPoison();
        }

        // Lightning: chain to nearby enemies
        if (ball.type === 'lightning') {
          const chainDmg = Math.ceil(baseDmg * LIGHTNING_DMG_FRACTION);
          const chainRadius = CELL_SIZE * LIGHTNING_CHAIN_RADIUS;
          const nearby = game.enemies
            .filter(e => e.alive && e !== hit.enemy)
            .map(e => {
              const ox = e.pos.x + e.width / 2;
              const oy = e.pos.y + e.height / 2;
              const dd = (ox - cx) * (ox - cx) + (oy - cy) * (oy - cy);
              return { enemy: e, ox, oy, dist: dd };
            })
            .filter(e => e.dist < chainRadius * chainRadius)
            .sort((a, b) => a.dist - b.dist)
            .slice(0, LIGHTNING_CHAIN_COUNT);

          for (const target of nearby) {
            const lKilled = damageEnemy(target.enemy, chainDmg);
            game.damageNumbers.push(spawnDamageNumber(target.ox, target.oy, chainDmg));
            game.lightningArcs.push({
              x1: cx, y1: cy, x2: target.ox, y2: target.oy,
              life: 0.12, maxLife: 0.12,
            });
            game.particles.push(...spawnLightningParticles(cx, cy, target.ox, target.oy));
            if (lKilled) {
              handleEnemyKill(game, target.enemy, target.ox, target.oy);
            }
          }
          if (nearby.length > 0) {
            triggerShake(game.juice, 1.0);
            triggerFlash(game.juice, '#88ddff', 0.06);
            playLightning();
          }
        }

        // Freeze: chance to freeze
        if (ball.type === 'freeze' && hit.enemy.alive) {
          if (Math.random() < FREEZE_CHANCE) {
            applyFreeze(hit.enemy.status, FREEZE_DURATION, FREEZE_DMG_MULT);
            playFreeze();
          }
        }

        // === Kill rewards ===
        if (killed) {
          // Poison spread on kill
          if (hit.enemy.status.poison) {
            spreadPoison(game, hit.enemy, cx, cy);
          }
          handleEnemyKill(game, hit.enemy, cx, cy);
        }
      }

      // Floor bounce → enter returning state
      if (result.bounced) {
        ball.active = false;
        ball.returning = true;
      }
    }

    if (ball.returning) {
      // Home toward player
      const targetX = clamp(game.playerPos.x, GRID_LEFT, GRID_RIGHT);
      const dx = targetX - ball.pos.x;
      const dy = game.playerPos.y - ball.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 1) {
        ball.vel.x = (dx / dist) * RETURN_SPEED;
        ball.vel.y = (dy / dist) * RETURN_SPEED;
        ball.pos.x += ball.vel.x * dt;
        ball.pos.y += ball.vel.y * dt;
      }

      // Catch — player touches returning ball → slot available again
      if (dist < BALL_CATCH_RADIUS) {
        ball.returning = false; // mark for removal
        playCatch();
      }
    }
  }

  // 4. Cull collected balls (removed age expiry — balls persist until caught)
  game.balls = game.balls.filter(b => b.active || b.returning);

  // 5. Player-enemy collision — touching an enemy damages player
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const ex = e.pos.x + e.shakeX;
    const ey = e.pos.y;
    // Closest point on enemy rect to player center
    const cx = clamp(game.playerPos.x, ex, ex + e.width);
    const cy = clamp(game.playerPos.y, ey, ey + e.height);
    const dx = game.playerPos.x - cx;
    const dy = game.playerPos.y - cy;
    if (dx * dx + dy * dy < PLAYER_RADIUS * PLAYER_RADIUS) {
      e.alive = false;
      game.playerHp--;
      triggerFlash(game.juice, activeTheme.colors.flashDamage, 0.34);
      triggerShake(game.juice, 3.2);
      triggerScreenPulse(game.juice, 0.5);
      triggerHitStop(game.juice, 0.018);
      playDamage();
      if (game.playerHp <= 0) {
        game.playerHp = 0;
        game.state = 'GAME_OVER';
        playGameOver();
        game.input.tapped = false;
        return;
      }
    }
  }

  // 6. Update gems
  for (const gem of game.gems) {
    const collected = updateGem(gem, dt, game.playerPos);
    if (collected) {
      game.xp += Math.ceil(gem.value * game.stats.xpMult);
      playGem();
      // Level up check
      if (game.xp >= game.xpToLevel) {
        game.xp -= game.xpToLevel;
        game.level++;
        game.xpToLevel = xpForLevel(game.level);
        game.upgradeChoices = rollUpgradeChoices(3);
        game.state = 'LEVEL_UP';
        triggerFlash(game.juice, activeTheme.colors.flashKill, 0.18);
        triggerScreenPulse(game.juice, 0.75);
        playLevelUp();
        game.input.tapped = false;
        return;
      }
    }
  }
  game.gems = game.gems.filter(g => g.alive);

  // 6b. Update laser beams
  for (const beam of game.laserBeams) {
    beam.life -= dt;
  }
  game.laserBeams = game.laserBeams.filter(b => b.life > 0);

  // 6c. Update lightning arcs
  for (const arc of game.lightningArcs) {
    arc.life -= dt;
  }
  game.lightningArcs = game.lightningArcs.filter(a => a.life > 0);

  // 6d. Update status effects (DoT ticking)
  for (const e of game.enemies) {
    if (!e.alive || !hasAnyStatus(e.status)) continue;
    // Save poison ref before tick (tick may null it if expired)
    const hadPoison = e.status.poison !== null;
    const result = updateStatusEffects(e.status, dt);
    const ex = e.pos.x + e.width / 2;
    const ey = e.pos.y + e.height / 2;

    // Burn damage — orange numbers
    if (result.burnDamage > 0) {
      const burnDmg = Math.ceil(result.burnDamage);
      const killed = damageEnemy(e, burnDmg);
      game.damageNumbers.push(spawnDamageNumber(ex, ey, burnDmg, '#ff8833', '#ff6600'));
      if (killed) {
        if (hadPoison) spreadPoison(game, e, ex, ey);
        handleEnemyKill(game, e, ex, ey);
        continue; // enemy dead, skip poison tick
      }
    }

    // Poison damage — green numbers
    if (result.poisonDamage > 0 && e.alive) {
      const poisonDmg = Math.ceil(result.poisonDamage);
      const killed = damageEnemy(e, poisonDmg);
      game.damageNumbers.push(spawnDamageNumber(ex, ey - 8, poisonDmg, '#66ff66', '#44cc44'));
      if (killed) {
        if (hadPoison) spreadPoison(game, e, ex, ey);
        handleEnemyKill(game, e, ex, ey);
      }
    }
  }

  // 7. Update wave (continuous scroll + spawn)
  const dangerCount = updateWave(game.wave, dt, GRID_COLS, CELL_SIZE, GRID_LEFT);
  if (dangerCount > 0) {
    game.playerHp -= dangerCount;
    triggerFlash(game.juice, activeTheme.colors.flashDamage, 0.36);
    triggerShake(game.juice, 4.2);
    triggerScreenPulse(game.juice, 0.58);
    triggerHitStop(game.juice, 0.016);
    playDamage();
    if (game.playerHp <= 0) {
      game.playerHp = 0;
      game.state = 'GAME_OVER';
      playGameOver();
      game.input.tapped = false;
      return;
    }
  }
}

function updateLevelUp(game: Game): void {
  if (consumeTap(game.input)) {
    // Determine which upgrade card was tapped based on position
    const tapX = game.input.tapPos.x;
    const tapY = game.input.tapPos.y;

    for (let i = 0; i < game.upgradeChoices.length; i++) {
      const card = getLevelUpCardBounds(i);
      if (tapX >= card.x && tapX <= card.x + card.w && tapY >= card.y && tapY <= card.y + card.h) {
        const choice = game.upgradeChoices[i];
        if (choice.apply) {
          choice.apply(game.stats);
        }
        if (choice.addBall) {
          game.ballQueue.push(choice.addBall);
        }
        if (choice.healHp) {
          game.playerHp = Math.min(game.playerHp + choice.healHp, PLAYER_MAX_HP);
        }
        triggerScreenPulse(game.juice, 0.45);
        game.state = 'PLAYING';
        game.upgradeChoices = [];
        return;
      }
    }
  }
}

function updateGameOver(game: Game): void {
  if (consumeTap(game.input)) {
    const newGame = createGame(game.input);
    Object.assign(game, newGame);
  }
}
