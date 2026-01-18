# Aura Archer Documentation

Comprehensive documentation for the Aura Archer roguelike shooter game.

## Documentation Index

### Gameplay Systems

| Document                            | Description                                                     |
| ----------------------------------- | --------------------------------------------------------------- |
| [Core Gameplay](./core-gameplay.md) | Core loop, mechanics, difficulty levels, elemental resistances  |
| [Abilities](./abilities.md)         | All 27 abilities, synergies, stacking behavior, priority system |
| [Enemies](./enemies.md)             | 9 enemy types, behaviors, attack patterns, chapter modifiers    |
| [Bosses](./bosses.md)               | 15 bosses across 5 chapters, attack phases, visual telegraphs   |

### Progression Systems

| Document                        | Description                                                 |
| ------------------------------- | ----------------------------------------------------------- |
| [Equipment](./equipment.md)     | 4 slots, 5 rarity tiers, 19 perks, fusion, weapons          |
| [Heroes](./heroes.md)           | 3 heroes, unique passives, leveling, stats summary          |
| [Progression](./progression.md) | Currencies, talents, chapters, chests, daily rewards, saves |

### Development

| Document                                          | Description                                                       |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| [Technical Foundation](./technical-foundation.md) | Tech stack, architecture, managers, file structure                |
| [Asset Generation](./asset-generation.md)         | AI-powered sprite and image generation scripts                    |
| [Current Status](./current-status.md)             | Implementation status, fixed bugs, open issues, upcoming features |

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev

# Run tests
pnpm run test        # Unit tests
pnpm run test:visual # E2E tests (requires dev server)

# Build for production
pnpm run build
```

## Project Overview

Aura Archer is a roguelike shooter built with Phaser 3. The core mechanic is **stop to shoot, move to dodge**: the player auto-fires when stationary and stops firing when moving.

### Key Features

- 27 stackable abilities with synergies
- 9 enemy types with unique behaviors
- 15 bosses across 5 chapters
- Equipment system with fusion
- 3 unlockable heroes
- Talent lottery system
- Daily rewards and achievements

For development guidelines, see [CLAUDE.md](../CLAUDE.md).
