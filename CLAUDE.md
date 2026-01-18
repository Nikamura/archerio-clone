# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aura Archer is a roguelike shooter web game built with Phaser 3. The core mechanic is **stop to shoot, move to dodge**: the player auto-fires when stationary and stops firing when moving, creating constant micro-decisions between offense and defense.

## Documentation

Detailed documentation is in [`docs/`](./docs/README.md):

| Document | Description |
|----------|-------------|
| [Core Gameplay](./docs/core-gameplay.md) | Core loop, difficulty, elemental resistances |
| [Abilities](./docs/abilities.md) | 21 abilities, synergies, priority system |
| [Enemies](./docs/enemies.md) | 9 enemy types, behaviors, chapter modifiers |
| [Bosses](./docs/bosses.md) | 15 bosses, attack patterns, architecture |
| [Equipment](./docs/equipment.md) | 4 slots, 5 rarities, fusion, weapons |
| [Heroes](./docs/heroes.md) | 3 heroes, passives, leveling |
| [Progression](./docs/progression.md) | Currencies, talents, chapters, saves |
| [Technical Foundation](./docs/technical-foundation.md) | Architecture, managers, file structure |
| [Asset Generation](./docs/asset-generation.md) | AI sprite generation scripts |
| [Current Status](./docs/current-status.md) | Bugs, balance, upcoming features |

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm run dev          # Development server with hot reload
pnpm run build        # Build for production (includes TypeScript check)
pnpm run lint         # Run linter (must pass with 0 warnings)
pnpm run format       # Format code with Prettier
pnpm run format:check # Check formatting (CI)
pnpm run test         # Unit tests
pnpm run test:visual  # Puppeteer E2E tests (requires dev server)
```

## Code Quality Requirements

**IMPORTANT:** All code changes must pass linting, formatting, and TypeScript compilation before being considered complete.

```bash
# Run all checks before committing
pnpm run build && pnpm run lint && pnpm run format:check
```

### Formatting (Prettier)

Code is formatted with Prettier using default settings (`printWidth: 100`). Run `pnpm run format` to auto-fix formatting issues.

### Common TypeScript Fixes
- **Unused variables**: Prefix with underscore (e.g., `_delta`)
- **Phaser callback types**: Cast to `Phaser.Types.Physics.Arcade.ArcadePhysicsCallback`
- **Body types**: Cast to `Phaser.Physics.Arcade.Body`

### Phaser-Specific Patterns

**Hitbox Centering** - When using `setCircle()`, offset is required:
```typescript
const body = this.body as Phaser.Physics.Arcade.Body
const offset = (displaySize - radius * 2) / 2
body.setCircle(radius, offset, offset)
```

**Container Click Areas** - Containers require explicit hit area:
```typescript
container.setInteractive(
  new Phaser.Geom.Rectangle(-width/2, -height/2, width, height),
  Phaser.Geom.Rectangle.Contains
)
```

**Scene Transitions** - Stop current scene LAST:
```typescript
this.scene.stop('OtherScene')
this.scene.start('NewScene')
this.scene.stop('CurrentScene') // Last!
```

## Architecture Quick Reference

- **Tech Stack**: Phaser 3.6+, Vite, TypeScript, Arcade Physics
- **Resolution**: 375x667 (portrait mode)
- **Scenes**: Boot → Preloader → MainMenu ↔ GameScene (+ UIScene overlay)
- **Managers**: Singleton pattern with localStorage persistence (see [Technical Foundation](./docs/technical-foundation.md))
- **Object Pooling**: BulletPool, EnemyBulletPool, GoldPool, HealthPool

## Native App (Capacitor)

```bash
pnpm run dev              # Web development
pnpm run cap:sync         # Sync to native
pnpm run cap:open:ios     # Open in Xcode
pnpm run build:native     # Production native build
```

Set `CAPACITOR_DEV_SERVER_URL=http://192.168.x.x:3000` in `.env` for live reload.

## Asset Generation

```bash
pnpm run generate sprite "archer with bow" --type player --clean
```

**Types**: player (64px), enemy (64px), boss (128px), projectile (32px), item (32px), ui (48px)

**IMPORTANT**: Always use `--clean` flag for transparent backgrounds

See [Asset Generation](./docs/asset-generation.md) for full documentation.

## Common Bugs & Solutions

1. **Joystick Y-axis inverted**: Negate sin component (mathematical angles)
2. **Enemies leaving bounds**: Set `physics.world.setBounds()` and clamp in update()
3. **Sprites too large**: AI generates 1024px+; always resize to target size
4. **Bullets passing through**: Center hitboxes with offset when using `setCircle()`
5. **Scene input not working**: Call `this.input.enabled = true` and `this.scene.bringToTop()`

## Performance Requirements

- 60 FPS desktop, 30-60 FPS mobile
- Under 100 draw calls per frame
- Object pooling for ALL bullets, enemies, particles, pickups

## Development Workflow

1. Run `pnpm run build && pnpm run lint && pnpm run format:check` before considering work complete
2. **Keep documentation in sync** - update `CLAUDE.md` and relevant `docs/*.md` files when:
   - Adding/changing abilities, enemies, bosses, equipment, heroes
   - Modifying game mechanics or balance values
   - Adding new systems or managers
   - Fixing bugs (update `docs/current-status.md`)
3. Use managers for any persistent state (with `saveToStorage()` on mutation)
4. Use object pools for frequently spawned entities
5. Update `src/config/encyclopediaData.ts` when adding game content
6. Resize AI-generated images to target size
