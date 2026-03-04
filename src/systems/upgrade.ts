import { BallType } from '../entities/ball';

export interface PlayerStats {
  fireInterval: number;
  damage: number;
  ballSpeed: number;
  ballRadius: number;
  critChance: number;
  xpMult: number;
}

export interface UpgradeOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  apply?: (stats: PlayerStats) => void;
  addBall?: BallType;
  healHp?: number;
}

const ALL_UPGRADES: UpgradeOption[] = [
  {
    id: 'damage',
    name: '+25% Damage',
    description: 'Each ball hits 25% harder',
    icon: '✦',
    apply: (s) => { s.damage = Math.ceil(s.damage * 1.25); },
  },
  {
    id: 'damage_big',
    name: '+50% Damage',
    description: 'Massive damage boost',
    icon: '✦✦',
    apply: (s) => { s.damage = Math.ceil(s.damage * 1.5); },
  },
  {
    id: 'fire_rate',
    name: 'Fire Rate +20%',
    description: 'Shoot 20% faster',
    icon: '»',
    apply: (s) => { s.fireInterval *= 0.8; },
  },
  {
    id: 'fire_rate_big',
    name: 'Double Fire Rate',
    description: 'Twice the shots, twice the fun',
    icon: '»»',
    apply: (s) => { s.fireInterval *= 0.5; },
  },
  {
    id: 'ball_speed',
    name: 'Ball Speed +15%',
    description: 'Balls move 15% faster',
    icon: '↑',
    apply: (s) => { s.ballSpeed *= 1.15; },
  },
  {
    id: 'crit_chance',
    name: 'Critical Hit +10%',
    description: 'Chance to deal double damage',
    icon: '⚔',
    apply: (s) => { s.critChance = Math.min(s.critChance + 0.10, 0.90); },
  },
  {
    id: 'xp_boost',
    name: 'XP Boost +30%',
    description: 'Gems give 30% more XP',
    icon: '★',
    apply: (s) => { s.xpMult += 0.30; },
  },
  {
    id: 'heal_hp',
    name: '+1 HP',
    description: 'Restore one hit point',
    icon: '♥',
    healHp: 1,
  },
  {
    id: 'add_spectral',
    name: 'Spectral Ball',
    description: 'Add a ghostly ball that phases through enemies',
    icon: '👻',
    addBall: 'spectral',
  },
  {
    id: 'add_explosive',
    name: 'Explosive Ball',
    description: 'AoE splash on every hit',
    icon: '💥',
    addBall: 'explosive',
  },
  {
    id: 'add_laser',
    name: 'Laser Ball',
    description: 'Fires beam on every hit',
    icon: '⚡',
    addBall: 'laser',
  },
  {
    id: 'add_bleed',
    name: 'Bleed Ball',
    description: 'Stacks bleed — pops for bonus damage',
    icon: '🩸',
    addBall: 'bleed',
  },
  {
    id: 'add_burn',
    name: 'Burn Ball',
    description: 'Sets enemies on fire (DoT)',
    icon: '🔥',
    addBall: 'burn',
  },
  {
    id: 'add_poison',
    name: 'Poison Ball',
    description: 'Poison DoT — spreads on kill',
    icon: '☠️',
    addBall: 'poison',
  },
  {
    id: 'add_lightning',
    name: 'Lightning Ball',
    description: 'Chains to 3 nearby enemies',
    icon: '⛓',
    addBall: 'lightning',
  },
  {
    id: 'add_freeze',
    name: 'Freeze Ball',
    description: '30% chance to freeze (1.5x dmg)',
    icon: '❄️',
    addBall: 'freeze',
  },
];

export function rollUpgradeChoices(count: number): UpgradeOption[] {
  const shuffled = [...ALL_UPGRADES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
