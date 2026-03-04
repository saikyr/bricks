import { Enemy, createEnemy } from '../entities/enemy';
import { generateFormation } from './formation';
import { GRID_TOP_Y, WORLD_H, ENEMY_SCROLL_SPEED, MAX_SCROLL_SPEED } from '../utils/constants';

export interface WaveState {
  enemies: Enemy[];
  rowsSpawned: number;
  nextRowY: number;      // y where the next row will be placed
  elapsedTime: number;   // seconds since game start, drives all scaling
  initialDelay: number;  // delay before first row spawns
}

export function createWaveState(): WaveState {
  return {
    enemies: [],
    rowsSpawned: 0,
    nextRowY: GRID_TOP_Y,
    elapsedTime: 0,
    initialDelay: 1.0,
  };
}

function spawnRow(ws: WaveState, y: number, cols: number, cellSize: number, corridorX: number): void {
  const hp = 20 + Math.floor(ws.rowsSpawned * 1.2);
  const difficulty = Math.min(1, ws.elapsedTime / 480); // 0→1 over 8 minutes
  const formation = generateFormation(Math.max(1, Math.floor(ws.rowsSpawned / 4) + 1), cols, difficulty);
  const row = formation.rows[0];
  for (let c = 0; c < row.length; c++) {
    const cell = row[c];
    if (cell) {
      const cellHp = Math.max(1, Math.round(hp * cell.hpMult));
      ws.enemies.push(createEnemy(c, y, cellHp, cellSize, corridorX, cell.gridW, cell.gridH));
    }
  }
  ws.rowsSpawned++;
}

/** Returns number of enemies that crossed danger zone. */
export function updateWave(ws: WaveState, dt: number, cols: number, cellSize: number, corridorX: number): number {
  ws.elapsedTime += dt;

  // Initial delay — don't spawn or scroll until delay expires
  if (ws.initialDelay > 0) {
    ws.initialDelay -= dt;
    if (ws.initialDelay > 0) return 0;
  }

  // Time-based scroll speed
  const scrollSpeed = Math.min(
    ENEMY_SCROLL_SPEED + ws.elapsedTime * 0.05,
    MAX_SCROLL_SPEED,
  );

  let dangerCount = 0;

  // Continuous scroll all enemies down
  for (const e of ws.enemies) {
    if (!e.alive) continue;
    e.pos.y += scrollSpeed * dt;

    // Enemy reached bottom edge → kill it and count damage
    if (e.pos.y + e.height > WORLD_H) {
      e.alive = false;
      dangerCount++;
    }
  }

  // Also scroll the next-row marker so it stays in sync
  ws.nextRowY += scrollSpeed * dt;

  // Spawn a new row when there's room: next row marker has scrolled
  // down by at least cellSize from GRID_TOP_Y
  while (ws.nextRowY >= GRID_TOP_Y + cellSize) {
    ws.nextRowY -= cellSize;
    spawnRow(ws, GRID_TOP_Y, cols, cellSize, corridorX);
  }

  // Clean up dead enemies
  ws.enemies = ws.enemies.filter(e => e.alive);

  // Cap damage to 1 per update so a whole row doesn't instant-kill
  return Math.min(dangerCount, 1);
}
