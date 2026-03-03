# Bricks

A brick-breaking survival roguelite — Arkanoid meets Vampire Survivors. Built with vanilla TypeScript + Canvas 2D, wrapped with Capacitor for mobile.

**[Play it live](https://bricks-e38l.onrender.com)**

## Gameplay

- **Vertical corridor** — enemies scroll down, player at bottom fires balls upward
- **Ricochet physics** — balls bounce off walls and enemies, maximizing bounces is the core skill
- **Roguelite upgrades** — kill enemies, collect XP gems, level up, pick 1 of 3 upgrades
- **10 ball types** — each with unique on-hit effects and visual identity

## Ball Types

| Ball | Effect |
|------|--------|
| **Normal** | Standard bouncing ball |
| **Spectral** | Phases through enemies, hits each once |
| **Explosive** | AoE splash damage on every hit |
| **Laser** | Fires a beam perpendicular to travel on every hit |
| **Bleed** | Stacks bleed — pops for bonus damage on next hit from any ball |
| **Burn** | 3s fire DoT (orange damage numbers) |
| **Poison** | 5s poison DoT, spreads to nearby enemies on kill |
| **Lightning** | Chains to 3 nearby enemies on hit |
| **Freeze** | 30% chance to freeze for 2s (frozen = 1.5x damage from all sources) |

## Tech Stack

- **TypeScript** — no frameworks, no game engine
- **Canvas 2D** — all rendering is procedural (no sprites)
- **Vite** — dev server and build
- **Capacitor** — native iOS/Android wrapper

## Development

```bash
npm install
npm run dev      # dev server at localhost:5173
npm run build    # production build to dist/
```

## Project Structure

```
src/
├── main.ts              # Entry point, canvas setup
├── game.ts              # Game loop, state machine, hit processing
├── input.ts             # Touch/mouse input
├── renderer.ts          # All canvas drawing (balls, enemies, UI, effects)
├── physics.ts           # Ball movement, collision detection
├── entities/
│   ├── ball.ts          # Ball entity + types
│   ├── enemy.ts         # Enemy entity with status effects
│   ├── gem.ts           # XP gem entity
│   └── particle.ts      # Particle + damage number systems
├── systems/
│   ├── status.ts        # Status effect system (bleed/burn/poison/freeze)
│   ├── formation.ts     # Enemy formation generation
│   ├── wave.ts          # Wave spawning + scrolling
│   ├── juice.ts         # Screen shake, flash, slow-mo, combos
│   └── upgrade.ts       # Upgrade card definitions
├── theme.ts             # Visual theme tokens
└── utils/
    ├── math.ts          # Vector math helpers
    └── constants.ts     # Tuning values
```
