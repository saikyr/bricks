import { randInt, randRange } from '../utils/math';

export type FormationCell = null | { gridW: number; gridH: number; hpMult: number };

type Template = (cols: number) => FormationCell[][];

function fillRow(cols: number, fill: boolean): FormationCell[] {
  return new Array(cols).fill(null).map(() => fill ? { gridW: 1, gridH: 1, hpMult: 1 } : null);
}

const fullRow: Template = (cols) => {
  const row = fillRow(cols, true);
  // Ensure at least one gap
  row[randInt(0, cols - 1)] = null;
  return [row];
};

const checkerboard: Template = (cols) => {
  const rows: FormationCell[][] = [];
  for (let r = 0; r < 2; r++) {
    const row: FormationCell[] = [];
    for (let c = 0; c < cols; c++) {
      row.push((c + r) % 2 === 0 ? { gridW: 1, gridH: 1, hpMult: 1 } : null);
    }
    rows.push(row);
  }
  return rows;
};

const vShape: Template = (cols) => {
  const rows: FormationCell[][] = [];
  const mid = Math.floor(cols / 2);
  for (let r = 0; r < mid + 1; r++) {
    const row = fillRow(cols, false);
    const left = mid - r;
    const right = mid + r;
    if (left >= 0) row[left] = { gridW: 1, gridH: 1, hpMult: 1 };
    if (right < cols) row[right] = { gridW: 1, gridH: 1, hpMult: 1 };
    rows.push(row);
  }
  return rows;
};

const wallsWithGap: Template = (cols) => {
  const gap = randInt(1, cols - 2);
  const rows: FormationCell[][] = [];
  for (let r = 0; r < 2; r++) {
    const row = fillRow(cols, true);
    row[gap] = null;
    rows.push(row);
  }
  return rows;
};

const diamond: Template = (cols) => {
  const rows: FormationCell[][] = [];
  const mid = Math.floor(cols / 2);
  const sizes = [1, 3, 5, 3, 1];
  for (const size of sizes) {
    const row = fillRow(cols, false);
    const half = Math.floor(size / 2);
    for (let i = mid - half; i <= mid + half; i++) {
      if (i >= 0 && i < cols) row[i] = { gridW: 1, gridH: 1, hpMult: 1 };
    }
    rows.push(row);
  }
  return rows;
};

const scattered: Template = (cols) => {
  const row: FormationCell[] = [];
  for (let c = 0; c < cols; c++) {
    row.push(Math.random() < 0.5 ? { gridW: 1, gridH: 1, hpMult: 1 } : null);
  }
  // Ensure at least one enemy and one gap
  if (!row.some(v => v === null)) (row as FormationCell[])[randInt(0, cols - 1)] = null;
  if (!row.some(v => v !== null)) (row as FormationCell[])[randInt(0, cols - 1)] = { gridW: 1, gridH: 1, hpMult: 1 };
  return [row];
};

const templates: Template[] = [fullRow, checkerboard, vShape, wallsWithGap, diamond, scattered];

export function generateFormation(wave: number, cols: number, difficulty: number): { rows: FormationCell[][]; hp: number } {
  const template = templates[randInt(0, templates.length - 1)];
  const rows = template(cols);

  // Apply random mutations
  for (const row of rows) {
    for (let c = 0; c < cols; c++) {
      if (Math.random() < 0.1) {
        row[c] = row[c] ? null : { gridW: 1, gridH: 1, hpMult: 1 };
      }
    }
    // Always ensure at least one gap per row
    if (!row.some(v => v === null)) (row as FormationCell[])[randInt(0, cols - 1)] = null;
  }

  // Multi-cell merging based on difficulty
  for (const row of rows) {
    // 2×1 (wide) merges
    if (Math.random() < difficulty * 0.3) {
      for (let c = 0; c < cols - 1; c++) {
        if (row[c] && row[c + 1] && row[c]!.gridW === 1 && row[c + 1]!.gridW === 1) {
          row[c] = { gridW: 2, gridH: 1, hpMult: 2 };
          row[c + 1] = null; // consumed by the wide block
          break; // one merge per row
        }
      }
    }
  }

  // 2×2 (big) merges — only if we have 2+ rows
  if (rows.length >= 2 && Math.random() < difficulty * 0.1) {
    for (let r = 0; r < rows.length - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        if (rows[r][c] && rows[r][c + 1] && rows[r + 1][c] && rows[r + 1][c + 1]
          && rows[r][c]!.gridW === 1 && rows[r][c + 1]!.gridW === 1
          && rows[r + 1][c]!.gridW === 1 && rows[r + 1][c + 1]!.gridW === 1) {
          rows[r][c] = { gridW: 2, gridH: 2, hpMult: 4 };
          rows[r][c + 1] = null;
          rows[r + 1][c] = null;
          rows[r + 1][c + 1] = null;
          break; // one big merge per formation
        }
      }
    }
  }

  // Scale HP with wave
  const baseHp = Math.max(1, Math.floor(wave * 0.8 + randRange(0, 2)));
  return { rows, hp: baseHp };
}
