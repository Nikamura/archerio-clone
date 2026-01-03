# GameScene Refactoring Proposal

## Overview

`src/scenes/GameScene.ts` is **~2460 lines** and handles too many responsibilities. This document proposes how to break it into smaller, focused modules.

## Current Structure Analysis

### File Breakdown by Lines

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1-44 | 44 different imports |
| Properties | 47-123 | 30+ state variables |
| `create()` | 129-436 | 307 lines of initialization |
| Room Management | 438-761 | Door, transitions, spawning |
| Boss Spawning | 764-806 | Boss creation logic |
| Combat Handlers | 808-1109 | Bullet hit, damage processing |
| Level Up | 1153-1311 | Ability selection/application |
| Enemy Damage | 1320-1465 | Bullet/melee damage to player |
| Debug | 1467-1559 | Skip level, reset |
| Enemy Finding | 1622-1736 | Nearest enemy with caching |
| Lightning Chain | 1744-1790 | Chain damage ability |
| Damage Aura | 1796-1909 | AOE damage system |
| Spirit Cats | 1911-2043 | Meowgik hero ability |
| Shooting | 2045-2164 | All projectile spawning |
| Update Loop | 2223-2356 | Main game loop |
| Cleanup | 2358-2460 | Shutdown logic |

## Proposed Refactoring

### 1. Extract `CombatSystem` class

**File:** `src/systems/CombatSystem.ts`

**Move:**
- `bulletHitEnemy()` (lines 963-1109)
- `enemyBulletHitPlayer()` (lines 1320-1387)
- `enemyHitPlayer()` (lines 1389-1460)
- `spiritCatHitEnemy()` (lines 1951-1993)
- `handleBombExplosion()` (lines 919-961)
- Damage calculation logic

**Interface:**
```typescript
class CombatSystem {
  constructor(scene: GameScene, pools: PoolReferences)
  handleBulletHit(bullet: Bullet, enemy: Enemy): void
  handleEnemyBulletHit(player: Player, bullet: EnemyBullet): void
  handleMeleeHit(player: Player, enemy: Enemy): void
  handleBombExplosion(x, y, radius, damage): void
}
```

**Estimated savings:** ~300 lines from GameScene

---

### 2. Extract `RoomManager` class

**File:** `src/systems/RoomManager.ts`

**Move:**
- `spawnDoor()` (lines 442-504)
- `enterDoor()` (lines 506-518)
- `transitionToNextRoom()` (lines 520-559)
- `cleanupRoom()` (lines 561-599)
- `spawnEnemiesForRoom()` (lines 601-636)
- `spawnEnemiesFromGeneration()` (lines 707-762)
- `checkRoomCleared()` (lines 808-842)
- Room state variables (currentRoom, totalRooms, isRoomCleared, etc.)

**Interface:**
```typescript
class RoomManager {
  constructor(scene: GameScene, roomGenerator: RoomGenerator)
  get currentRoom(): number
  spawnDoor(): void
  transitionToNext(): void
  cleanup(): void
  checkCleared(): boolean
}
```

**Estimated savings:** ~250 lines from GameScene

---

### 3. Extract `InputController` class

**File:** `src/systems/InputController.ts`

**Move:**
- Joystick creation and callbacks (lines 411-427)
- Keyboard setup (lines 394-408)
- `resetJoystickState()` (lines 2362-2377)
- Stuck joystick detection logic (lines 2236-2244)
- Movement velocity calculation (lines 2264-2277)
- Input state properties (joystickAngle, joystickForce, lastJoystickMoveTime)

**Interface:**
```typescript
class InputController {
  constructor(scene: GameScene)
  getVelocity(): { vx: number, vy: number }
  hasMovementInput(): boolean
  reset(): void
  destroy(): void
}
```

**Estimated savings:** ~100 lines from GameScene

---

### 4. Extract `EnemySpawner` class

**File:** `src/systems/EnemySpawner.ts`

**Move:**
- `spawnEnemyFromPosition()` (lines 643-702)
- `spawnBoss()` (lines 764-806)
- `spawnEnemies()` (initial spawn, lines 887-914)
- Enemy type switch logic
- Wave timer management (`cancelWaveTimers()`)

**Interface:**
```typescript
class EnemySpawner {
  constructor(scene: GameScene, pools: PoolReferences)
  spawnFromPosition(spawn: SpawnPosition, options: EnemyOptions): Enemy
  spawnBoss(bossType: BossType, options: BossOptions): Boss
  cancelWaveTimers(): void
}
```

**Estimated savings:** ~150 lines from GameScene

---

### 5. Extract `AbilitySystem` class

**File:** `src/systems/AbilitySystem.ts`

**Move:**
- `applyAbility()` (lines 1239-1311)
- `handleLevelUp()` (lines 1153-1220)
- `handleAutoLevelUp()` (lines 1225-1237)
- `getAcquiredAbilitiesArray()` (lines 1316-1318)
- `acquiredAbilities` Map
- `abilitiesGained` counter

**Interface:**
```typescript
class AbilitySystem {
  constructor(player: Player)
  apply(abilityId: string): void
  handleLevelUp(): void
  getAcquiredAbilities(): { id: string; level: number }[]
}
```

**Estimated savings:** ~120 lines from GameScene

---

### 6. Extract `ShootingSystem` class

**File:** `src/systems/ShootingSystem.ts`

**Move:**
- `shootAtEnemy()` (lines 2045-2164)
- `getEffectiveFireRate()` (lines 2166-2170)
- All projectile pattern logic (front arrow, multishot, diagonal, rear)

**Interface:**
```typescript
class ShootingSystem {
  constructor(player: Player, bulletPool: BulletPool)
  shootAt(enemy: Enemy, time: number): void
  getEffectiveFireRate(): number
}
```

**Estimated savings:** ~130 lines from GameScene

---

### 7. Extract `AuraSystem` class

**File:** `src/systems/AuraSystem.ts`

**Move:**
- `updateDamageAuraVisual()` (lines 1796-1823)
- `applyDamageAura()` (lines 1829-1909)
- `applyLightningChain()` (lines 1744-1790)
- Aura state (damageAuraGraphics, lastAuraDamageTime)

**Interface:**
```typescript
class AuraSystem {
  constructor(scene: GameScene, player: Player)
  update(time: number, playerX: number, playerY: number): void
  destroy(): void
}
```

**Estimated savings:** ~140 lines from GameScene

---

### 8. Extract `SpiritCatSystem` class

**File:** `src/systems/SpiritCatSystem.ts`

**Move:**
- `updateSpiritCats()` (lines 1914-1946)
- `spiritCatHitEnemy()` (lines 1951-1993)
- `handleEnemyKilledBySpiritCat()` (lines 1999-2043)
- Spirit cat pool and config

**Interface:**
```typescript
class SpiritCatSystem {
  constructor(scene: GameScene, player: Player)
  update(time: number, playerX: number, playerY: number): void
  handleHit(cat: SpiritCat, enemy: Enemy): void
  destroy(): void
}
```

**Estimated savings:** ~130 lines from GameScene

---

### 9. Extract `PickupManager` class

**File:** `src/systems/PickupManager.ts`

**Move:**
- Gold collection logic (lines 2329-2337)
- Health collection logic (lines 2340-2347)
- `spawnDrops()` (lines 1137-1151)
- Gold and health pool references

**Interface:**
```typescript
class PickupManager {
  constructor(goldPool: GoldPool, healthPool: HealthPool)
  spawnDrops(enemy: Enemy): void
  update(playerX: number, playerY: number): { gold: number }
  collectAll(playerX: number, playerY: number): { gold: number }
}
```

**Estimated savings:** ~50 lines from GameScene

---

### 10. Extract `PlayerStatsCalculator` utility

**File:** `src/systems/PlayerStatsCalculator.ts`

**Move:**
- Stats calculation logic from `create()` (lines 244-297)
- Equipment multiplier calculations
- Talent bonus application

**Interface:**
```typescript
function calculatePlayerStats(
  heroStats: HeroStats,
  equipStats: EquipStats,
  talentBonuses: TalentBonuses,
  difficultyConfig: DifficultyConfig
): FinalPlayerStats
```

**Estimated savings:** ~60 lines from GameScene

---

## Refactoring Priority

### Phase 1 (High Impact)
1. **CombatSystem** - Most complex, highest line count
2. **RoomManager** - Self-contained, clear boundaries
3. **InputController** - Reusable across scenes

### Phase 2 (Medium Impact)
4. **ShootingSystem** - Isolated projectile logic
5. **EnemySpawner** - Factory pattern opportunity
6. **AbilitySystem** - Clear single responsibility

### Phase 3 (Cleanup)
7. **AuraSystem** - Specific subsystem
8. **SpiritCatSystem** - Hero-specific logic
9. **PickupManager** - Simple extraction
10. **PlayerStatsCalculator** - Utility function

---

## Expected Results

| Metric | Before | After |
|--------|--------|-------|
| GameScene lines | ~2460 | ~800-1000 |
| Max method size | 307 lines (`create`) | <100 lines |
| Class count | 1 | 10+ |
| Testability | Low | High |
| Reusability | None | Moderate |

---

## Implementation Notes

### Dependency Injection

Each extracted system should receive dependencies via constructor:

```typescript
class GameScene extends Phaser.Scene {
  private combatSystem!: CombatSystem
  private roomManager!: RoomManager
  private inputController!: InputController

  create() {
    // Create pools first
    this.bulletPool = new BulletPool(this)
    // ...

    // Then create systems with dependencies
    this.combatSystem = new CombatSystem(this, {
      bulletPool: this.bulletPool,
      enemyBulletPool: this.enemyBulletPool,
      damageNumberPool: this.damageNumberPool,
      // ...
    })
  }
}
```

### Event-Based Communication

Systems should communicate via Phaser's event system:

```typescript
// In CombatSystem
this.scene.events.emit('enemyKilled', enemy)

// In GameScene
this.events.on('enemyKilled', this.handleEnemyKilled, this)
```

### Shared Interfaces

Create `src/types/GameTypes.ts` for shared interfaces:

```typescript
interface PoolReferences {
  bulletPool: BulletPool
  enemyBulletPool: EnemyBulletPool
  bombPool: BombPool
  goldPool: GoldPool
  healthPool: HealthPool
  damageNumberPool: DamageNumberPool
}

interface GameState {
  isGameOver: boolean
  isTransitioning: boolean
  currentRoom: number
}
```

---

## Alternative: Composition over Extraction

Instead of extracting to separate files, consider using composition within GameScene:

```typescript
// GameScene.ts (simplified)
export default class GameScene extends Phaser.Scene {
  create() {
    this.combat = this.createCombatHandlers()
    this.rooms = this.createRoomHandlers()
    this.input = this.createInputHandlers()
  }

  private createCombatHandlers() {
    return {
      bulletHitEnemy: (bullet, enemy) => { /* ... */ },
      // ...
    }
  }
}
```

This keeps everything in one file but organizes it into logical groups. Less modular but simpler to navigate.
