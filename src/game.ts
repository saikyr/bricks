import { Ball, BallType, createBall, updateBallTrail } from './entities/ball';
import { Enemy, damageEnemy, updateEnemy, getEnemyColor } from './entities/enemy';
import { Particle, DamageNumber, updateParticle, spawnDamageNumber, updateDamageNumber, spawnDeathParticles, spawnExplosionParticles, spawnLightningParticles, spawnPoisonSpreadParticles } from './entities/particle';
import { InputState, consumeTap, consumeSwipe } from './input';
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
import { PlayerStats, UpgradeOption, UpgradeContext, rollUpgradeChoices } from './systems/upgrade';
import { Vec2, vec2, clamp } from './utils/math';
import {
  playHit, playKill, playDamage, playLevelUp, playGameOver,
  playShoot, playWallBounce,
  playLaser, playExplosion, playBleed, playBurn, playPoison, playLightning, playFreeze,
} from './systems/audio';
import { activeTheme } from './theme';
import {
  WORLD_W, WORLD_H, PLAYER_MAX_HP,
  BALL_SPEED, BALL_RADIUS,
  START_BALL_QUEUE, START_BALL_DAMAGE, MAGAZINE_CAP,
  BALL_RECYCLE_COOLDOWN, FIRE_RATE_COOLDOWN, BALL_SPAWN_Y,
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
  x: number;
  y: number;
  dir: 'h' | 'v';
  life: number;
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
  laserBeams: LaserBeam[];
  lightningArcs: LightningArc[];
  juice: JuiceState;
  wave: WaveState;
  playerHp: number;
  score: number;
  input: InputState;
  stats: PlayerStats;
  ballQueue: BallType[];
  returningBalls: { type: BallType; cooldown: number }[];
  aimDir: { dirX: number; dirY: number; originX: number } | null;
  autoFireCooldown: number;
  xp: number;
  xpToLevel: number;
  level: number;
  upgradeChoices: UpgradeOption[];
  ballUpgrades: Record<string, number>;
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
    laserBeams: [],
    lightningArcs: [],
    juice: createJuiceState(),
    wave: createWaveState(),
    playerHp: PLAYER_MAX_HP,
    score: 0,
    input,
    stats: {
      recycleCooldown: BALL_RECYCLE_COOLDOWN,
      fireRate: FIRE_RATE_COOLDOWN,
      damage: START_BALL_DAMAGE,
      ballSpeed: BALL_SPEED,
      ballRadius: BALL_RADIUS,
      critChance: 0,
      xpMult: 1.0,
    },
    ballQueue: [...START_BALL_QUEUE],
    returningBalls: [],
    aimDir: null,
    autoFireCooldown: 0,
    xp: 0,
    xpToLevel: xpForLevel(1),
    level: 1,
    upgradeChoices: [],
    ballUpgrades: {},
  };
}

function totalBallCount(game: Game): number {
  return game.ballQueue.length + game.returningBalls.length + game.balls.filter(b => b.active).length;
}

function normalBallCount(game: Game): number {
  let count = 0;
  for (const t of game.ballQueue) if (t === 'normal') count++;
  for (const rb of game.returningBalls) if (rb.type === 'normal') count++;
  for (const b of game.balls) if (b.active && b.type === 'normal') count++;
  return count;
}

function ownedBallTypes(game: Game): Set<BallType> {
  const types = new Set<BallType>();
  for (const t of game.ballQueue) types.add(t);
  for (const rb of game.returningBalls) types.add(rb.type);
  for (const b of game.balls) if (b.active) types.add(b.type);
  return types;
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

  if (game.state === 'PLAYING') {
    game.input.tapped = false;
    updatePlaying(game, dt);
  } else if (game.state === 'LEVEL_UP') {
    updateLevelUp(game);
  } else {
    updateGameOver(game);
  }
}

/** Magazine has ammo if ballQueue is non-empty. Index 0 fires next. */
export function magazineReady(game: Game): boolean {
  return game.ballQueue.length > 0;
}

function spreadPoison(game: Game, source: Enemy, cx: number, cy: number): void {
  const poisonMult = 1 + (game.ballUpgrades.poison || 0) * 0.5;
  const spreadRadius = CELL_SIZE * POISON_SPREAD_RADIUS * poisonMult;
  for (const other of game.enemies) {
    if (!other.alive || other === source) continue;
    const ox = other.pos.x + other.width / 2;
    const oy = other.pos.y + other.height / 2;
    const ddx = ox - cx;
    const ddy = oy - cy;
    if (ddx * ddx + ddy * ddy < spreadRadius * spreadRadius) {
      applyPoison(other.status, game.stats.damage * POISON_DMG_FRACTION * poisonMult, POISON_DURATION);
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

  // Instant XP on kill (no gems)
  const xpValue = Math.max(1, Math.ceil(enemy.maxHp * 0.1));
  game.xp += Math.ceil(xpValue * game.stats.xpMult);
  if (game.xp >= game.xpToLevel) {
    game.xp -= game.xpToLevel;
    game.level++;
    game.xpToLevel = xpForLevel(game.level);
    const upgradeCtx: UpgradeContext = {
      totalBalls: totalBallCount(game),
      normalCount: normalBallCount(game),
      ownedTypes: ownedBallTypes(game),
      level: game.level,
      ballUpgrades: game.ballUpgrades,
    };
    game.upgradeChoices = rollUpgradeChoices(3, upgradeCtx);
    game.state = 'LEVEL_UP';
    triggerFlash(game.juice, activeTheme.colors.flashKill, 0.18);
    triggerScreenPulse(game.juice, 0.75);
    playLevelUp();
    game.input.tapped = false;
  }
}

function updatePlaying(game: Game, dt: number): void {
  // 1. Tick returning-ball cooldowns; push back into magazine when ready
  for (let i = game.returningBalls.length - 1; i >= 0; i--) {
    game.returningBalls[i].cooldown -= dt;
    if (game.returningBalls[i].cooldown <= 0) {
      game.ballQueue.push(game.returningBalls[i].type);
      game.returningBalls.splice(i, 1);
    }
  }

  // 2. Swipe sets aim direction
  const swipe = consumeSwipe(game.input);
  if (swipe) {
    game.aimDir = { dirX: swipe.dirX, dirY: swipe.dirY, originX: swipe.originX };
  }

  // 3. Auto-fire in aim direction
  if (game.aimDir && game.ballQueue.length > 0) {
    game.autoFireCooldown -= dt;
    if (game.autoFireCooldown <= 0) {
      const ballType = game.ballQueue.shift()!;
      game.autoFireCooldown = game.stats.fireRate;

      const spread = (Math.random() - 0.5) * (6 * Math.PI / 180);
      const cos = Math.cos(spread);
      const sin = Math.sin(spread);
      const dirX = game.aimDir.dirX * cos - game.aimDir.dirY * sin;
      const dirY = game.aimDir.dirX * sin + game.aimDir.dirY * cos;

      const ballRadius = ballType === 'normal' ? game.stats.ballRadius : game.stats.ballRadius * 1.6;
      const spawnX = clamp(game.aimDir.originX, GRID_LEFT + ballRadius, GRID_RIGHT - ballRadius);
      const ball = createBall(
        spawnX, BALL_SPAWN_Y,
        dirX, dirY,
        ballType,
        0,
        game.stats.ballSpeed,
        ballRadius,
      );
      game.balls.push(ball);
      playShoot();
    }
  }

  // 3. Update all balls
  for (const ball of game.balls) {
    ball.age += dt;
    updateBallTrail(ball);

    if (ball.active) {
      // Active ball — normal physics, hits enemies
      const result = updateBallPhysics(ball, dt, game.enemies, GRID_LEFT, GRID_RIGHT);
      if (result.wallBounced) playWallBounce();

      for (const hit of result.hits) {
        const baseDmg = game.stats.damage;
        let totalDmg = baseDmg;
        const isCrit = Math.random() < game.stats.critChance;
        if (isCrit) totalDmg *= 2;

        // Spectral bonus: scaled by upgrade
        if (ball.type === 'spectral') {
          totalDmg *= 1 + (game.ballUpgrades.spectral || 0) * 0.5;
        }

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
          const laserMult = 1 + (game.ballUpgrades.laser || 0) * 0.3;
          const beamDmg = Math.ceil(baseDmg * LASER_HIT_DMG_FRACTION * laserMult);

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
          const explosiveMult = 1 + (game.ballUpgrades.explosive || 0) * 0.3;
          const splashRadius = CELL_SIZE * EXPLOSIVE_HIT_RADIUS * explosiveMult;
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

        // Bleed: add stacks (scaled by upgrade)
        if (ball.type === 'bleed' && hit.enemy.alive) {
          const stacks = 1 + (game.ballUpgrades.bleed || 0);
          applyBleed(hit.enemy.status, stacks);
          playBleed();
        }

        // Burn: apply DoT (scaled by upgrade)
        if (ball.type === 'burn' && hit.enemy.alive) {
          const burnMult = 1 + (game.ballUpgrades.burn || 0) * 0.5;
          applyBurn(hit.enemy.status, baseDmg * BURN_DMG_FRACTION * burnMult, BURN_DURATION);
          playBurn();
        }

        // Poison: apply DoT (scaled by upgrade)
        if (ball.type === 'poison' && hit.enemy.alive) {
          const poisonMult = 1 + (game.ballUpgrades.poison || 0) * 0.5;
          applyPoison(hit.enemy.status, baseDmg * POISON_DMG_FRACTION * poisonMult, POISON_DURATION);
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
            .slice(0, LIGHTNING_CHAIN_COUNT + (game.ballUpgrades.lightning || 0));

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

        // Freeze: chance to freeze (scaled by upgrade)
        if (ball.type === 'freeze' && hit.enemy.alive) {
          const freezeChance = FREEZE_CHANCE + (game.ballUpgrades.freeze || 0) * 0.15;
          if (Math.random() < freezeChance) {
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

      // Floor bounce → ball returns to magazine after cooldown
      if (result.bounced) {
        ball.active = false;
        game.returningBalls.push({ type: ball.type, cooldown: game.stats.recycleCooldown });
      }
    }
  }

  // 4. Cull inactive balls
  game.balls = game.balls.filter(b => b.active);

  // 5. Update laser beams
  for (const beam of game.laserBeams) {
    beam.life -= dt;
  }
  game.laserBeams = game.laserBeams.filter(b => b.life > 0);

  // 6. Update lightning arcs
  for (const arc of game.lightningArcs) {
    arc.life -= dt;
  }
  game.lightningArcs = game.lightningArcs.filter(a => a.life > 0);

  // 7. Update status effects (DoT ticking)
  for (const e of game.enemies) {
    if (!e.alive || !hasAnyStatus(e.status)) continue;
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
        continue;
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

  // 8. Update wave (continuous scroll + spawn)
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
          // Replace a normal ball — check queue, then returning, then in-flight
          const normalIdx = game.ballQueue.indexOf('normal');
          if (normalIdx >= 0) {
            game.ballQueue[normalIdx] = choice.addBall;
          } else {
            const retIdx = game.returningBalls.findIndex(rb => rb.type === 'normal');
            if (retIdx >= 0) {
              game.returningBalls[retIdx].type = choice.addBall;
            } else {
              const activeBall = game.balls.find(b => b.active && b.type === 'normal');
              if (activeBall) {
                activeBall.type = choice.addBall;
              }
            }
          }
        }
        if (choice.healHp) {
          game.playerHp = Math.min(game.playerHp + choice.healHp, PLAYER_MAX_HP);
        }
        if (choice.applyBallUpgrade) {
          choice.applyBallUpgrade(game.ballUpgrades);
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
