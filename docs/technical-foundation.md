# Technical Foundation

## Tech Stack

- **Engine**: Phaser 3.6+ with Arcade Physics (significantly faster than Matter.js for this genre)
- **Build Tool**: Vite
- **Touch Controls**: Native Phaser Graphics for virtual joystick
- **Language**: TypeScript (strict mode)
- **Portrait Mode**: 375x667 (iPhone SE size)

## Performance Requirements

- 60 FPS desktop, 30-60 FPS mobile
- Under 100 draw calls per frame
- Single texture atlas under 4096x4096
- Object pooling for ALL bullets, enemies, particles, pickups

## Object Pooling Pattern

All frequently spawned objects use pooling:

```typescript
class BulletPool extends Phaser.Physics.Arcade.Group {
  constructor(scene: Phaser.Scene) {
    super(scene.physics.world, scene, {
      classType: Bullet,
      maxSize: 100,
      runChildUpdate: true,
    });
  }

  spawn(x: number, y: number, angle: number, speed: number): Bullet | null {
    const bullet = this.get(x, y) as Bullet;
    if (bullet) {
      bullet.fire(x, y, angle, speed);
    }
    return bullet;
  }
}
```

**Existing Pools**: BulletPool, EnemyBulletPool, GoldPool, HealthPool

## Scene Architecture

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

## GameScene Subsystems

GameScene delegates specific responsibilities to extracted subsystems in `src/scenes/game/`. These are instantiated per-game (not singletons) and use constructor injection with event handler callbacks:

| Subsystem | Responsibility |
|-----------|----------------|
| `InputSystem` | Keyboard and virtual joystick input handling |
| `AbilitySystem` | Ability acquisition, leveling, and stat management |
| `CombatSystem` | Collision detection, damage calculations, bullet hits |
| `RoomManager` | Room progression, door transitions, enemy spawning delegation |
| `EnemySpawnManager` | Enemy and boss spawning (used by RoomManager) |
| `EnemyDeathHandler` | Death consequences: drops, XP, particles, stats |
| `ShootingSystem` | Player targeting, fire rate, projectile spawning (5 types) |

**Pattern**: Each subsystem uses a config interface + event handlers interface:
```typescript
interface ShootingSystemConfig {
  scene: Phaser.Scene;
  player: Player;
  // ... dependencies
  eventHandlers: ShootingEventHandlers;
}
```

## Manager Pattern (Singletons)

All managers use the singleton pattern with localStorage persistence:

```typescript
class SomeManager {
  private static _instance: SomeManager;
  static get instance(): SomeManager {
    if (!SomeManager._instance) {
      SomeManager._instance = new SomeManager();
    }
    return SomeManager._instance;
  }

  private constructor() {
    this.loadFromStorage();
  }

  private saveToStorage(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.toSaveData()));
  }

  private loadFromStorage(): void {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) this.fromSaveData(JSON.parse(stored));
  }
}

export const someManager = SomeManager.instance;
```

**Existing Managers**:

- `SaveManager` - Overall game save state, settings (including `gameSpeedMultiplier`)
- `CurrencyManager` - Gold, gems, scrolls, energy
- `EquipmentManager` - Inventory, equipped items, fusion
- `TalentManager` - Talent lottery system
- `ChapterManager` - Chapter progression, room tracking
- `ChestManager` - Chest inventory
- `DailyRewardManager` - 7-day login rewards
- `AchievementManager` - Achievement tracking
- `HapticManager` - Mobile vibration feedback

## File Structure

```
src/
├── scenes/           # Phaser scenes (Boot, Preloader, MainMenu, Game, UI, etc.)
│   └── game/         # GameScene subsystems (InputSystem, CombatSystem, ShootingSystem, etc.)
├── entities/         # Game objects (Player, Enemy types, Boss, Bullet, Pickups)
│   └── bosses/       # Boss implementations extending BaseBoss
├── systems/          # Managers and pools (CurrencyManager, BulletPool, etc.)
├── abilities/        # Ability implementations
├── config/           # Game data (bossData, chapterData, talentData, etc.)
├── data/             # Static data (equipmentData, chestData, achievementData)
└── main.ts           # Phaser game config & initialization
```

## localStorage Keys

| Key                             | Manager             |
| ------------------------------- | ------------------- |
| `aura_archer_save_data`         | SaveManager         |
| `aura_archer_currency_data`     | CurrencyManager     |
| `aura_archer_equipment_data`    | EquipmentManager    |
| `aura_archer_talent_data`       | TalentManager       |
| `aura_archer_chest_data`        | ChestManager        |
| `aura_archer_daily_rewards`     | DailyRewardManager  |
| `aura_archer_achievements`      | AchievementManager  |
| `aura_archer_hero_data`         | HeroManager         |
| `aura_archer_chapter_data`      | ChapterManager      |
| `aura_archer_encyclopedia_data` | EncyclopediaManager |

## Game Events

Key events emitted via `game.events`:

| Event | Payload | Description |
|-------|---------|-------------|
| `pauseRequested` | none | UI requests game pause |
| `gameSpeedChanged` | `GameSpeedMultiplier` | Speed multiplier changed (1, 2, 3, or 5) |
| `debugSkipLevel` | none | Debug: skip current room |
| `playerRespawn` | `RespawnRoomState` | Player respawns after watching ad |
| `quitFromPause` | none | Player quits from pause menu |
