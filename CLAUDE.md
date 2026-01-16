# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aura Archer is a roguelike shooter web game built with Phaser 3. The core mechanic is **stop to shoot, move to dodge**: the player auto-fires when stationary and stops firing when moving, creating constant micro-decisions between offense and defense.

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

# Run unit tests
pnpm run test

# Generate sprites with AI
pnpm run generate-sprite "<description>" --type <type> --clean
```

## Native App (Capacitor)

The game can be deployed as a native iOS/Android app using Capacitor.

### Development Workflows

**Web browser (fastest iteration):**
```bash
pnpm run dev
```

**Live reload on device (for testing native features):**
```bash
# 1. Set your local IP in .env:
#    CAPACITOR_DEV_SERVER_URL=http://192.168.x.x:3000

# 2. Start dev server and sync
pnpm run dev          # Terminal 1
pnpm run cap:sync     # Terminal 2 (once)

# 3. Build & run from Xcode/Android Studio
pnpm run cap:open:ios
```

**Production build:**
```bash
# Comment out CAPACITOR_DEV_SERVER_URL in .env first!
pnpm run build:native
pnpm run cap:open:ios   # or cap:open:android
```

### Environment Variables (.env)

```bash
# Capacitor live reload - comment out for production builds
CAPACITOR_DEV_SERVER_URL=http://192.168.x.x:3000
```

### Native Build Requirements

**iOS:**
- macOS with Xcode 16+
- Xcode Command Line Tools
- Apple Developer account for device testing

**Android:**
- Android Studio
- Android SDK API level 22+
- Java 17+

### Key Files

| File | Purpose |
|------|---------|
| `capacitor.config.ts` | Capacitor configuration (app ID, plugins, dev server) |
| `src/systems/CapacitorManager.ts` | Native lifecycle (status bar, splash, back button) |
| `src/systems/HapticManager.ts` | Uses Capacitor Haptics for native, falls back to browser API |

### Haptic Feedback

HapticManager automatically uses the proper API based on platform:
- **Native (iOS/Android)**: Capacitor Haptics with `ImpactStyle.Light/Medium/Heavy`
- **Web browser**: Falls back to `navigator.vibrate()` API (Android only, iOS Safari doesn't support it)

## Code Quality Requirements

**IMPORTANT:** All code changes must pass linting and TypeScript compilation before being considered complete.

1. **TypeScript Build** (`pnpm run build`): Must compile without errors
2. **ESLint** (`pnpm run lint`): Must pass with 0 warnings

### Quick Verification
```bash
# Run both checks before committing
pnpm run build && pnpm run lint
```

### Common TypeScript Fixes
- **Unused variables**: Prefix with underscore (e.g., `_delta` instead of `delta`)
- **Unused class properties**: Either remove or prefix with underscore
- **Phaser callback types**: Cast to `Phaser.Types.Physics.Arcade.ArcadePhysicsCallback`
- **Body types**: Cast to `Phaser.Physics.Arcade.Body` when using arcade physics methods
- **Color interpolation**: Use `new Phaser.Display.Color(r, g, b)` not object literals

### Phaser-Specific Patterns

**Hitbox Centering** - When using `setCircle()`, offset is required to center the hitbox:
```typescript
const body = this.body as Phaser.Physics.Arcade.Body
body.setSize(displaySize, displaySize)
const offset = (displaySize - radius * 2) / 2
body.setCircle(radius, offset, offset)
```

**Container Click Areas** - Phaser Containers require explicit hit area geometry:
```typescript
container.setInteractive(
  new Phaser.Geom.Rectangle(-width/2, -height/2, width, height),
  Phaser.Geom.Rectangle.Contains
)
```

**Scene Transitions** - When stopping current scene, do it LAST:
```typescript
// CORRECT order:
this.scene.stop('OtherScene')
this.scene.start('NewScene')
this.scene.stop('CurrentScene') // Last!
```

**Scrollable Content** - Use Container + GeometryMask + pointer/wheel input handlers

## Architecture Overview

### Tech Stack
- **Engine**: Phaser 3.6+ with Arcade Physics (fast 2D physics for bullet-hell gameplay)
- **Build Tool**: Vite
- **Touch Controls**: Native Phaser Graphics for virtual joystick
- **Language**: TypeScript (strict mode)
- **Portrait Mode**: 375x667 (iPhone SE size)

### Scene Architecture

```
BootScene → PreloaderScene → MainMenuScene ↔ GameScene (with UIScene overlay) → GameOverScene
                                   ↕
              HeroesScene, EquipmentScene, TalentsScene, ChestScene,
              DailyRewardScene, AchievementsScene
```

**Scene Responsibilities**:
- `BootScene`: Load minimal core assets, initialize managers
- `PreloaderScene`: Load all game assets with progress bar
- `MainMenuScene`: Main menu, navigation to progression systems
- `GameScene`: Core gameplay loop (player movement, combat, enemies, rooms)
- `UIScene`: HUD overlay (health bar, XP bar, room counter) - runs parallel to GameScene
- `GameOverScene`: Victory/defeat screen with rewards, stats, chest rewards
- `LevelUpScene`: Ability selection modal (3 choices)

### Manager Pattern (Singletons)

All managers use the singleton pattern with localStorage persistence:

```typescript
class SomeManager {
  private static _instance: SomeManager
  static get instance(): SomeManager {
    if (!SomeManager._instance) {
      SomeManager._instance = new SomeManager()
    }
    return SomeManager._instance
  }

  private constructor() {
    this.loadFromStorage()
  }

  private saveToStorage(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.toSaveData()))
  }

  private loadFromStorage(): void {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) this.fromSaveData(JSON.parse(stored))
  }
}

export const someManager = SomeManager.instance
```

**Existing Managers**:
- `SaveManager` - Overall game save state
- `CurrencyManager` - Gold, gems, scrolls, energy
- `EquipmentManager` - Inventory, equipped items, fusion
- `TalentManager` - Talent lottery system
- `ChapterManager` - Chapter progression, room tracking
- `ChestManager` - Chest inventory
- `DailyRewardManager` - 7-day login rewards
- `AchievementManager` - Achievement tracking
- `HapticManager` - Mobile vibration feedback

### Boss System Architecture

Bosses extend `BaseBoss` abstract class which extends `Enemy`:

```typescript
export default class SomeBoss extends BaseBoss {
  constructor(scene, x, y, bulletPool, options?) {
    super(scene, x, y, bulletPool, 'textureKey', options)
    // Or use getBossDefinition('boss_id') for data-driven bosses
  }

  // REQUIRED: Select attack phase based on pattern number
  protected selectAttackPhase(pattern: number, playerX: number, playerY: number): void {
    switch (pattern) {
      case 0: this.phase = 'attack_1'; break
      case 1: this.phase = 'attack_2'; break
      case 2: this.phase = 'attack_3'; break
    }
  }

  // REQUIRED: Handle the current attack phase
  protected handleAttackPhase(time: number, playerX: number, playerY: number): void {
    switch (this.phase) {
      case 'attack_1': this.handleAttack1(time); break
      // ...
    }
  }
}
```

**BaseBoss Helper Methods**:
- `fireSpread(count, speed)` - Circular projectile pattern
- `fireAtPlayer(playerX, playerY, count, speed, spread)` - Aimed shots
- `drawTelegraphLine/Circle()` - Visual attack warnings
- `pulseWarning(elapsed)` / `showWarningPulse(elapsed)` - Flashing effect
- `finishAttack(time)` - Return to idle phase

### Object Pooling Pattern

All frequently spawned objects use pooling:

```typescript
class SomePool extends Phaser.Physics.Arcade.Group {
  constructor(scene: Phaser.Scene) {
    super(scene.physics.world, scene, {
      classType: SomeEntity,
      maxSize: 50,
      runChildUpdate: true
    })
  }

  spawn(x: number, y: number): SomeEntity | null {
    const entity = this.get(x, y) as SomeEntity
    if (entity) {
      entity.activate(x, y)
    }
    return entity
  }
}
```

**Existing Pools**: BulletPool, EnemyBulletPool, GoldPool, HealthPool

### Enemy Types

Base enemy types in `src/entities/`:
- `Enemy.ts` - Base melee enemy
- `RangedShooterEnemy.ts` - Fires single projectiles with telegraph
- `SpreaderEnemy.ts` - Fires 4-direction patterns
- `TankEnemy.ts` - Slow, high HP, charge attack
- `BurrowerEnemy.ts` - Underground movement, surface attack
- `BomberEnemy.ts` - AOE explosive projectiles
- `ChargerEnemy.ts` - Fast dash attack
- `HealerEnemy.ts` - Heals nearby enemies
- `SpawnerEnemy.ts` - Creates minions

## Persistence Conventions

**Auto-save on mutation**: Every manager method that modifies state should call `saveToStorage()`:
```typescript
addItem(item: Item): void {
  this.items.push(item)
  this.emit('itemAdded', item)
  this.saveToStorage()  // Always save after mutation
}
```

**localStorage Keys** (defined as constants):
- `aura_archer_save_data` - SaveManager
- `aura_archer_currency_data` - CurrencyManager
- `aura_archer_equipment_data` - EquipmentManager
- `aura_archer_talent_data` - TalentManager
- `aura_archer_chest_data` - ChestManager
- `aura_archer_daily_rewards` - DailyRewardManager
- `aura_archer_achievements` - AchievementManager
- `aura_archer_hero_data` - HeroManager
- `aura_archer_chapter_data` - ChapterManager
- `aura_archer_encyclopedia_data` - EncyclopediaManager

## Mobile Conventions

**Haptic Feedback** - Use HapticManager for vibration:
```typescript
import { hapticManager } from '../systems/HapticManager'

hapticManager.light()   // Gold pickup, UI interaction
hapticManager.medium()  // Shooting
hapticManager.heavy()   // Taking damage
hapticManager.pattern('levelUp')  // Special patterns
```

**Touch Targets**: Minimum 44px for all interactive elements

**Virtual Joystick**: Native Phaser joystick spawns at touch point on left 60% of screen

## Asset Generation

```bash
# Generate sprite with clean background
pnpm run generate-sprite "archer with bow" --type player --clean

# Types: player (64px), enemy (64px), boss (128px), projectile (32px),
#        item (32px), effect (64px), ui (48px)

# Animation sequences
pnpm run generate-sprite "knight" --type player --anim walk --clean

# Remove background from existing image
pnpm run remove-bg assets/sprites/enemy/slime.png
```

**IMPORTANT**: Always use `--clean` flag - AI generates fake checkerboard backgrounds

## Common Bugs & Solutions

1. **Joystick Y-axis inverted**: Joystick uses mathematical angles (counter-clockwise), negate sin component
2. **Enemies leaving bounds**: Always set `physics.world.setBounds()` and clamp in update()
3. **Sprites too large**: AI generates 1024px+ images; always specify exact dimensions
4. **Bullets passing through**: Center hitboxes with offset when using `setCircle()`
5. **Scene input not working**: Call `this.input.enabled = true` and `this.scene.bringToTop()`

## Performance Requirements

- 60 FPS desktop, 30-60 FPS mobile
- Under 100 draw calls per frame
- Single texture atlas under 4096x4096
- Object pooling for ALL bullets, enemies, particles, pickups

## File Structure

```
src/
├── scenes/           # Phaser scenes (Boot, Preloader, MainMenu, Game, UI, etc.)
├── entities/         # Game objects (Player, Enemy types, Boss, Bullet, Pickups)
│   └── bosses/       # Boss implementations extending BaseBoss
├── systems/          # Managers and pools (CurrencyManager, BulletPool, etc.)
├── abilities/        # Ability implementations
├── config/           # Game data (bossData, chapterData, talentData, etc.)
├── data/             # Static data (equipmentData, chestData, achievementData)
└── main.ts           # Phaser game config & initialization
```

## Testing

```bash
pnpm run test              # Unit tests
pnpm run test:watch        # Watch mode
pnpm run test:coverage     # Coverage report
pnpm run test:visual       # Puppeteer E2E tests (requires dev server)
```

Unit-testable logic is in `src/systems/PlayerStats.ts` (86+ tests)

## Development Workflow

1. Always run `pnpm run build` before considering work complete
2. Fix all TypeScript errors (unused vars → prefix with `_`)
3. Update `game_plan.md` when adding features
4. Use managers for any persistent state
5. Use object pools for frequently spawned entities
6. Test on actual mobile devices for touch/haptic features
7. **Update encyclopedia**: When adding new enemies, bosses, abilities, or game mechanics, update `src/config/encyclopediaData.ts` to document them
8. **Resize AI-generated images**: AI generates 1024px+ images - always resize to target size (player: 64px, enemy: 64px, boss: 128px, projectile: 32px, item: 32px, ui: 48px) to prevent sprites from covering the entire screen
9. **Add localStorage persistence**: Any new data/manager that tracks player progress must save to localStorage - follow the Manager Pattern with `saveToStorage()` on mutation and `loadFromStorage()` on construction
