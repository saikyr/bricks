import { Game, LaserBeam, LightningArc } from './game';
import { Enemy, getSpawnScale, getEnemyColor } from './entities/enemy';
import { hasAnyStatus } from './systems/status';
import { Ball } from './entities/ball';
import { Gem } from './entities/gem';
import { Particle, DamageNumber } from './entities/particle';
import { clamp } from './utils/math';
import {
  WORLD_W,
  WORLD_H,
  PLAYER_MAX_HP,
  PLAYER_RADIUS,
  GRID_LEFT,
  GRID_COLS,
  CELL_SIZE,
  ENEMY_CORNER_RADIUS,
} from './utils/constants';
import { activeTheme } from './theme';

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let startTime = 0;
let gridOffset = 0;

// Ambient bokeh particles for background atmosphere
interface BokehDot {
  x: number; y: number; r: number; speed: number;
  drift: number; alpha: number; hue: number;
}
const bokehDots: BokehDot[] = [];
function initBokeh(): void {
  for (let i = 0; i < 28; i++) {
    bokehDots.push({
      x: Math.random() * WORLD_W,
      y: Math.random() * WORLD_H,
      r: 1.5 + Math.random() * 4,
      speed: 4 + Math.random() * 8,
      drift: (Math.random() - 0.5) * 6,
      alpha: 0.03 + Math.random() * 0.06,
      hue: Math.random() < 0.5 ? 210 : 260, // blue or purple tint
    });
  }
}

function roundRect(x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) {
    h = `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  if (h.length !== 6) return [255, 255, 255];
  const n = Number.parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `rgb(${lr},${lg},${lb})`;
}

function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const dr = Math.round(r * (1 - amount));
  const dg = Math.round(g * (1 - amount));
  const db = Math.round(b * (1 - amount));
  return `rgb(${dr},${dg},${db})`;
}

function rgbaFromRgb(r: number, g: number, b: number, a: number): string {
  return `rgba(${r},${g},${b},${a})`;
}

function getLevelUpCardBounds(index: number): { x: number; y: number; w: number; h: number } {
  const w = activeTheme.layout.levelUpCardW;
  const h = activeTheme.layout.levelUpCardH;
  const gap = activeTheme.layout.levelUpGap;
  const x = (WORLD_W - w) / 2;
  const y = activeTheme.layout.levelUpStartY + index * (h + gap);
  return { x, y, w, h };
}

function getUpgradeAccent(id: string): string {
  if (id.includes('explosive')) return '#ff9f5c';
  if (id.includes('spectral')) return '#57f2be';
  if (id.includes('laser')) return '#b388ff';
  if (id.includes('bleed')) return '#ff4466';
  if (id.includes('burn')) return '#ffcc00';
  if (id.includes('poison')) return '#44cc44';
  if (id.includes('lightning')) return '#88ddff';
  if (id.includes('freeze')) return '#aaeeff';
  if (id.includes('damage')) return '#ffcc66';
  if (id.includes('ball_')) return '#70e9ff';
  if (id.includes('fire')) return '#87a9ff';
  return '#66d7ff';
}

export function initRenderer(c: HTMLCanvasElement): { scale: number; offsetX: number; offsetY: number } {
  canvas = c;
  ctx = canvas.getContext('2d')!;
  startTime = performance.now() / 1000;
  if (bokehDots.length === 0) initBokeh();
  return resize();
}

export function resize(): { scale: number; offsetX: number; offsetY: number } {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = WORLD_W / WORLD_H;
  const screenAspect = w / h;

  if (screenAspect > aspect) {
    scale = h / WORLD_H;
  } else {
    scale = w / WORLD_W;
  }

  canvas.width = w * devicePixelRatio;
  canvas.height = h * devicePixelRatio;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  offsetX = (w - WORLD_W * scale) / 2;
  offsetY = (h - WORLD_H * scale) / 2;

  return { scale, offsetX, offsetY };
}

function drawBackground(dt: number, time: number): void {
  // Radial gradient fill with slow vertical wash
  const cx = WORLD_W / 2;
  const washY = WORLD_H / 2 + Math.sin(time * 0.3) * 50;
  const maxR = Math.hypot(cx, WORLD_H);
  const bgGrad = ctx.createRadialGradient(cx, washY, 0, cx, washY, maxR);
  bgGrad.addColorStop(0, activeTheme.gradients.bgCenter);
  bgGrad.addColorStop(1, activeTheme.gradients.bgEdge);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Subtle color nebula patches — drifting colored glows
  const nebulae = [
    { x: WORLD_W * 0.2, y: WORLD_H * 0.3, r: 120, color: [40, 20, 80] as const, phase: 0.7 },
    { x: WORLD_W * 0.8, y: WORLD_H * 0.6, r: 100, color: [20, 40, 90] as const, phase: 1.3 },
    { x: WORLD_W * 0.5, y: WORLD_H * 0.8, r: 90, color: [50, 15, 60] as const, phase: 2.1 },
  ];
  for (const n of nebulae) {
    const nx = n.x + Math.sin(time * 0.15 + n.phase) * 30;
    const ny = n.y + Math.cos(time * 0.12 + n.phase) * 20;
    const nebGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, n.r);
    nebGrad.addColorStop(0, rgbaFromRgb(n.color[0], n.color[1], n.color[2], 0.08));
    nebGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = nebGrad;
    ctx.fillRect(nx - n.r, ny - n.r, n.r * 2, n.r * 2);
  }

  // Blue-tinted scrolling grid
  gridOffset = (gridOffset + 15 * dt) % 40;
  ctx.strokeStyle = 'rgba(100,140,255,0.025)';
  ctx.lineWidth = 1.5;

  for (let x = 0; x < WORLD_W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, WORLD_H);
    ctx.stroke();
  }

  for (let y = -40 + gridOffset; y < WORLD_H + 40; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(WORLD_W, y + 0.5);
    ctx.stroke();
  }

  // Ambient bokeh dots — drifting upward
  for (const dot of bokehDots) {
    dot.y -= dot.speed * dt;
    dot.x += dot.drift * dt;
    if (dot.y < -dot.r * 2) { dot.y = WORLD_H + dot.r * 2; dot.x = Math.random() * WORLD_W; }
    if (dot.x < -20) dot.x = WORLD_W + 10;
    if (dot.x > WORLD_W + 20) dot.x = -10;

    const bokGrad = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, dot.r);
    const c = dot.hue === 210 ? '120,160,255' : '160,120,255';
    bokGrad.addColorStop(0, `rgba(${c},${dot.alpha * 1.5})`);
    bokGrad.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = bokGrad;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Radial vignette
  const cy = WORLD_H / 2;
  const vigR = Math.hypot(cx, cy);
  const grad = ctx.createRadialGradient(cx, cy, vigR * 0.25, cx, cy, vigR);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
}

function drawPlayer(game: Game): void {
  const px = game.playerPos.x;
  const py = game.playerPos.y;
  const size = PLAYER_RADIUS * 2.8;
  const half = size / 2;
  const cr = ENEMY_CORNER_RADIUS;

  ctx.save();
  ctx.translate(px, py);

  // Pulsing cyan glow halo — larger, more visible
  const pulseAmt = game.juice.screenPulse || 0;
  const glowR = size * (1.8 + pulseAmt * 0.5);
  const glowAlpha = 0.35 + pulseAmt * 0.2;
  const glowGrad = ctx.createRadialGradient(0, 0, half * 0.3, 0, 0, glowR);
  glowGrad.addColorStop(0, rgba(activeTheme.colors.playerGlow, glowAlpha));
  glowGrad.addColorStop(0.5, rgba(activeTheme.colors.playerGlow, glowAlpha * 0.3));
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(0, 0, glowR, 0, Math.PI * 2);
  ctx.fill();

  // Drop shadow
  ctx.save();
  ctx.globalAlpha = 0.3;
  roundRect(-half + 1, -half + 2, size, size, cr);
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.restore();

  // Rounded square body — vertical gradient with more contrast
  roundRect(-half, -half, size, size, cr);
  const bodyGrad = ctx.createLinearGradient(0, -half, 0, half);
  bodyGrad.addColorStop(0, lighten(activeTheme.colors.playerCore, 0.35));
  bodyGrad.addColorStop(0.5, activeTheme.colors.playerCore);
  bodyGrad.addColorStop(1, darken(activeTheme.colors.playerCore, 0.3));
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // Inner core glow — bright center radial
  ctx.save();
  roundRect(-half, -half, size, size, cr);
  ctx.clip();
  const coreGrad = ctx.createRadialGradient(0, -half * 0.2, 0, 0, 0, half * 0.9);
  coreGrad.addColorStop(0, 'rgba(255,255,255,0.2)');
  coreGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = coreGrad;
  ctx.fillRect(-half, -half, size, size);
  ctx.restore();

  // Gloss arc — semi-ellipse across top ~35%
  ctx.save();
  roundRect(-half, -half, size, size, cr);
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(0, -half, half * 1.1, size * 0.35, 0, 0, Math.PI);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fill();
  ctx.restore();

  // Bright white rim stroke
  roundRect(-half, -half, size, size, cr);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Dark border for definition
  roundRect(-half, -half, size, size, cr);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}

function drawEnemy(enemy: Enemy, time: number): void {
  if (!enemy.alive) return;
  const spawnScale = getSpawnScale(enemy);
  if (spawnScale <= 0) return;

  const cx = enemy.pos.x + enemy.shakeX + enemy.width / 2;
  const cy = enemy.pos.y + enemy.height / 2;
  const base = getEnemyColor(enemy.maxHp);

  const hitRatio = clamp(enemy.flashTimer / activeTheme.effects.flashDuration, 0, 1);
  const sx = spawnScale * (1 + hitRatio * 0.05);
  const sy = spawnScale * (1 - hitRatio * 0.04);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(sx, sy);
  ctx.translate(-cx, -cy);

  const x = enemy.pos.x + enemy.shakeX;
  const y = enemy.pos.y;
  const w = enemy.width;
  const h = enemy.height;

  // Soft drop shadow — depth separation
  ctx.save();
  ctx.globalAlpha = 0.25;
  roundRect(x + 1, y + 2, w, h, ENEMY_CORNER_RADIUS);
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.restore();

  // Vertical gradient body — richer contrast
  roundRect(x, y, w, h, ENEMY_CORNER_RADIUS);
  const bodyGrad = ctx.createLinearGradient(x, y, x, y + h);
  bodyGrad.addColorStop(0, lighten(base, 0.32));
  bodyGrad.addColorStop(0.4, lighten(base, 0.08));
  bodyGrad.addColorStop(1, darken(base, 0.28));
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // Gloss arc — semi-ellipse across top ~35%, clipped
  ctx.save();
  roundRect(x, y, w, h, ENEMY_CORNER_RADIUS);
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y, w / 2 * 1.1, h * 0.35, 0, 0, Math.PI);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fill();

  // Bottom edge glow — candy reflection
  const bottomGlowGrad = ctx.createLinearGradient(x, y + h * 0.75, x, y + h);
  bottomGlowGrad.addColorStop(0, 'rgba(255,255,255,0)');
  bottomGlowGrad.addColorStop(1, 'rgba(255,255,255,0.06)');
  ctx.fillStyle = bottomGlowGrad;
  ctx.fillRect(x, y + h * 0.75, w, h * 0.25);
  ctx.restore();

  // Inner shadow — dark inset for bevel
  roundRect(x, y, w, h, ENEMY_CORNER_RADIUS);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Outer bright rim — top/left highlight edge
  ctx.save();
  roundRect(x, y, w, h, ENEMY_CORNER_RADIUS);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1.5;
  roundRect(x + 0.5, y + 0.5, w - 1, h - 1, ENEMY_CORNER_RADIUS);
  ctx.stroke();
  ctx.restore();

  // Hit flash overlay
  if (hitRatio > 0) {
    roundRect(x, y, w, h, ENEMY_CORNER_RADIUS);
    ctx.globalAlpha = activeTheme.effects.enemyHitFlash * hitRatio;
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Status effect overlays
  if (hasAnyStatus(enemy.status)) {
    ctx.save();
    roundRect(x, y, w, h, ENEMY_CORNER_RADIUS);
    ctx.clip();

    // Bleed: pulsing red border
    if (enemy.status.bleed) {
      const bleedPulse = 0.4 + Math.sin(time * 6) * 0.2;
      roundRect(x, y, w, h, ENEMY_CORNER_RADIUS);
      ctx.strokeStyle = rgba('#ff4466', bleedPulse);
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Burn: flickering orange overlay
    if (enemy.status.burn) {
      const burnFlicker = 0.08 + Math.sin(time * 10) * 0.04;
      ctx.fillStyle = rgba('#ff8800', burnFlicker);
      ctx.fillRect(x, y, w, h);
    }

    // Poison: green tint
    if (enemy.status.poison) {
      ctx.fillStyle = rgba('#44cc44', 0.08);
      ctx.fillRect(x, y, w, h);
    }

    // Freeze: blue-white overlay + ice crystal hint
    if (enemy.status.freeze) {
      ctx.fillStyle = rgba('#aaeeff', 0.2);
      ctx.fillRect(x, y, w, h);
      // Small ice crystal shapes at corners
      const cr = Math.min(w, h) * 0.15;
      ctx.strokeStyle = rgba('#ffffff', 0.3);
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const icx = i < 2 ? x + cr : x + w - cr;
        const icy = i % 2 === 0 ? y + cr : y + h - cr;
        ctx.beginPath();
        for (let j = 0; j < 6; j++) {
          const a = j * Math.PI / 3;
          ctx.moveTo(icx, icy);
          ctx.lineTo(icx + Math.cos(a) * cr * 0.6, icy + Math.sin(a) * cr * 0.6);
        }
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // HP text with glow
  const fontSize = Math.min(w, h) * 0.41;
  ctx.font = `700 ${fontSize}px ${activeTheme.fonts.numeric}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Dark text shadow (offset)
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText(`${enemy.hp}`, cx + 0.8, cy + 1.2);
  // White text with subtle glow
  ctx.save();
  ctx.shadowColor = 'rgba(255,255,255,0.5)';
  ctx.shadowBlur = 3;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${enemy.hp}`, cx, cy + 0.5);
  ctx.restore();

  ctx.restore();
}

function getBallStyle(ball: Ball) {
  const t = ball.type;
  if (t === 'spectral') return activeTheme.ball.spectral;
  if (t === 'explosive') return activeTheme.ball.explosive;
  if (t === 'laser') return activeTheme.ball.laser;
  if (t === 'bleed') return activeTheme.ball.bleed;
  if (t === 'burn') return activeTheme.ball.burn;
  if (t === 'poison') return activeTheme.ball.poison;
  if (t === 'lightning') return activeTheme.ball.lightning;
  if (t === 'freeze') return activeTheme.ball.freeze;
  return activeTheme.ball.normal;
}

function drawBall(ball: Ball, time: number): void {
  if (!ball.active && !ball.returning) return;

  if (ball.type === 'spectral') {
    drawSpectralBall(ball, time);
  } else if (ball.type === 'explosive') {
    drawExplosiveBall(ball, time);
  } else if (ball.type === 'laser') {
    drawLaserBall(ball, time);
  } else if (ball.type === 'bleed') {
    drawBleedBall(ball, time);
  } else if (ball.type === 'burn') {
    drawBurnBall(ball, time);
  } else if (ball.type === 'poison') {
    drawPoisonBall(ball, time);
  } else if (ball.type === 'lightning') {
    drawLightningBall(ball, time);
  } else if (ball.type === 'freeze') {
    drawFreezeBall(ball, time);
  } else {
    drawNormalBall(ball, time);
  }
}

function drawNormalBall(ball: Ball, time: number): void {
  const style = activeTheme.ball.normal;

  // Fading dot trail
  const samples = Math.min(ball.trail.length, 6);
  const step = ball.trail.length > samples ? ball.trail.length / samples : 1;
  for (let i = 0; i < samples; i++) {
    const idx = Math.floor(i * step);
    const t = ball.trail[idx];
    if (!t) continue;
    const progress = i / Math.max(1, samples - 1);
    const alpha = (1 - progress) * style.trailAlpha;
    const r = Math.max(0.5, ball.radius * (0.8 - progress * 0.5));
    const tGrad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, r);
    tGrad.addColorStop(0, rgba(style.glow, alpha * 0.8));
    tGrad.addColorStop(1, rgba(style.glow, 0));
    ctx.fillStyle = tGrad;
    ctx.beginPath();
    ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Glow halo
  const glowR = ball.radius * 2.5;
  const glowGrad = ctx.createRadialGradient(ball.pos.x, ball.pos.y, ball.radius * 0.2, ball.pos.x, ball.pos.y, glowR);
  glowGrad.addColorStop(0, rgba(style.glow, 0.25));
  glowGrad.addColorStop(0.5, rgba(style.glow, 0.08));
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(ball.pos.x, ball.pos.y, glowR, 0, Math.PI * 2);
  ctx.fill();

  // Spherical gradient body
  const liveAlpha = ball.returning ? 0.86 : 1;
  ctx.save();
  ctx.globalAlpha = liveAlpha;
  const offX = -ball.radius * 0.35;
  const offY = -ball.radius * 0.35;
  const sphereGrad = ctx.createRadialGradient(
    ball.pos.x + offX, ball.pos.y + offY, ball.radius * 0.05,
    ball.pos.x, ball.pos.y, ball.radius
  );
  sphereGrad.addColorStop(0, '#ffffff');
  sphereGrad.addColorStop(0.3, '#ddeeff');
  sphereGrad.addColorStop(0.7, '#ccddff');
  sphereGrad.addColorStop(1, darken('#ccddff', 0.4));
  ctx.beginPath();
  ctx.arc(ball.pos.x, ball.pos.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = sphereGrad;
  ctx.fill();

  // Rim highlight
  ctx.beginPath();
  ctx.arc(ball.pos.x, ball.pos.y, ball.radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Specular dot
  const specGrad = ctx.createRadialGradient(
    ball.pos.x + offX * 0.5, ball.pos.y + offY * 0.5, 0,
    ball.pos.x + offX * 0.5, ball.pos.y + offY * 0.5, ball.radius * 0.35
  );
  specGrad.addColorStop(0, 'rgba(255,255,255,0.9)');
  specGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = specGrad;
  ctx.beginPath();
  ctx.arc(ball.pos.x + offX * 0.5, ball.pos.y + offY * 0.5, ball.radius * 0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawSpectralBall(ball: Ball, time: number): void {
  const style = activeTheme.ball.spectral;
  const TAU = Math.PI * 2;
  const bx = ball.pos.x;
  const by = ball.pos.y;
  const br = ball.radius;

  // Dreamy trail — wide soft warm white-teal glow dots
  const samples = Math.min(ball.trail.length, 6);
  const step = ball.trail.length > samples ? ball.trail.length / samples : 1;
  for (let i = 0; i < samples; i++) {
    const idx = Math.floor(i * step);
    const t = ball.trail[idx];
    if (!t) continue;
    const progress = i / Math.max(1, samples - 1);
    const alpha = (1 - progress) * 0.4;
    const r = Math.max(1, br * (0.7 - progress * 0.35));
    const tGrad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, r * 1.8);
    tGrad.addColorStop(0, rgba('#ffffff', alpha * 0.25));
    tGrad.addColorStop(0.2, rgba(lighten(style.core, 0.4), alpha * 0.3));
    tGrad.addColorStop(0.6, rgba(style.core, alpha * 0.12));
    tGrad.addColorStop(1, rgba(style.glow, 0));
    ctx.fillStyle = tGrad;
    ctx.beginPath();
    ctx.arc(t.x, t.y, r * 1.8, 0, TAU);
    ctx.fill();
  }

  // Heavy outer glow halo
  const edgePulse = 0.5 + Math.sin(time * 3 + ball.queueSlot) * 0.5;
  const glowR = br * 3.3;
  const glowGrad = ctx.createRadialGradient(bx, by, br * 0.2, bx, by, glowR);
  glowGrad.addColorStop(0, rgba(style.glow, 0.55));
  glowGrad.addColorStop(0.35, rgba(style.glow, 0.22));
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(bx, by, glowR, 0, TAU);
  ctx.fill();

  // Faint shell — barely visible
  ctx.save();
  ctx.globalAlpha = (ball.returning ? 0.2 : 0.3) + edgePulse * 0.1;
  const shellGrad = ctx.createRadialGradient(bx, by, br * 0.4, bx, by, br);
  shellGrad.addColorStop(0, rgba(style.core, 0.03));
  shellGrad.addColorStop(0.6, rgba(style.core, 0.1));
  shellGrad.addColorStop(1, rgba(style.core, 0.3));
  ctx.fillStyle = shellGrad;
  ctx.beginPath();
  ctx.arc(bx, by, br, 0, TAU);
  ctx.fill();
  // Soft edge ring
  ctx.beginPath();
  ctx.arc(bx, by, br, 0, TAU);
  ctx.strokeStyle = rgba(style.glow, 0.3 + edgePulse * 0.15);
  ctx.lineWidth = 1.0;
  ctx.stroke();
  ctx.restore();

  // Single large swirling plasma mass
  const angle = time * 1.8 + ball.queueSlot * 2.0;
  const dist = br * 0.2;
  const blobX = bx + Math.cos(angle) * dist;
  const blobY = by + Math.sin(angle) * dist;
  const blobR = br * 0.5;

  // Blob smear trail
  for (let j = 1; j <= 3; j++) {
    const ta = angle - j * 0.3;
    const tx = bx + Math.cos(ta) * dist;
    const ty = by + Math.sin(ta) * dist;
    const trailR = blobR * (1 - j * 0.2);
    const tg = ctx.createRadialGradient(tx, ty, 0, tx, ty, trailR);
    tg.addColorStop(0, rgba(style.core, 0.12 * (1 - j * 0.25)));
    tg.addColorStop(1, rgba(style.core, 0));
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.arc(tx, ty, trailR, 0, TAU);
    ctx.fill();
  }

  // Plasma blob — smooth gradient
  const bg = ctx.createRadialGradient(blobX, blobY, 0, blobX, blobY, blobR);
  bg.addColorStop(0, rgba('#ffffff', 0.75));
  bg.addColorStop(0.5, rgba(lighten(style.core, 0.5), 0.5));
  bg.addColorStop(0.7, rgba(style.core, 0.2));
  bg.addColorStop(1, rgba(style.core, 0));
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(blobX, blobY, blobR, 0, TAU);
  ctx.fill();

  // Center glow
  const cg = ctx.createRadialGradient(bx, by, 0, bx, by, br * 0.6);
  cg.addColorStop(0, rgba('#ffffff', 0.35));
  cg.addColorStop(0.35, rgba(style.glow, 0.25));
  cg.addColorStop(1, rgba(style.glow, 0));
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(bx, by, br * 0.6, 0, TAU);
  ctx.fill();
}

function drawExplosiveBall(ball: Ball, time: number): void {
  const TAU = Math.PI * 2;
  const bx = ball.pos.x;
  const by = ball.pos.y;
  const br = ball.radius;

  // Body throbs with energy buildup
  const throb = Math.sin(time * 6) * 0.05;
  const drawR = br * (1 + throb);

  // Hot ripple trail — concentric fading rings at trail positions
  const samples = Math.min(ball.trail.length, 5);
  const step = ball.trail.length > samples ? ball.trail.length / samples : 1;
  for (let i = 0; i < samples; i++) {
    const idx = Math.floor(i * step);
    const t = ball.trail[idx];
    if (!t) continue;
    const p = i / Math.max(1, samples - 1);
    const a = (1 - p) * 0.3;
    const r = br * (0.5 + p * 0.8);
    ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, TAU);
    ctx.strokeStyle = rgba('#ff6633', a);
    ctx.lineWidth = 1.0 - p * 0.5;
    ctx.stroke();
    // Hot center dot
    const dotR = Math.max(0.5, br * (0.35 - p * 0.2));
    const dg = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, dotR);
    dg.addColorStop(0, rgba('#ffcc44', a * 0.7));
    dg.addColorStop(1, rgba('#ff6600', 0));
    ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(t.x, t.y, dotR, 0, TAU); ctx.fill();
  }

  // Warm glow halo
  const glowR = drawR * 3.0;
  const hg = ctx.createRadialGradient(bx, by, drawR * 0.3, bx, by, glowR);
  hg.addColorStop(0, rgba('#ff8833', 0.25));
  hg.addColorStop(0.4, rgba('#ff4400', 0.08));
  hg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(bx, by, glowR, 0, TAU); ctx.fill();

  // Concentric energy rings pulsing outward
  for (let i = 0; i < 3; i++) {
    const ringPhase = (time * 3 + i * 1.2) % 3.0;
    const ringProgress = ringPhase / 3.0;
    const ringR = drawR * (1.0 + ringProgress * 1.5);
    const ringAlpha = (1 - ringProgress) * 0.35;
    ctx.beginPath(); ctx.arc(bx, by, ringR, 0, TAU);
    ctx.strokeStyle = rgba('#ff7744', ringAlpha);
    ctx.lineWidth = 1.5 * (1 - ringProgress);
    ctx.stroke();
  }

  // Orange-red body with bright white center
  ctx.save();
  ctx.globalAlpha = ball.returning ? 0.86 : 1;
  const sg = ctx.createRadialGradient(bx, by, 0, bx, by, drawR);
  sg.addColorStop(0, '#ffffff');
  sg.addColorStop(0.2, '#ffee88');
  sg.addColorStop(0.45, '#ff8833');
  sg.addColorStop(0.75, '#cc3311');
  sg.addColorStop(1, '#881100');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(bx, by, drawR, 0, TAU); ctx.fill();

  // Inner energy pulse overlay
  const pulseAlpha = 0.15 + Math.sin(time * 6) * 0.1;
  const ig = ctx.createRadialGradient(bx, by, 0, bx, by, drawR * 0.6);
  ig.addColorStop(0, rgba('#ffffff', pulseAlpha));
  ig.addColorStop(1, rgba('#ff6600', 0));
  ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(bx, by, drawR * 0.6, 0, TAU); ctx.fill();

  // Rim
  ctx.beginPath(); ctx.arc(bx, by, drawR, 0, TAU);
  ctx.strokeStyle = rgba('#ff4400', 0.3); ctx.lineWidth = 0.7; ctx.stroke();
  ctx.restore();
}

function drawLaserBall(ball: Ball, time: number): void {
  const TAU = Math.PI * 2;
  const bx = ball.pos.x;
  const by = ball.pos.y;
  const br = ball.radius;

  // Plasma grenade style adapted to purple/laser colors
  const coreColor = '#b388ff';
  const glowColor = '#7c4dff';

  // Body throbs with energy buildup
  const throb = Math.sin(time * 6) * 0.05;
  const drawR = br * (1 + throb);

  // Hot ripple trail — concentric fading rings at trail positions
  const samples = Math.min(ball.trail.length, 5);
  const step = ball.trail.length > samples ? ball.trail.length / samples : 1;
  for (let i = 0; i < samples; i++) {
    const idx = Math.floor(i * step);
    const t = ball.trail[idx];
    if (!t) continue;
    const p = i / Math.max(1, samples - 1);
    const a = (1 - p) * 0.3;
    const r = br * (0.5 + p * 0.8);
    ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, TAU);
    ctx.strokeStyle = rgba('#9966ff', a);
    ctx.lineWidth = 1.0 - p * 0.5;
    ctx.stroke();
    // Hot center dot
    const dotR = Math.max(0.5, br * (0.35 - p * 0.2));
    const dg = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, dotR);
    dg.addColorStop(0, rgba('#ddbbff', a * 0.7));
    dg.addColorStop(1, rgba(glowColor, 0));
    ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(t.x, t.y, dotR, 0, TAU); ctx.fill();
  }

  // Purple glow halo
  const glowR = drawR * 3.0;
  const hg = ctx.createRadialGradient(bx, by, drawR * 0.3, bx, by, glowR);
  hg.addColorStop(0, rgba(coreColor, 0.25));
  hg.addColorStop(0.4, rgba(glowColor, 0.08));
  hg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(bx, by, glowR, 0, TAU); ctx.fill();

  // Concentric energy rings pulsing outward
  for (let i = 0; i < 3; i++) {
    const ringPhase = (time * 3 + i * 1.2) % 3.0;
    const ringProgress = ringPhase / 3.0;
    const ringR = drawR * (1.0 + ringProgress * 1.5);
    const ringAlpha = (1 - ringProgress) * 0.35;
    ctx.beginPath(); ctx.arc(bx, by, ringR, 0, TAU);
    ctx.strokeStyle = rgba('#9966ff', ringAlpha);
    ctx.lineWidth = 1.5 * (1 - ringProgress);
    ctx.stroke();
  }

  // Purple-white body with bright white center
  ctx.save();
  ctx.globalAlpha = ball.returning ? 0.86 : 1;
  const sg = ctx.createRadialGradient(bx, by, 0, bx, by, drawR);
  sg.addColorStop(0, '#ffffff');
  sg.addColorStop(0.2, '#e0ccff');
  sg.addColorStop(0.45, coreColor);
  sg.addColorStop(0.75, glowColor);
  sg.addColorStop(1, '#3311aa');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(bx, by, drawR, 0, TAU); ctx.fill();

  // Inner energy pulse overlay
  const pulseAlpha = 0.15 + Math.sin(time * 6) * 0.1;
  const ig = ctx.createRadialGradient(bx, by, 0, bx, by, drawR * 0.6);
  ig.addColorStop(0, rgba('#ffffff', pulseAlpha));
  ig.addColorStop(1, rgba(glowColor, 0));
  ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(bx, by, drawR * 0.6, 0, TAU); ctx.fill();

  // Rim
  ctx.beginPath(); ctx.arc(bx, by, drawR, 0, TAU);
  ctx.strokeStyle = rgba(glowColor, 0.3); ctx.lineWidth = 0.7; ctx.stroke();
  ctx.restore();
}

function drawBleedBall(ball: Ball, time: number): void {
  const TAU = Math.PI * 2;
  const style = activeTheme.ball.bleed;
  const bx = ball.pos.x, by = ball.pos.y, br = ball.radius;

  // Dripping dot trail
  const samples = Math.min(ball.trail.length, 6);
  const step = ball.trail.length > samples ? ball.trail.length / samples : 1;
  for (let i = 0; i < samples; i++) {
    const idx = Math.floor(i * step);
    const t = ball.trail[idx];
    if (!t) continue;
    const p = i / Math.max(1, samples - 1);
    const a = (1 - p) * style.trailAlpha;
    const r = Math.max(0.5, br * (0.7 - p * 0.4));
    // Drip offset downward
    const dripY = t.y + p * 3;
    const tg = ctx.createRadialGradient(t.x, dripY, 0, t.x, dripY, r);
    tg.addColorStop(0, rgba(style.core, a * 0.9));
    tg.addColorStop(1, rgba(style.core, 0));
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.arc(t.x, dripY, r, 0, TAU); ctx.fill();
  }

  // Red glow halo
  const glowR = br * 2.5;
  const gg = ctx.createRadialGradient(bx, by, br * 0.2, bx, by, glowR);
  gg.addColorStop(0, rgba(style.glow, 0.3));
  gg.addColorStop(0.5, rgba(style.glow, 0.08));
  gg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gg;
  ctx.beginPath(); ctx.arc(bx, by, glowR, 0, TAU); ctx.fill();

  // Deep red spherical body
  ctx.save();
  ctx.globalAlpha = ball.returning ? 0.86 : 1;
  const offX = -br * 0.3, offY = -br * 0.3;
  const sg = ctx.createRadialGradient(bx + offX, by + offY, br * 0.05, bx, by, br);
  sg.addColorStop(0, '#ff6677');
  sg.addColorStop(0.3, '#cc2244');
  sg.addColorStop(0.7, '#881133');
  sg.addColorStop(1, '#440011');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();

  // Pulsing red border
  const pulse = 0.3 + Math.sin(time * 5 + ball.queueSlot) * 0.15;
  ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU);
  ctx.strokeStyle = rgba(style.glow, pulse);
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Specular
  const spec = ctx.createRadialGradient(bx + offX * 0.5, by + offY * 0.5, 0, bx + offX * 0.5, by + offY * 0.5, br * 0.3);
  spec.addColorStop(0, 'rgba(255,255,255,0.6)');
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spec;
  ctx.beginPath(); ctx.arc(bx + offX * 0.5, by + offY * 0.5, br * 0.3, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawBurnBall(ball: Ball, time: number): void {
  const TAU = Math.PI * 2;
  const style = activeTheme.ball.burn;
  const bx = ball.pos.x, by = ball.pos.y, br = ball.radius;

  // Ember trail
  const samples = Math.min(ball.trail.length, 6);
  const step = ball.trail.length > samples ? ball.trail.length / samples : 1;
  for (let i = 0; i < samples; i++) {
    const idx = Math.floor(i * step);
    const t = ball.trail[idx];
    if (!t) continue;
    const p = i / Math.max(1, samples - 1);
    const a = (1 - p) * style.trailAlpha;
    const sz = Math.max(0.5, br * (0.6 - p * 0.35));
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(time * 6 + i * 1.2);
    ctx.globalAlpha = a;
    ctx.fillStyle = i < 3 ? '#ffcc00' : '#ff6600';
    ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
    ctx.restore();
  }

  // Warm glow
  const glowR = br * 2.8;
  const gg = ctx.createRadialGradient(bx, by, br * 0.2, bx, by, glowR);
  gg.addColorStop(0, rgba('#ffcc00', 0.3));
  gg.addColorStop(0.4, rgba(style.core, 0.1));
  gg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gg;
  ctx.beginPath(); ctx.arc(bx, by, glowR, 0, TAU); ctx.fill();

  // Flame wisps orbiting
  for (let i = 0; i < 4; i++) {
    const angle = time * 4.5 + i * TAU / 4 + ball.queueSlot;
    const dist = br * 1.2;
    const wx = bx + Math.cos(angle) * dist;
    const wy = by + Math.sin(angle) * dist;
    const wr = br * 0.3;
    const wg = ctx.createRadialGradient(wx, wy, 0, wx, wy, wr);
    wg.addColorStop(0, rgba('#ffcc00', 0.5));
    wg.addColorStop(1, rgba('#ff6600', 0));
    ctx.fillStyle = wg;
    ctx.beginPath(); ctx.arc(wx, wy, wr, 0, TAU); ctx.fill();
  }

  // Flickering orange body
  const flicker = 1 + Math.sin(time * 12 + ball.queueSlot) * 0.04;
  const drawR = br * flicker;
  ctx.save();
  ctx.globalAlpha = ball.returning ? 0.86 : 1;
  const sg = ctx.createRadialGradient(bx, by, 0, bx, by, drawR);
  sg.addColorStop(0, '#ffffcc');
  sg.addColorStop(0.25, '#ffcc00');
  sg.addColorStop(0.6, '#ff8800');
  sg.addColorStop(1, '#cc3300');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(bx, by, drawR, 0, TAU); ctx.fill();

  // Rim
  ctx.beginPath(); ctx.arc(bx, by, drawR, 0, TAU);
  ctx.strokeStyle = rgba('#ff6600', 0.3);
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.restore();
}

function drawPoisonBall(ball: Ball, time: number): void {
  const TAU = Math.PI * 2;
  const style = activeTheme.ball.poison;
  const bx = ball.pos.x, by = ball.pos.y, br = ball.radius;

  // Drip trail
  const samples = Math.min(ball.trail.length, 6);
  const step = ball.trail.length > samples ? ball.trail.length / samples : 1;
  for (let i = 0; i < samples; i++) {
    const idx = Math.floor(i * step);
    const t = ball.trail[idx];
    if (!t) continue;
    const p = i / Math.max(1, samples - 1);
    const a = (1 - p) * style.trailAlpha;
    const r = Math.max(0.5, br * (0.6 - p * 0.35));
    const dripY = t.y + p * 2.5;
    const tg = ctx.createRadialGradient(t.x, dripY, 0, t.x, dripY, r);
    tg.addColorStop(0, rgba(style.core, a * 0.8));
    tg.addColorStop(1, rgba(style.core, 0));
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.arc(t.x, dripY, r, 0, TAU); ctx.fill();
  }

  // Green glow
  const glowR = br * 2.5;
  const gg = ctx.createRadialGradient(bx, by, br * 0.2, bx, by, glowR);
  gg.addColorStop(0, rgba(style.glow, 0.25));
  gg.addColorStop(0.5, rgba(style.glow, 0.06));
  gg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gg;
  ctx.beginPath(); ctx.arc(bx, by, glowR, 0, TAU); ctx.fill();

  // Bubbling green body
  ctx.save();
  ctx.globalAlpha = ball.returning ? 0.86 : 1;
  const offX = -br * 0.3, offY = -br * 0.3;
  const sg = ctx.createRadialGradient(bx + offX, by + offY, br * 0.05, bx, by, br);
  sg.addColorStop(0, '#88ff88');
  sg.addColorStop(0.3, '#44cc44');
  sg.addColorStop(0.7, '#228822');
  sg.addColorStop(1, '#114411');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();

  // Surface bubbles
  for (let i = 0; i < 3; i++) {
    const ba = time * 2.5 + i * TAU / 3 + ball.queueSlot;
    const bd = br * 0.45;
    const bbx = bx + Math.cos(ba) * bd;
    const bby = by + Math.sin(ba) * bd;
    const bbr = br * 0.15 + Math.sin(time * 4 + i * 2) * br * 0.05;
    ctx.beginPath(); ctx.arc(bbx, bby, bbr, 0, TAU);
    ctx.fillStyle = rgba('#ccffcc', 0.4);
    ctx.fill();
  }

  // Rim
  ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU);
  ctx.strokeStyle = rgba(style.glow, 0.3);
  ctx.lineWidth = 0.6;
  ctx.stroke();

  // Specular
  const spec = ctx.createRadialGradient(bx + offX * 0.5, by + offY * 0.5, 0, bx + offX * 0.5, by + offY * 0.5, br * 0.3);
  spec.addColorStop(0, 'rgba(255,255,255,0.5)');
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spec;
  ctx.beginPath(); ctx.arc(bx + offX * 0.5, by + offY * 0.5, br * 0.3, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawLightningBall(ball: Ball, time: number): void {
  const TAU = Math.PI * 2;
  const style = activeTheme.ball.lightning;
  const bx = ball.pos.x, by = ball.pos.y, br = ball.radius;

  // Spark trail
  const samples = Math.min(ball.trail.length, 6);
  const step = ball.trail.length > samples ? ball.trail.length / samples : 1;
  for (let i = 0; i < samples; i++) {
    const idx = Math.floor(i * step);
    const t = ball.trail[idx];
    if (!t) continue;
    const p = i / Math.max(1, samples - 1);
    const a = (1 - p) * style.trailAlpha;
    // Tiny sparks
    const sx = t.x + Math.sin(time * 10 + i * 3.7) * 2;
    const sy = t.y + Math.cos(time * 9 + i * 2.9) * 2;
    ctx.beginPath(); ctx.arc(sx, sy, 1.0, 0, TAU);
    ctx.fillStyle = rgba('#ffffff', a * 0.7);
    ctx.fill();
    // Faint glow dot
    const tg = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, br * (0.5 - p * 0.3));
    tg.addColorStop(0, rgba(style.glow, a * 0.4));
    tg.addColorStop(1, rgba(style.glow, 0));
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.arc(t.x, t.y, br * (0.5 - p * 0.3), 0, TAU); ctx.fill();
  }

  // Blue-white glow
  const glowR = br * 2.8;
  const gg = ctx.createRadialGradient(bx, by, br * 0.2, bx, by, glowR);
  gg.addColorStop(0, rgba('#ffffff', 0.2));
  gg.addColorStop(0.3, rgba(style.glow, 0.15));
  gg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gg;
  ctx.beginPath(); ctx.arc(bx, by, glowR, 0, TAU); ctx.fill();

  // Bright white-blue body
  ctx.save();
  ctx.globalAlpha = ball.returning ? 0.86 : 1;
  const sg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
  sg.addColorStop(0, '#ffffff');
  sg.addColorStop(0.3, '#ccecff');
  sg.addColorStop(0.6, style.core);
  sg.addColorStop(1, darken(style.core, 0.4));
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();

  // Small arcs off surface
  for (let i = 0; i < 4; i++) {
    const arcVisible = Math.sin(time * 12 + i * 4.1) > 0.3;
    if (!arcVisible) continue;
    const a1 = time * 6 + i * TAU / 4;
    const a2 = a1 + 0.6;
    ctx.beginPath();
    ctx.arc(bx, by, br * 1.15, a1, a2);
    ctx.strokeStyle = rgba('#ffffff', 0.5);
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // Rim
  ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU);
  ctx.strokeStyle = rgba(style.glow, 0.3);
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.restore();
}

function drawFreezeBall(ball: Ball, time: number): void {
  const TAU = Math.PI * 2;
  const style = activeTheme.ball.freeze;
  const bx = ball.pos.x, by = ball.pos.y, br = ball.radius;

  // Snowflake/crystal trail
  const samples = Math.min(ball.trail.length, 6);
  const step = ball.trail.length > samples ? ball.trail.length / samples : 1;
  for (let i = 0; i < samples; i++) {
    const idx = Math.floor(i * step);
    const t = ball.trail[idx];
    if (!t) continue;
    const p = i / Math.max(1, samples - 1);
    const a = (1 - p) * style.trailAlpha;
    const r = Math.max(0.5, br * (0.5 - p * 0.3));
    const tg = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, r * 1.3);
    tg.addColorStop(0, rgba('#ffffff', a * 0.5));
    tg.addColorStop(0.4, rgba(style.core, a * 0.3));
    tg.addColorStop(1, rgba(style.core, 0));
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.arc(t.x, t.y, r * 1.3, 0, TAU); ctx.fill();
  }

  // Cool blue glow
  const glowR = br * 2.5;
  const gg = ctx.createRadialGradient(bx, by, br * 0.2, bx, by, glowR);
  gg.addColorStop(0, rgba(style.glow, 0.2));
  gg.addColorStop(0.5, rgba(style.core, 0.06));
  gg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gg;
  ctx.beginPath(); ctx.arc(bx, by, glowR, 0, TAU); ctx.fill();

  // Icy white-cyan body
  ctx.save();
  ctx.globalAlpha = ball.returning ? 0.86 : 1;
  const offX = -br * 0.3, offY = -br * 0.3;
  const sg = ctx.createRadialGradient(bx + offX, by + offY, br * 0.05, bx, by, br);
  sg.addColorStop(0, '#ffffff');
  sg.addColorStop(0.3, '#ddf4ff');
  sg.addColorStop(0.6, '#aaeeff');
  sg.addColorStop(1, '#5599cc');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();

  // Crystalline highlights — star facets
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(time * 0.4);
  for (let i = 0; i < 6; i++) {
    const angle = i * TAU / 6;
    const len = br * 0.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
    ctx.strokeStyle = rgba('#ffffff', 0.2);
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  ctx.restore();

  // Rim
  ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU);
  ctx.strokeStyle = rgba('#ffffff', 0.3);
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Specular
  const spec = ctx.createRadialGradient(bx + offX * 0.5, by + offY * 0.5, 0, bx + offX * 0.5, by + offY * 0.5, br * 0.35);
  spec.addColorStop(0, 'rgba(255,255,255,0.8)');
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spec;
  ctx.beginPath(); ctx.arc(bx + offX * 0.5, by + offY * 0.5, br * 0.35, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawLightningArcs(arcs: LightningArc[]): void {
  for (const arc of arcs) {
    const t = arc.life / arc.maxLife; // 1 → 0
    const alpha = t * 0.8;

    // Jagged line from (x1,y1) to (x2,y2) with midpoint offsets
    const mx = (arc.x1 + arc.x2) / 2;
    const my = (arc.y1 + arc.y2) / 2;
    const dx = arc.x2 - arc.x1;
    const dy = arc.y2 - arc.y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / len;
    const ny = dx / len;
    const segments = 4;
    const points: { x: number; y: number }[] = [{ x: arc.x1, y: arc.y1 }];
    for (let i = 1; i < segments; i++) {
      const frac = i / segments;
      const bx = arc.x1 + dx * frac;
      const by = arc.y1 + dy * frac;
      const jitter = (Math.random() - 0.5) * len * 0.15;
      points.push({ x: bx + nx * jitter, y: by + ny * jitter });
    }
    points.push({ x: arc.x2, y: arc.y2 });

    // Outer glow
    ctx.save();
    ctx.strokeStyle = rgba('#88ddff', alpha * 0.3);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // Core line
    ctx.strokeStyle = rgba('#ffffff', alpha * 0.9);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function drawLaserBeams(beams: LaserBeam[]): void {
  const TAU = Math.PI * 2;
  for (const beam of beams) {
    const t = beam.life / beam.maxLife; // 1 → 0
    const alpha = t * 0.8;
    const width = 4 + t * 8; // beam starts wide, narrows as it fades

    ctx.save();
    if (beam.dir === 'v') {
      // Vertical beam — full height
      // Outer glow
      const gg = ctx.createLinearGradient(beam.x - width * 2, 0, beam.x + width * 2, 0);
      gg.addColorStop(0, 'rgba(0,0,0,0)');
      gg.addColorStop(0.3, rgba('#b388ff', alpha * 0.15));
      gg.addColorStop(0.5, rgba('#b388ff', alpha * 0.3));
      gg.addColorStop(0.7, rgba('#b388ff', alpha * 0.15));
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(beam.x - width * 2, 0, width * 4, WORLD_H);

      // Core beam
      const cg = ctx.createLinearGradient(beam.x - width * 0.5, 0, beam.x + width * 0.5, 0);
      cg.addColorStop(0, rgba('#7c4dff', 0));
      cg.addColorStop(0.3, rgba('#e0ccff', alpha * 0.6));
      cg.addColorStop(0.5, rgba('#ffffff', alpha * 0.9));
      cg.addColorStop(0.7, rgba('#e0ccff', alpha * 0.6));
      cg.addColorStop(1, rgba('#7c4dff', 0));
      ctx.fillStyle = cg;
      ctx.fillRect(beam.x - width * 0.5, 0, width, WORLD_H);
    } else {
      // Horizontal beam — full width
      const gg = ctx.createLinearGradient(0, beam.y - width * 2, 0, beam.y + width * 2);
      gg.addColorStop(0, 'rgba(0,0,0,0)');
      gg.addColorStop(0.3, rgba('#b388ff', alpha * 0.15));
      gg.addColorStop(0.5, rgba('#b388ff', alpha * 0.3));
      gg.addColorStop(0.7, rgba('#b388ff', alpha * 0.15));
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(0, beam.y - width * 2, WORLD_W, width * 4);

      // Core beam
      const cg = ctx.createLinearGradient(0, beam.y - width * 0.5, 0, beam.y + width * 0.5);
      cg.addColorStop(0, rgba('#7c4dff', 0));
      cg.addColorStop(0.3, rgba('#e0ccff', alpha * 0.6));
      cg.addColorStop(0.5, rgba('#ffffff', alpha * 0.9));
      cg.addColorStop(0.7, rgba('#e0ccff', alpha * 0.6));
      cg.addColorStop(1, rgba('#7c4dff', 0));
      ctx.fillStyle = cg;
      ctx.fillRect(0, beam.y - width * 0.5, WORLD_W, width);
    }
    ctx.restore();
  }
}

function drawParticle(p: Particle): void {
  if (p.life <= 0) return;

  const lifeRatio = p.life / p.maxLife;
  const alpha = lifeRatio < 0.35 ? lifeRatio / 0.35 : 1;
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Ember glow — color-matched shadowBlur
  ctx.shadowColor = p.color;
  ctx.shadowBlur = 6 + (1 - lifeRatio) * 4; // glow intensifies as particle fades

  if (p.shape === 'ring') {
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (p.shape === 'triangle') {
    ctx.translate(p.pos.x, p.pos.y);
    if (p.rotation !== undefined) ctx.rotate(p.rotation);
    const r = p.radius;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(-r * 0.866, r * 0.5);
    ctx.lineTo(r * 0.866, r * 0.5);
    ctx.closePath();
    ctx.fillStyle = p.color;
    ctx.fill();
  } else if (p.shape === 'square') {
    ctx.translate(p.pos.x, p.pos.y);
    if (p.rotation !== undefined) ctx.rotate(p.rotation);
    const r = p.radius;
    ctx.fillStyle = p.color;
    ctx.fillRect(-r, -r, r * 2, r * 2);
  } else {
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  }

  ctx.restore();
}

function drawGem(gem: Gem, time: number): void {
  if (!gem.alive) return;

  const r = gem.radius;
  const bobY = gem.pos.y + Math.sin(time * activeTheme.motion.gemBobFreq + gem.pos.x * 0.05) * activeTheme.motion.gemBobAmp;

  ctx.save();
  ctx.translate(gem.pos.x, bobY);

  // Stronger glow halo with sine pulse
  const glowR = r * 3;
  const glowAlpha = 0.35 + Math.sin(time * 2.5) * 0.08;
  const glowGrad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, glowR);
  glowGrad.addColorStop(0, rgba(activeTheme.colors.gemGlow, glowAlpha));
  glowGrad.addColorStop(0.4, rgba(activeTheme.colors.gemGlow, glowAlpha * 0.3));
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(0, 0, glowR, 0, Math.PI * 2);
  ctx.fill();

  // 4-triangle facets with inner gradients
  const gemBase = activeTheme.colors.gem;
  const topColor = lighten(gemBase, 0.45);
  const leftColor = lighten(gemBase, 0.15);
  const rightColor = darken(gemBase, 0.05);
  const bottomColor = darken(gemBase, 0.25);

  // Top-right facet
  ctx.beginPath();
  ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, 0);
  ctx.closePath();
  const trGrad = ctx.createLinearGradient(0, -r, r * 0.5, 0);
  trGrad.addColorStop(0, topColor);
  trGrad.addColorStop(1, lighten(gemBase, 0.25));
  ctx.fillStyle = trGrad;
  ctx.fill();

  // Top-left facet
  ctx.beginPath();
  ctx.moveTo(0, -r); ctx.lineTo(-r, 0); ctx.lineTo(0, 0);
  ctx.closePath();
  const tlGrad = ctx.createLinearGradient(0, -r, -r * 0.5, 0);
  tlGrad.addColorStop(0, lighten(gemBase, 0.3));
  tlGrad.addColorStop(1, leftColor);
  ctx.fillStyle = tlGrad;
  ctx.fill();

  // Bottom-right facet
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fillStyle = rightColor;
  ctx.fill();

  // Bottom-left facet
  ctx.beginPath();
  ctx.moveTo(-r, 0); ctx.lineTo(0, r); ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fillStyle = bottomColor;
  ctx.fill();

  // Diamond outline
  ctx.beginPath();
  ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0);
  ctx.closePath();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 0.7;
  ctx.stroke();

  // Center cross seam
  ctx.beginPath();
  ctx.moveTo(0, -r); ctx.lineTo(0, r);
  ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Star sparkle rays — cross pattern
  const sparkAlpha = 0.4 + Math.sin(time * 5) * 0.35;
  ctx.save();
  ctx.globalAlpha = sparkAlpha;
  ctx.rotate(time * 0.8);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.8;
  const rayLen = r * 0.7;
  for (let a = 0; a < 4; a++) {
    const angle = (a * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * rayLen, Math.sin(angle) * rayLen);
    ctx.stroke();
  }
  ctx.restore();

  ctx.restore();
}

function drawDamageNumber(dn: DamageNumber): void {
  if (dn.life <= 0) return;
  const progress = 1 - dn.life / dn.maxLife;

  const fadeStart = 0.56;
  const alpha = progress > fadeStart ? 1 - (progress - fadeStart) / (1 - fadeStart) : 1;

  // Scale pop: 1.6 → 1.0 over first 20% of life (ease-out)
  let sc = 1;
  if (progress < 0.2) {
    const t = progress / 0.2;
    sc = 1.6 - 0.6 * (1 - (1 - t) * (1 - t));
  }

  // Color by value (or custom override for DoTs)
  let color = '#ffffff';
  let glowColor = 'rgba(255,255,255,0.5)';
  if (dn.color) {
    color = dn.color;
    glowColor = dn.glowColor || dn.color;
  } else if (dn.value >= 50) { color = '#ff8844'; glowColor = 'rgba(255,136,68,0.6)'; }
  else if (dn.value >= 20) { color = '#ffdd44'; glowColor = 'rgba(255,221,68,0.5)'; }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(dn.pos.x, dn.pos.y);
  ctx.scale(sc, sc);
  ctx.font = `800 14px ${activeTheme.fonts.numeric}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 4;
  // Dark outline
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2.5;
  ctx.strokeText(`${dn.value}`, 0, 0);
  ctx.fillStyle = color;
  ctx.fillText(`${dn.value}`, 0, 0);
  ctx.restore();
}

function drawAimLine(game: Game): void {
  if (game.state !== 'PLAYING') return;

  const px = game.playerPos.x;
  const py = game.playerPos.y;
  const aimX = game.input.aimPos.x - px;
  const aimY = game.input.aimPos.y - py;
  const len = Math.hypot(aimX, aimY);
  if (len < 0.001) return;

  let dx = aimX / len;
  let dy = aimY / len;
  if (dy > -0.08) {
    const ny = -0.08;
    const norm = Math.hypot(dx, ny);
    dx /= norm;
    dy = ny / norm;
  }

  const leftBound = GRID_LEFT;
  const rightBound = GRID_LEFT + GRID_COLS * CELL_SIZE;
  const topBound = 0;

  const maxSegments = 3;
  const points: { x: number; y: number; bounced: boolean }[] = [{ x: px, y: py, bounced: false }];

  let cx = px;
  let cy = py;

  for (let bounce = 0; bounce < maxSegments; bounce++) {
    let tMin = 1000;
    let hitWall = false;
    let hitEnemy = false;

    if (dx < 0) {
      const t = (leftBound - cx) / dx;
      if (t > 0.01 && t < tMin) { tMin = t; hitWall = true; hitEnemy = false; }
    }
    if (dx > 0) {
      const t = (rightBound - cx) / dx;
      if (t > 0.01 && t < tMin) { tMin = t; hitWall = true; hitEnemy = false; }
    }
    if (dy < 0) {
      const t = (topBound - cy) / dy;
      if (t > 0.01 && t < tMin) { tMin = t; hitWall = false; hitEnemy = false; }
    }

    for (const e of game.enemies) {
      if (!e.alive) continue;
      const ex = e.pos.x;
      const ey = e.pos.y;
      const ex2 = ex + e.width;
      const ey2 = ey + e.height;

      let tNear = -Infinity;
      let tFar = Infinity;

      if (dx !== 0) {
        let t1 = (ex - cx) / dx;
        let t2 = (ex2 - cx) / dx;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tNear = Math.max(tNear, t1);
        tFar = Math.min(tFar, t2);
      } else if (cx < ex || cx > ex2) {
        continue;
      }

      if (dy !== 0) {
        let t1 = (ey - cy) / dy;
        let t2 = (ey2 - cy) / dy;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tNear = Math.max(tNear, t1);
        tFar = Math.min(tFar, t2);
      } else if (cy < ey || cy > ey2) {
        continue;
      }

      if (tNear <= tFar && tFar > 0.01 && tNear < tMin) {
        const tHit = tNear > 0.01 ? tNear : tFar;
        if (tHit > 0.01 && tHit < tMin) {
          tMin = tHit;
          hitWall = false;
          hitEnemy = true;
        }
      }
    }

    const maxLen = 420;
    if (tMin > maxLen) tMin = maxLen;

    const nx = cx + dx * tMin;
    const ny = cy + dy * tMin;
    points.push({ x: nx, y: ny, bounced: hitWall && ny > topBound + 0.2 });

    if (hitEnemy) break;
    if (ny <= topBound + 0.2) break;
    if (!hitWall) break;

    dx = -dx;
    cx = nx;
    cy = ny;
  }

  // Dashed line with glow
  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.5;

  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    const segmentAlpha = 0.5 - i * 0.18;

    // Faint glow underline
    ctx.strokeStyle = rgba(activeTheme.colors.aimLine, segmentAlpha * 0.3);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    // Crisp line
    ctx.strokeStyle = rgba(activeTheme.colors.aimLine, segmentAlpha);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Tip dot with glow
  const tip = points[points.length - 1];
  const tipGrad = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 6);
  tipGrad.addColorStop(0, rgba(activeTheme.colors.aimLine, 0.4));
  tipGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = tipGrad;
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = rgba(activeTheme.colors.aimLine, 0.6);
  ctx.fill();

  ctx.restore();
}

function drawGlassPanel(x: number, y: number, w: number, h: number, r: number): void {
  // Glass panel: dark fill + top highlight edge + subtle border
  const panelGrad = ctx.createLinearGradient(x, y, x, y + h);
  panelGrad.addColorStop(0, 'rgba(30,30,60,0.65)');
  panelGrad.addColorStop(1, 'rgba(10,10,25,0.55)');
  roundRect(x, y, w, h, r);
  ctx.fillStyle = panelGrad;
  ctx.fill();

  // Top edge highlight
  ctx.save();
  roundRect(x, y, w, h, r);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(x, y, w, 1);
  ctx.restore();

  // Border
  roundRect(x, y, w, h, r);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

function drawHUD(game: Game): void {
  const padX = 12;
  const padY = 10;

  // ── Score — top center, prominent ──
  const scoreText = `${game.score}`;
  ctx.font = `800 20px ${activeTheme.fonts.numeric}`;
  const scoreMetrics = ctx.measureText(scoreText);
  const scorePanelW = Math.max(76, scoreMetrics.width + 32);
  const scorePanelH = 38;
  const scorePanelX = (WORLD_W - scorePanelW) / 2;
  const scorePanelY = padY;

  drawGlassPanel(scorePanelX, scorePanelY, scorePanelW, scorePanelH, 10);

  // Score label
  ctx.font = `700 8px ${activeTheme.fonts.ui}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('SCORE', WORLD_W / 2, scorePanelY + 5);

  // Score value
  ctx.font = `800 18px ${activeTheme.fonts.numeric}`;
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = activeTheme.colors.hudText;
  ctx.fillText(scoreText, WORLD_W / 2, scorePanelY + scorePanelH - 5);

  // ── HP bar — bottom left, wider with heart icon ──
  const hpPanelW = 130;
  const hpPanelH = 26;
  const hpPanelX = padX;
  const hpPanelY = WORLD_H - 50;

  drawGlassPanel(hpPanelX, hpPanelY, hpPanelW, hpPanelH, 7);

  // Heart icon
  const heartX = hpPanelX + 14;
  const heartY = hpPanelY + hpPanelH / 2;
  const isLow = game.playerHp / PLAYER_MAX_HP <= 0.4;
  ctx.save();
  ctx.fillStyle = isLow ? '#f47070' : '#ff6b8a';
  ctx.font = `700 12px ${activeTheme.fonts.ui}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('\u2665', heartX, heartY + 0.5);
  ctx.restore();

  // HP count text
  ctx.font = `800 11px ${activeTheme.fonts.numeric}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = activeTheme.colors.hudText;
  ctx.fillText(`${game.playerHp}`, hpPanelX + 24, heartY + 0.5);

  // HP bar
  const barX = hpPanelX + 42;
  const barW = hpPanelW - 50;
  const barH = 8;
  const barY = hpPanelY + (hpPanelH - barH) / 2;
  const hpFrac = clamp(game.playerHp / PLAYER_MAX_HP, 0, 1);

  // Track
  roundRect(barX, barY, barW, barH, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fill();

  if (hpFrac > 0) {
    const fillW = barW * hpFrac;
    roundRect(barX, barY, fillW, barH, 4);
    const hpGrad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
    if (isLow) {
      hpGrad.addColorStop(0, '#f47070');
      hpGrad.addColorStop(1, '#b82020');
    } else {
      hpGrad.addColorStop(0, '#6dd672');
      hpGrad.addColorStop(1, '#2d8a34');
    }
    ctx.fillStyle = hpGrad;
    ctx.fill();

    // Shine
    ctx.save();
    roundRect(barX, barY, fillW, barH, 4);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(barX, barY, fillW, barH / 2);
    ctx.restore();
  }

  // ── Level badge — bottom right, pill shape ──
  const lvText = `LV ${game.level}`;
  ctx.font = `800 11px ${activeTheme.fonts.numeric}`;
  const lvW = ctx.measureText(lvText).width + 18;
  const lvH = 22;
  const lvX = WORLD_W - padX - lvW;
  const lvY = WORLD_H - 50 + 2;

  // Purple pill
  roundRect(lvX, lvY, lvW, lvH, 11);
  const lvGrad = ctx.createLinearGradient(lvX, lvY, lvX, lvY + lvH);
  lvGrad.addColorStop(0, 'rgba(124,77,255,0.5)');
  lvGrad.addColorStop(1, 'rgba(90,48,204,0.4)');
  ctx.fillStyle = lvGrad;
  ctx.fill();
  roundRect(lvX, lvY, lvW, lvH, 11);
  ctx.strokeStyle = 'rgba(124,77,255,0.5)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d4bbff';
  ctx.fillText(lvText, lvX + lvW / 2, lvY + lvH / 2 + 0.5);

  // ── Ball queue — top right, compact visual balls ──
  const totalByType: Record<string, number> = {};
  const inFlightByType: Record<string, number> = {};
  for (const t of game.ballQueue) totalByType[t] = (totalByType[t] || 0) + 1;
  for (const b of game.balls) {
    if (b.active || b.returning) {
      inFlightByType[b.type] = (inFlightByType[b.type] || 0) + 1;
    }
  }

  const rows: { key: string; color: string; glow: string }[] = [
    { key: 'normal', color: activeTheme.ball.normal.core, glow: activeTheme.ball.normal.glow },
    { key: 'spectral', color: activeTheme.ball.spectral.core, glow: activeTheme.ball.spectral.glow },
    { key: 'explosive', color: activeTheme.ball.explosive.core, glow: activeTheme.ball.explosive.glow },
    { key: 'laser', color: activeTheme.ball.laser.core, glow: activeTheme.ball.laser.glow },
    { key: 'bleed', color: activeTheme.ball.bleed.core, glow: activeTheme.ball.bleed.glow },
    { key: 'burn', color: activeTheme.ball.burn.core, glow: activeTheme.ball.burn.glow },
    { key: 'poison', color: activeTheme.ball.poison.core, glow: activeTheme.ball.poison.glow },
    { key: 'lightning', color: activeTheme.ball.lightning.core, glow: activeTheme.ball.lightning.glow },
    { key: 'freeze', color: activeTheme.ball.freeze.core, glow: activeTheme.ball.freeze.glow },
  ];

  // Only show rows that have balls
  const activeRows = rows.filter(r => (totalByType[r.key] || 0) > 0);
  if (activeRows.length > 0) {
    const qPanelW = 58;
    const rowH = 22;
    const qPanelH = 10 + activeRows.length * rowH;
    const qPanelX = WORLD_W - padX - qPanelW;
    const qPanelY = padY;

    drawGlassPanel(qPanelX, qPanelY, qPanelW, qPanelH, 8);

    for (let i = 0; i < activeRows.length; i++) {
      const row = activeRows[i];
      const ry = qPanelY + 5 + i * rowH + rowH / 2;
      const total = totalByType[row.key] || 0;
      const available = Math.max(0, total - (inFlightByType[row.key] || 0));

      // Mini ball with glow
      const ballX = qPanelX + 14;
      const ballR = 4;
      const miniGrad = ctx.createRadialGradient(ballX - 1, ry - 1, 0, ballX, ry, ballR);
      miniGrad.addColorStop(0, '#ffffff');
      miniGrad.addColorStop(0.5, row.color);
      miniGrad.addColorStop(1, darken(row.color === '#ffffff' ? '#aaccff' : row.color, 0.3));
      ctx.beginPath();
      ctx.arc(ballX, ry, ballR, 0, Math.PI * 2);
      ctx.fillStyle = miniGrad;
      ctx.fill();

      // Count
      ctx.font = `800 10px ${activeTheme.fonts.numeric}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = available > 0 ? activeTheme.colors.hudText : 'rgba(255,255,255,0.3)';
      ctx.fillText(`${available}/${total}`, qPanelX + 23, ry + 0.5);
    }
  }
}

function drawXPBar(game: Game): void {
  const barH = 6;
  const barY = WORLD_H - barH;
  const barW = WORLD_W;
  const fraction = clamp(game.xp / game.xpToLevel, 0, 1);

  // Dark track with subtle gradient
  const trackGrad = ctx.createLinearGradient(0, barY, 0, barY + barH);
  trackGrad.addColorStop(0, '#0d0d1a');
  trackGrad.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = trackGrad;
  ctx.fillRect(0, barY, barW, barH);

  // Purple gradient fill with glow
  const fillW = barW * fraction;
  if (fillW > 0) {
    ctx.save();
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = 8;
    const xpGrad = ctx.createLinearGradient(0, barY, 0, barY + barH);
    xpGrad.addColorStop(0, '#c08dff');
    xpGrad.addColorStop(0.4, '#7c4dff');
    xpGrad.addColorStop(1, '#5a30cc');
    ctx.fillStyle = xpGrad;
    ctx.fillRect(0, barY, fillW, barH);
    ctx.restore();

    // Top shine
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, barY, fillW, 1);

    // Bright leading edge
    if (fillW > 2) {
      const edgeGrad = ctx.createLinearGradient(fillW - 4, barY, fillW, barY);
      edgeGrad.addColorStop(0, 'rgba(200,160,255,0)');
      edgeGrad.addColorStop(1, 'rgba(200,160,255,0.4)');
      ctx.fillStyle = edgeGrad;
      ctx.fillRect(fillW - 4, barY, 4, barH);
    }
  }

  // Top border line
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(0, barY, barW, 0.5);
}

function drawCombo(game: Game): void {
  if (game.juice.combo < 2 || game.juice.comboDisplayTimer <= 0) return;

  const timer = game.juice.comboDisplayTimer;
  const alpha = Math.min(1, timer / 0.3);
  const sc = 1 + game.juice.comboPulse * 0.2;

  ctx.save();
  ctx.translate(WORLD_W / 2, WORLD_H * 0.30);
  ctx.scale(sc, sc);
  ctx.globalAlpha = alpha;

  // Combo number — large
  const comboNum = `${game.juice.combo}x`;
  const numSize = 28 + Math.min(12, game.juice.combo * 0.8);
  ctx.font = `900 ${numSize}px ${activeTheme.fonts.display}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Orange glow corona
  ctx.shadowColor = '#ff7733';
  ctx.shadowBlur = 20;

  // Dark outline
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 4;
  ctx.strokeText(comboNum, 0, 0);

  // Gradient fill
  const comboGrad = ctx.createLinearGradient(0, -numSize / 2, 0, numSize / 2);
  comboGrad.addColorStop(0, '#fff8cc');
  comboGrad.addColorStop(0.4, '#ffcc44');
  comboGrad.addColorStop(1, '#ff5500');
  ctx.fillStyle = comboGrad;
  ctx.fillText(comboNum, 0, 0);

  // "COMBO" label below — smaller, clean
  ctx.shadowBlur = 8;
  ctx.font = `800 10px ${activeTheme.fonts.ui}`;
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeText('COMBO', 0, numSize * 0.5 + 6);
  ctx.fillStyle = '#ffcc88';
  ctx.fillText('COMBO', 0, numSize * 0.5 + 6);

  ctx.restore();
}

function drawLevelUp(game: Game): void {
  // Dark overlay with slight gradient
  const overlayGrad = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  overlayGrad.addColorStop(0, 'rgba(5,5,20,0.9)');
  overlayGrad.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = overlayGrad;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Level badge
  const lvBadge = `LEVEL ${game.level}`;
  ctx.font = `800 10px ${activeTheme.fonts.numeric}`;
  const lvBadgeW = ctx.measureText(lvBadge).width + 20;
  const lvBadgeX = (WORLD_W - lvBadgeW) / 2;
  const lvBadgeY = 64;
  roundRect(lvBadgeX, lvBadgeY, lvBadgeW, 20, 10);
  ctx.fillStyle = 'rgba(124,77,255,0.35)';
  ctx.fill();
  roundRect(lvBadgeX, lvBadgeY, lvBadgeW, 20, 10);
  ctx.strokeStyle = 'rgba(124,77,255,0.5)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#c4a8ff';
  ctx.fillText(lvBadge, WORLD_W / 2, lvBadgeY + 10);

  // Title with glow
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = activeTheme.colors.aimLine;
  ctx.shadowBlur = 16;
  ctx.font = `900 26px ${activeTheme.fonts.display}`;
  // Gradient text
  const titleGrad = ctx.createLinearGradient(0, 86, 0, 108);
  titleGrad.addColorStop(0, '#ffffff');
  titleGrad.addColorStop(1, activeTheme.colors.aimLine);
  ctx.fillStyle = titleGrad;
  ctx.fillText('CHOOSE UPGRADE', WORLD_W / 2, 100);
  ctx.restore();

  // Decorative line under title
  const lineW = 80;
  const lineGrad = ctx.createLinearGradient(WORLD_W / 2 - lineW, 0, WORLD_W / 2 + lineW, 0);
  lineGrad.addColorStop(0, 'rgba(124,77,255,0)');
  lineGrad.addColorStop(0.5, 'rgba(124,77,255,0.5)');
  lineGrad.addColorStop(1, 'rgba(124,77,255,0)');
  ctx.fillStyle = lineGrad;
  ctx.fillRect(WORLD_W / 2 - lineW, 116, lineW * 2, 1);

  for (let i = 0; i < game.upgradeChoices.length; i++) {
    const opt = game.upgradeChoices[i];
    const bounds = getLevelUpCardBounds(i);
    const accent = getUpgradeAccent(opt.id);

    // Card shadow
    ctx.save();
    ctx.globalAlpha = 0.35;
    roundRect(bounds.x + 1, bounds.y + 3, bounds.w, bounds.h, 8);
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.restore();

    // Card gradient bg
    roundRect(bounds.x, bounds.y, bounds.w, bounds.h, 8);
    const cardGrad = ctx.createLinearGradient(bounds.x, bounds.y, bounds.x, bounds.y + bounds.h);
    cardGrad.addColorStop(0, '#1e1e3a');
    cardGrad.addColorStop(1, '#111122');
    ctx.fillStyle = cardGrad;
    ctx.fill();

    // Inner top highlight
    ctx.save();
    roundRect(bounds.x, bounds.y, bounds.w, bounds.h, 8);
    ctx.clip();
    const innerGrad = ctx.createLinearGradient(bounds.x, bounds.y, bounds.x, bounds.y + bounds.h * 0.5);
    innerGrad.addColorStop(0, 'rgba(255,255,255,0.04)');
    innerGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = innerGrad;
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h / 2);
    ctx.restore();

    // Border
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 6;
    roundRect(bounds.x, bounds.y, bounds.w, bounds.h, 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Accent left edge bar
    ctx.save();
    roundRect(bounds.x, bounds.y, bounds.w, bounds.h, 8);
    ctx.clip();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 8;
    ctx.fillStyle = accent;
    ctx.fillRect(bounds.x, bounds.y + 8, 3, bounds.h - 16);
    ctx.restore();

    // Icon circle bg
    const iconCX = bounds.x + 32;
    const iconCY = bounds.y + bounds.h / 2;
    ctx.beginPath();
    ctx.arc(iconCX, iconCY, 16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(iconCX, iconCY, 16, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Icon
    ctx.font = `700 20px ${activeTheme.fonts.ui}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(opt.icon, iconCX, iconCY + 1);

    // Name
    ctx.textAlign = 'left';
    ctx.font = `800 13px ${activeTheme.fonts.ui}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(opt.name, bounds.x + 56, bounds.y + 30);

    // Description
    ctx.font = `600 10px ${activeTheme.fonts.ui}`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(opt.description, bounds.x + 56, bounds.y + 50);
  }
}

function drawGameOver(game: Game): void {
  // Dark overlay
  const overlayGrad = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  overlayGrad.addColorStop(0, 'rgba(15,0,0,0.85)');
  overlayGrad.addColorStop(1, 'rgba(0,0,0,0.8)');
  ctx.fillStyle = overlayGrad;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Red GAME OVER with strong glow
  ctx.save();
  ctx.shadowColor = '#ff2222';
  ctx.shadowBlur = 30;
  ctx.font = `900 36px ${activeTheme.fonts.display}`;
  const titleGrad = ctx.createLinearGradient(0, WORLD_H * 0.3, 0, WORLD_H * 0.36);
  titleGrad.addColorStop(0, '#ff6666');
  titleGrad.addColorStop(1, '#cc2222');
  ctx.fillStyle = titleGrad;
  ctx.fillText('GAME OVER', WORLD_W / 2, WORLD_H * 0.33);
  ctx.fillText('GAME OVER', WORLD_W / 2, WORLD_H * 0.33);
  ctx.restore();

  // Decorative line
  const lineW = 60;
  const lineGrad = ctx.createLinearGradient(WORLD_W / 2 - lineW, 0, WORLD_W / 2 + lineW, 0);
  lineGrad.addColorStop(0, 'rgba(255,68,68,0)');
  lineGrad.addColorStop(0.5, 'rgba(255,68,68,0.4)');
  lineGrad.addColorStop(1, 'rgba(255,68,68,0)');
  ctx.fillStyle = lineGrad;
  ctx.fillRect(WORLD_W / 2 - lineW, WORLD_H * 0.37, lineW * 2, 1);

  // Stats card
  const cardW = 160;
  const cardH = 70;
  const cardX = (WORLD_W - cardW) / 2;
  const cardY = WORLD_H * 0.40;
  drawGlassPanel(cardX, cardY, cardW, cardH, 8);

  // Score label
  ctx.font = `700 8px ${activeTheme.fonts.ui}`;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('SCORE', WORLD_W / 2, cardY + 16);

  // Score value
  ctx.save();
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 8;
  ctx.font = `900 28px ${activeTheme.fonts.numeric}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${game.score}`, WORLD_W / 2, cardY + 38);
  ctx.restore();

  // Level reached
  ctx.font = `700 10px ${activeTheme.fonts.ui}`;
  ctx.fillStyle = '#d4bbff';
  ctx.fillText(`Level ${game.level}`, WORLD_W / 2, cardY + 58);

  // Pulsing tap to restart
  const t = performance.now() / 1000 * 3;
  const pulse = 0.65 + Math.sin(t) * 0.35;
  const scalePulse = 1 + Math.sin(t) * 0.03;
  ctx.save();
  ctx.translate(WORLD_W / 2, WORLD_H * 0.62);
  ctx.scale(scalePulse, scalePulse);
  ctx.globalAlpha = pulse;

  // Button-like pill
  const btnW = 140;
  const btnH = 28;
  roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 14);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = `800 11px ${activeTheme.fonts.ui}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('TAP TO RESTART', 0, 0.5);
  ctx.restore();
}

function drawFlash(alpha: number, color: string, w: number, h: number): void {
  if (alpha <= 0) return;
  ctx.fillStyle = color;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
}

let lastTime = 0;

export function render(game: Game): void {
  const now = performance.now() / 1000;
  const time = now - startTime;
  const dt = lastTime > 0 ? Math.min(now - lastTime, 0.05) : 0.016;
  lastTime = now;

  ctx.save();
  ctx.scale(devicePixelRatio, devicePixelRatio);

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Screen pulse scale centered on screen
  const screenPulse = game.juice.screenPulse || 0;
  const punchScale = 1 + screenPulse * 0.015;
  const screenCX = offsetX + (WORLD_W * scale) / 2;
  const screenCY = offsetY + (WORLD_H * scale) / 2;

  ctx.save();
  ctx.translate(screenCX, screenCY);
  ctx.scale(punchScale, punchScale);
  ctx.translate(-screenCX, -screenCY);

  ctx.save();
  ctx.translate(offsetX + game.juice.shakeX * scale, offsetY + game.juice.shakeY * scale);
  ctx.scale(scale, scale);

  drawBackground(dt, time);

  for (const gem of game.gems) {
    if (!gem.alive) continue;
    drawGem(gem, time);
  }

  for (const e of game.enemies) {
    if (!e.alive) continue;
    drawEnemy(e, time);
  }

  for (let i = 0; i < game.particles.length; i++) {
    const p = game.particles[i];
    if (!p || p.life <= 0) continue;
    drawParticle(p);
  }

  for (const dn of game.damageNumbers) {
    if (dn.life <= 0) continue;
    drawDamageNumber(dn);
  }

  for (const b of game.balls) {
    if (!b.active && !b.returning) continue;
    drawBall(b, time);
  }

  // Laser beams (drawn over enemies and balls)
  if (game.laserBeams.length > 0) {
    drawLaserBeams(game.laserBeams);
  }

  // Lightning arcs
  if (game.lightningArcs.length > 0) {
    drawLightningArcs(game.lightningArcs);
  }

  drawPlayer(game);
  drawAimLine(game);

  if (game.juice.flashAlpha > 0) {
    drawFlash(game.juice.flashAlpha, game.juice.flashColor, WORLD_W, WORLD_H);
  }

  ctx.restore();

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  drawHUD(game);
  drawXPBar(game);
  drawCombo(game);
  ctx.restore();

  ctx.restore(); // punchScale

  if (game.state === 'GAME_OVER') {
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    drawGameOver(game);
    ctx.restore();
  }

  if (game.state === 'LEVEL_UP') {
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    drawLevelUp(game);
    ctx.restore();
  }

  ctx.restore();
}

export function getCanvasInfo() {
  return { canvas, scale, offsetX, offsetY };
}
