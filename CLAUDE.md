# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Archer.io/Archero-style roguelike shooter web game built with Phaser 3. The core mechanic is **stop to shoot, move to dodge**: the player auto-fires when stationary and stops firing when moving, creating constant micro-decisions between offense and defense.

## Development Commands

```bash
# Install dependencies
pnpm install

# Development server with hot reload
pnpm run dev

# Build for production (includes TypeScript type checking)
pnpm run build

# Preview production build
pnpm run preview

# Run linter (must pass with 0 warnings)
pnpm run lint

# Run visual tests
pnpm run test:visual
```

## Code Quality Requirements

**IMPORTANT:** All code changes must pass linting and TypeScript compilation before being considered complete.

1. **TypeScript Build** (`pnpm run build`): Must compile without errors
2. **ESLint** (`pnpm run lint`): Must pass with 0 warnings

### Quick Verification
```bash
# Run both checks before committing
pnpm run build && pnpm run lint
```

### Common Fixes
- **Unused variables**: Prefix with underscore (e.g., `_delta` instead of `delta`)
- **Phaser callback types**: Cast to `Phaser.Types.Physics.Arcade.ArcadePhysicsCallback`
- **Body types**: Cast to `Phaser.Physics.Arcade.Body` when using arcade physics methods

## Architecture Overview

### Tech Stack
- **Engine**: Phaser 3.6+ with Arcade Physics (fast 2D physics for bullet-hell gameplay)
- **Build Tool**: Vite (expected)
- **Touch Controls**: nipplejs for virtual joystick
- **Language**: TypeScript (expected)

### Scene Architecture

The game uses Phaser's scene system with the following scene flow:

```
BootScene → PreloaderScene → MainMenuScene ↔ GameScene (with UIScene overlay) → ResultsScene
                                                ↕
                                            PauseScene
```

**Scene Responsibilities**:
- `BootScene`: Load minimal core assets
- `PreloaderScene`: Load all game assets with progress bar
- `MainMenuScene`: Main menu, hero selection, equipment management
- `GameScene`: Core gameplay loop (player movement, combat, enemies, rooms)
- `UIScene`: HUD overlay (health bar, XP bar, room counter, pause button) - runs parallel to GameScene
- `PauseScene`: Pause menu overlay
- `ResultsScene`: Victory/defeat screen with run statistics

### Core Systems

**Player System**:
- Virtual joystick spawns at touch point (entire left half of screen)
- Auto-aim targets nearest enemy when player is stationary
- Auto-fire triggers when movement joystick is released
- Movement stops firing; standing still enables shooting

**Combat System**:
- Object pooling for bullets (pre-allocate 100+) and enemies (50+)
- BulletPool pattern using Phaser.Physics.Arcade.Group
- Auto-aim calculates nearest enemy via distance check
- Collision detection: player/enemy, bullet/enemy, player/enemy-bullet

**Ability System** (AbilityManager):
- Abilities can stack (e.g., multiple Front Arrow +1 selections compound)
- Each ability modifies player stats or projectile behavior
- Level-up presents 3 random abilities every 10 kills
- Abilities apply effects via `onProjectileFired()`, `modifyStats()`, etc.

**Room System**:
- Linear progression through 10 rooms per run (MVP) or 20+ (V1+)
- Room types: Combat (clear all enemies), Angel (heal or ability choice), Boss
- Door opens when all enemies defeated
- Room transitions use camera fade (300ms fade out/in)
- Procedural generation: Hand-crafted layouts with random enemy spawns

**Enemy System**:
- Enemy archetypes defined by behavior pattern (melee, ranged, spreader, etc.)
- AI updates every frame: target player, move/attack logic, telegraph attacks
- Enemy pooling for performance (reuse defeated enemies)
- Red telegraph lines show ranged enemy attack targeting

### Performance Requirements

**Critical Targets**:
- 60 FPS desktop, 30-60 FPS mobile
- Under 100 draw calls per frame
- Single texture atlas under 4096x4096
- Object pooling for ALL bullets, enemies, and particles

**Performance Patterns**:
```typescript
// Object pool example
class BulletPool extends Phaser.Physics.Arcade.Group {
  constructor(scene) {
    super(scene.physics.world, scene, {
      classType: Bullet,
      maxSize: 100,
      runChildUpdate: true
    });
  }
  spawn(x, y, angle, speed) {
    const bullet = this.get(x, y);
    if (bullet) bullet.fire(x, y, angle, speed);
    return bullet;
  }
}
```

## Development Phases

The project is structured in three phases (see game_plan.md for full details):

**MVP** (4-6 weeks): Core loop with 10-room runs, 3 enemy types, 8 abilities, basic boss fight. No equipment, no persistent progression. Goal: Validate core mechanic is fun.

**V1** (6-10 weeks): Full roguelike with equipment system (4 slots, 5 rarity tiers), 3 heroes, talent system, 5 chapters with 20 rooms each, currency/economy, permanent progression.

**V2** (8-12 weeks): Monetization (ads, IAP, battle pass), 10 chapters, 8 heroes, social features (leaderboards, clans), cosmetics, analytics.

## Code Organization Guidelines

### Ability Implementation
- Abilities stack via `ability.stack()` method
- Store ability instances in `AbilityManager.abilities[]`
- Recalculate player stats after each ability add/remove
- Use `onProjectileFired(projectile)` callback for bullet modifications

### Room Generation
- Check if `currentRoom % 5 === 0` for Angel rooms
- Check if `currentRoom === totalRooms` for Boss room
- Use seeded randomness for reproducible runs
- Weighted random ability selection prevents duplicate immediate offers

### Enemy Behavior Pattern
```typescript
// Each enemy type implements:
update(time, delta) {
  this.updateAI(player); // Target selection, movement decision
  this.updateAttack(time); // Attack timing, projectile spawning
  this.updateAnimation(); // Visual state based on behavior
}
```

### Touch Controls
- Minimum 44px touch targets for all buttons
- Virtual joystick must spawn at touch point, not fixed position
- Test on actual mobile devices, not just browser emulators

## Common Pitfalls

**Performance Death Spiral**: Too many active particles/enemies cause frame drops → joystick lag → player frustration. Budget entities strictly. Use object pooling religiously.

**Ability Power Creep**: Test runs with maximum ability counts (20+ minutes). Abilities must stack meaningfully without trivializing content.

**Stop-to-Shoot Timing**: The delay between stopping movement and firing is critical. Test 0ms, 50ms, 100ms delays to find the sweet spot.

**Telegraph Visibility**: Red lines for enemy attacks must be readable on all background colors. Use contrasting colors or outlines.

## File Structure (Expected)

```
src/
├── scenes/           # Phaser scenes
│   ├── BootScene.ts
│   ├── PreloaderScene.ts
│   ├── MainMenuScene.ts
│   ├── GameScene.ts
│   ├── UIScene.ts
│   ├── PauseScene.ts
│   └── ResultsScene.ts
├── entities/         # Game objects
│   ├── Player.ts
│   ├── Enemy.ts
│   ├── Bullet.ts
│   └── Boss.ts
├── systems/          # Core game systems
│   ├── AbilityManager.ts
│   ├── RoomManager.ts
│   ├── BulletPool.ts
│   └── EnemyPool.ts
├── abilities/        # Ability implementations
│   ├── AbilityFactory.ts
│   ├── FrontArrow.ts
│   ├── Multishot.ts
│   └── ...
├── ui/               # UI components
│   ├── Joystick.ts
│   ├── HealthBar.ts
│   └── LevelUpModal.ts
├── data/             # Game data/configs
│   ├── enemyConfigs.ts
│   ├── abilityConfigs.ts
│   └── roomLayouts.ts
└── main.ts           # Phaser game config & initialization
```

## Asset Organization

- Use single texture atlas (under 4096x4096) for mobile compatibility
- Organize sprites by entity type: `player/`, `enemies/`, `projectiles/`, `ui/`
- Preload all assets in PreloaderScene, not during gameplay

## Testing Priorities

1. Virtual joystick feel (spawning, dead zones, visual feedback)
2. Stop-to-shoot timing and auto-aim accuracy
3. Enemy telegraph visibility on all backgrounds
4. Ability stacking correctness (especially multiplicative effects)
5. Performance with 50+ entities on screen
6. Touch targets on mobile (actual device testing required)

every time you make changes, update @game_plan.md to be always up to date and have latest information. 