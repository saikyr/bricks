export interface ThemeTokens {
  fonts: {
    ui: string;
    display: string;
    numeric: string;
  };
  colors: {
    bg: string;
    playerCore: string;
    playerGlow: string;
    aimLine: string;
    hudText: string;
    hudMuted: string;
    uiBg: string;
    xpTrack: string;
    xpFill: string;
    comboText: string;
    gem: string;
    gemGlow: string;
    gridLine: string;
    cardBg: string;
    cardBorder: string;
    hpBar: string;
    hpBarLow: string;
    flashDamage: string;
    flashKill: string;
    flashChain: string;
  };
  ball: {
    normal: { core: string; glow: string; trailAlpha: number };
    spectral: { core: string; glow: string; trailAlpha: number };
    explosive: { core: string; glow: string; trailAlpha: number };
    laser: { core: string; glow: string; trailAlpha: number };
    bleed: { core: string; glow: string; trailAlpha: number };
    burn: { core: string; glow: string; trailAlpha: number };
    poison: { core: string; glow: string; trailAlpha: number };
    lightning: { core: string; glow: string; trailAlpha: number };
    freeze: { core: string; glow: string; trailAlpha: number };
  };
  layout: {
    hudTopPad: number;
    hudSidePad: number;
    levelUpCardW: number;
    levelUpCardH: number;
    levelUpGap: number;
    levelUpStartY: number;
  };
  motion: {
    gemBobFreq: number;
    gemBobAmp: number;
    comboPulseSpeed: number;
  };
  effects: {
    enemyHitFlash: number;
    flashDuration: number;
    shakeDecay: number;
    maxShake: number;
    comboPulseDecay: number;
    screenPulseDecay: number;
  };
  gradients: {
    enemyLighten: number;
    enemyDarken: number;
    glossAlpha: number;
    bgCenter: string;
    bgEdge: string;
  };
}

export const theme: ThemeTokens = {
  fonts: {
    ui: '"Nunito", system-ui, sans-serif',
    display: '"Nunito", system-ui, sans-serif',
    numeric: '"Nunito", system-ui, sans-serif',
  },
  colors: {
    bg: '#060612',
    playerCore: '#4edcff',
    playerGlow: '#4edcff',
    aimLine: '#7cecff',
    hudText: '#f0f0f0',
    hudMuted: '#888888',
    uiBg: 'rgba(0,0,0,0.45)',
    xpTrack: '#1a1a1a',
    xpFill: '#7c4dff',
    comboText: '#ffab40',
    gem: '#5be2ff',
    gemGlow: '#5be2ff',
    gridLine: 'rgba(255,255,255,0.03)',
    cardBg: '#1a1a2e',
    cardBorder: '#7c4dff',
    hpBar: '#4caf50',
    hpBarLow: '#f44336',
    flashDamage: '#ff5f7c',
    flashKill: '#7cecff',
    flashChain: '#ffb95f',
  },
  ball: {
    normal: { core: '#ffffff', glow: '#4edcff', trailAlpha: 0.4 },
    spectral: { core: '#4affb7', glow: '#4affb7', trailAlpha: 0.45 },
    explosive: { core: '#ffb15f', glow: '#ffb15f', trailAlpha: 0.45 },
    laser: { core: '#7c4dff', glow: '#b388ff', trailAlpha: 0.5 },
    bleed: { core: '#cc2244', glow: '#ff4466', trailAlpha: 0.45 },
    burn: { core: '#ff8800', glow: '#ffcc00', trailAlpha: 0.5 },
    poison: { core: '#44cc44', glow: '#88ff88', trailAlpha: 0.4 },
    lightning: { core: '#44aaff', glow: '#88ddff', trailAlpha: 0.5 },
    freeze: { core: '#aaeeff', glow: '#ddf4ff', trailAlpha: 0.4 },
  },
  layout: {
    hudTopPad: 10,
    hudSidePad: 10,
    levelUpCardW: 334,
    levelUpCardH: 82,
    levelUpGap: 12,
    levelUpStartY: 120,
  },
  motion: {
    gemBobFreq: 3.2,
    gemBobAmp: 2.2,
    comboPulseSpeed: 11,
  },
  effects: {
    enemyHitFlash: 0.28,
    flashDuration: 0.12,
    shakeDecay: 0.84,
    maxShake: 9,
    comboPulseDecay: 3.2,
    screenPulseDecay: 2.8,
  },
  gradients: {
    enemyLighten: 0.22,
    enemyDarken: 0.18,
    glossAlpha: 0.18,
    bgCenter: '#0a0a20',
    bgEdge: '#040410',
  },
};

// Backwards-compatible alias
export const activeTheme = theme;
