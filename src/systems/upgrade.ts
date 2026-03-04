import { BallType } from '../entities/ball';
import { MAGAZINE_CAP } from '../utils/constants';

export interface PlayerStats {
  recycleCooldown: number;
  fireRate: number;
  damage: number;
  ballSpeed: number;
  ballRadius: number;
  critChance: number;
  xpMult: number;
}

export type Rarity = 'common' | 'rare' | 'epic';

export interface UpgradeOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: Rarity;
  apply?: (stats: PlayerStats) => void;
  addBall?: BallType;
  healHp?: number;
  upgradeBall?: BallType;
  applyBallUpgrade?: (levels: Record<string, number>) => void;
}

export interface UpgradeContext {
  totalBalls: number;
  normalCount: number;
  ownedTypes: Set<BallType>;
  level: number;
  ballUpgrades: Record<string, number>;
}

export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#888888',
  rare: '#4488ff',
  epic: '#bb44ff',
};

function buildUpgradeTable(): UpgradeOption[] {
  const upgrades: UpgradeOption[] = [];

  // === COMMON (7) ===
  upgrades.push({
    id: 'c_damage', name: '+15% Damage', description: 'Each ball hits 15% harder',
    icon: '✦', rarity: 'common',
    apply: (s) => { s.damage = Math.ceil(s.damage * 1.15); },
  });
  upgrades.push({
    id: 'c_speed', name: '+10% Ball Speed', description: 'Balls move 10% faster',
    icon: '↑', rarity: 'common',
    apply: (s) => { s.ballSpeed *= 1.10; },
  });
  upgrades.push({
    id: 'c_crit', name: '+5% Crit', description: 'Slightly better crit chance',
    icon: '⚔', rarity: 'common',
    apply: (s) => { s.critChance = Math.min(s.critChance + 0.05, 0.90); },
  });
  upgrades.push({
    id: 'c_xp', name: '+15% XP', description: 'Earn 15% more XP',
    icon: '★', rarity: 'common',
    apply: (s) => { s.xpMult += 0.15; },
  });
  upgrades.push({
    id: 'c_recycle', name: 'Quick Recycle', description: 'Balls return 10% faster',
    icon: '»', rarity: 'common',
    apply: (s) => { s.recycleCooldown *= 0.9; },
  });
  upgrades.push({
    id: 'c_heal', name: '+1 HP', description: 'Restore one hit point',
    icon: '♥', rarity: 'common',
    healHp: 1,
  });
  // === RARE (12) ===
  // Stats (4)
  upgrades.push({
    id: 'r_damage', name: '+30% Damage', description: 'Significant damage boost',
    icon: '✦✦', rarity: 'rare',
    apply: (s) => { s.damage = Math.ceil(s.damage * 1.30); },
  });
  upgrades.push({
    id: 'r_speed', name: '+20% Ball Speed', description: 'Much faster balls',
    icon: '↑↑', rarity: 'rare',
    apply: (s) => { s.ballSpeed *= 1.20; },
  });
  upgrades.push({
    id: 'r_crit', name: '+15% Crit', description: 'Better crit chance',
    icon: '⚔⚔', rarity: 'rare',
    apply: (s) => { s.critChance = Math.min(s.critChance + 0.15, 0.90); },
  });
  upgrades.push({
    id: 'r_recycle', name: 'Fast Recycle', description: 'Balls return 25% faster',
    icon: '»»', rarity: 'rare',
    apply: (s) => { s.recycleCooldown *= 0.75; },
  });

  // Add ball (4) — rare elemental balls
  upgrades.push({
    id: 'r_add_bleed', name: 'Bleed Ball', description: 'Stacks bleed — pops for bonus damage',
    icon: '🩸', rarity: 'rare', addBall: 'bleed',
  });
  upgrades.push({
    id: 'r_add_burn', name: 'Burn Ball', description: 'Sets enemies on fire (DoT)',
    icon: '🔥', rarity: 'rare', addBall: 'burn',
  });
  upgrades.push({
    id: 'r_add_poison', name: 'Poison Ball', description: 'Poison DoT — spreads on kill',
    icon: '☠️', rarity: 'rare', addBall: 'poison',
  });
  upgrades.push({
    id: 'r_add_freeze', name: 'Freeze Ball', description: '30% chance to freeze (1.5x dmg)',
    icon: '❄️', rarity: 'rare', addBall: 'freeze',
  });

  // Upgrade ball (4) — rare upgrades for owned types
  upgrades.push({
    id: 'r_up_bleed', name: 'Bleed+', description: '+1 bleed stack per hit',
    icon: '🩸', rarity: 'rare', upgradeBall: 'bleed',
    applyBallUpgrade: (bu) => { bu.bleed = (bu.bleed || 0) + 1; },
  });
  upgrades.push({
    id: 'r_up_burn', name: 'Burn+', description: '+50% burn damage',
    icon: '🔥', rarity: 'rare', upgradeBall: 'burn',
    applyBallUpgrade: (bu) => { bu.burn = (bu.burn || 0) + 1; },
  });
  upgrades.push({
    id: 'r_up_poison', name: 'Poison+', description: '+50% poison dmg & spread',
    icon: '☠️', rarity: 'rare', upgradeBall: 'poison',
    applyBallUpgrade: (bu) => { bu.poison = (bu.poison || 0) + 1; },
  });
  upgrades.push({
    id: 'r_up_freeze', name: 'Freeze+', description: '+15% freeze chance',
    icon: '❄️', rarity: 'rare', upgradeBall: 'freeze',
    applyBallUpgrade: (bu) => { bu.freeze = (bu.freeze || 0) + 1; },
  });

  // === EPIC (10) ===
  // Stats (3)
  upgrades.push({
    id: 'e_damage', name: '+50% Damage', description: 'Massive damage boost',
    icon: '✦✦✦', rarity: 'epic',
    apply: (s) => { s.damage = Math.ceil(s.damage * 1.50); },
  });
  upgrades.push({
    id: 'e_crit', name: '+30% Crit', description: 'Huge crit chance boost',
    icon: '⚔⚔⚔', rarity: 'epic',
    apply: (s) => { s.critChance = Math.min(s.critChance + 0.30, 0.90); },
  });
  upgrades.push({
    id: 'e_recycle', name: 'Instant Recycle', description: 'Balls return 50% faster',
    icon: '»»»', rarity: 'epic',
    apply: (s) => { s.recycleCooldown *= 0.50; },
  });

  // Add ball (4) — epic special balls
  upgrades.push({
    id: 'e_add_explosive', name: 'Explosive Ball', description: 'AoE splash on every hit',
    icon: '💥', rarity: 'epic', addBall: 'explosive',
  });
  upgrades.push({
    id: 'e_add_laser', name: 'Laser Ball', description: 'Fires beam on every hit',
    icon: '⚡', rarity: 'epic', addBall: 'laser',
  });
  upgrades.push({
    id: 'e_add_lightning', name: 'Lightning Ball', description: 'Chains to 3 nearby enemies',
    icon: '⛓', rarity: 'epic', addBall: 'lightning',
  });
  upgrades.push({
    id: 'e_add_spectral', name: 'Spectral Ball', description: 'Phases through enemies',
    icon: '👻', rarity: 'epic', addBall: 'spectral',
  });

  // Upgrade ball (4) — epic upgrades for owned types
  upgrades.push({
    id: 'e_up_explosive', name: 'Explosive+', description: '+30% explosion radius',
    icon: '💥', rarity: 'epic', upgradeBall: 'explosive',
    applyBallUpgrade: (bu) => { bu.explosive = (bu.explosive || 0) + 1; },
  });
  upgrades.push({
    id: 'e_up_laser', name: 'Laser+', description: '+30% beam damage',
    icon: '⚡', rarity: 'epic', upgradeBall: 'laser',
    applyBallUpgrade: (bu) => { bu.laser = (bu.laser || 0) + 1; },
  });
  upgrades.push({
    id: 'e_up_lightning', name: 'Lightning+', description: '+1 chain target',
    icon: '⛓', rarity: 'epic', upgradeBall: 'lightning',
    applyBallUpgrade: (bu) => { bu.lightning = (bu.lightning || 0) + 1; },
  });
  upgrades.push({
    id: 'e_up_spectral', name: 'Spectral+', description: '+50% spectral damage',
    icon: '👻', rarity: 'epic', upgradeBall: 'spectral',
    applyBallUpgrade: (bu) => { bu.spectral = (bu.spectral || 0) + 1; },
  });

  return upgrades;
}

const ALL_UPGRADES = buildUpgradeTable();

function isEligible(opt: UpgradeOption, ctx: UpgradeContext): boolean {
  // Add-ball: need a normal ball to replace AND must not already own that type
  if (opt.addBall) {
    if (ctx.normalCount <= 0) return false;
    if (ctx.ownedTypes.has(opt.addBall)) return false;
    return true;
  }
  // Upgrade-ball: no normals left to replace (all slots specialized) AND must own that type
  if (opt.upgradeBall) {
    if (ctx.normalCount > 0) return false;
    if (!ctx.ownedTypes.has(opt.upgradeBall)) return false;
    return true;
  }
  return true;
}

function getRarityWeights(level: number): Record<Rarity, number> {
  const shift = Math.min((level - 1) * 3, 30); // up to 30% shift at level 11+
  return {
    common: Math.max(60 - shift, 20),
    rare: 30 + shift * 0.6,
    epic: 10 + shift * 0.4,
  };
}

function weightedPickRarity(weights: Record<Rarity, number>): Rarity {
  const total = weights.common + weights.rare + weights.epic;
  const r = Math.random() * total;
  if (r < weights.common) return 'common';
  if (r < weights.common + weights.rare) return 'rare';
  return 'epic';
}

export function rollUpgradeChoices(count: number, ctx: UpgradeContext): UpgradeOption[] {
  const eligible = ALL_UPGRADES.filter(opt => isEligible(opt, ctx));
  if (eligible.length === 0) return [];

  const weights = getRarityWeights(ctx.level);
  const chosen: UpgradeOption[] = [];
  const usedIds = new Set<string>();

  for (let i = 0; i < count; i++) {
    const rarity = weightedPickRarity(weights);
    let pool = eligible.filter(o => o.rarity === rarity && !usedIds.has(o.id));
    // Fallback: if no options at this rarity, try any eligible
    if (pool.length === 0) {
      pool = eligible.filter(o => !usedIds.has(o.id));
    }
    if (pool.length === 0) break;

    const pick = pool[Math.floor(Math.random() * pool.length)];
    chosen.push(pick);
    usedIds.add(pick.id);
  }

  // Pity: level >= 3 guarantees at least 1 non-common
  if (ctx.level >= 3 && chosen.length >= 2 && chosen.every(c => c.rarity === 'common')) {
    const nonCommon = eligible.filter(o => o.rarity !== 'common' && !usedIds.has(o.id));
    if (nonCommon.length > 0) {
      const replacement = nonCommon[Math.floor(Math.random() * nonCommon.length)];
      chosen[chosen.length - 1] = replacement;
    }
  }

  return chosen;
}
