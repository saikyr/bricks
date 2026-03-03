import { BallType } from '../entities/ball';

export interface PlayerStats {
  fireInterval: number;
  damage: number;
  ballSpeed: number;
  ballRadius: number;
}

export interface UpgradeOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  apply?: (stats: PlayerStats) => void;
  addBall?: BallType;
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
    id: 'fire_rate',
    name: 'Fire Rate +20%',
    description: 'Shoot 20% faster',
    icon: '»',
    apply: (s) => { s.fireInterval *= 0.8; },
  },
  {
    id: 'ball_speed',
    name: 'Ball Speed +15%',
    description: 'Balls move 15% faster',
    icon: '↑',
    apply: (s) => { s.ballSpeed *= 1.15; },
  },
  {
    id: 'ball_size',
    name: 'Ball Size +15%',
    description: 'Bigger balls = easier hits',
    icon: '◉',
    apply: (s) => { s.ballRadius *= 1.15; },
  },
  {
    id: 'add_normal',
    name: '+1 Ball',
    description: 'Add a normal ball to your queue',
    icon: '●',
    addBall: 'normal',
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
    icon: '⚡',
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
