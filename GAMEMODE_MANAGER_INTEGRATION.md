# GameModeManager Integration Guide

## Overview
`GameModeManager` has been extracted from `GameScene.ts` to handle game mode state and victory/defeat/respawn logic.

## File Created
- `/Users/karolis/personal/archerio-clone/src/scenes/game/GameModeManager.ts`

## Extracted Methods
The following methods were moved from `GameScene` to `GameModeManager`:

1. **triggerVictory()** - Victory condition handling
2. **triggerGameOver()** - Game over / defeat handling
3. **saveRoomStateForRespawn()** - Save enemy/boss state for respawn
4. **handleRespawn()** - Restore room state and player after respawn
5. **showRespawnEffect()** - Visual effect for respawn
6. **pushEnemiesAway()** - Push enemies away from player on respawn
7. **handleSkipRun()** - Debug skip run functionality

## Extracted State
The following state variables were moved from `GameScene`:

1. **isEndlessMode** - Endless mode flag
2. **isDailyChallengeMode** - Daily challenge mode flag
3. **respawnUsed** - One-time respawn tracking
4. **runStartTime** - Run start timestamp
5. **isGameOver** - Game over state flag (renamed to isGameOverState internally)

## Public API

### Initialization
```typescript
gameModeManager.initialize(isEndless: boolean, isDailyChallenge: boolean): void
```

### State Queries
```typescript
gameModeManager.isGameOver(): boolean
gameModeManager.getRunStartTime(): number
gameModeManager.isEndless(): boolean
gameModeManager.isDailyChallenge(): boolean
gameModeManager.canRespawn(): boolean
```

### Game Flow Methods
```typescript
gameModeManager.triggerVictory(): void
gameModeManager.triggerGameOver(): void
gameModeManager.handleRespawn(roomState: RespawnRoomState): void
gameModeManager.handleSkipRun(): void
```

## Event Handlers Required

`GameModeManagerEventHandlers` interface defines callbacks for scene coordination:

```typescript
interface GameModeManagerEventHandlers {
  onVictory: () => void
  onGameOver: () => void
  onRespawn: (roomState: RespawnRoomState) => void
  onSkipRun: () => void
  onUpdateHealthUI: () => void
  onUpdateRoomUI: () => void
}
```

## Configuration Dependencies

`GameModeManagerConfig` requires:

```typescript
interface GameModeManagerConfig {
  scene: Phaser.Scene
  player: Player
  enemies: Phaser.Physics.Arcade.Group
  enemyBulletPool: EnemyBulletPool
  bombPool: BombPool | null
  particles: ParticleManager
  abilitySystem: AbilitySystem
  dropManager: DropManager
  difficultyConfig: DifficultyConfig
  eventHandlers: GameModeManagerEventHandlers
  getInputSystem: () => InputSystem | null
  getBoss: () => BaseBoss | null
  getCurrentBossType: () => BossType | null
  getCurrentRoom: () => number
  getTotalRooms: () => number
  getEndlessWave: () => number
  getAcquiredAbilitiesArray: () => string[]
  getRunSeedString: () => string
}
```

## Integration Steps

### 1. Import GameModeManager in GameScene
```typescript
import { GameModeManager, type GameModeManagerConfig, type GameModeManagerEventHandlers } from './game/GameModeManager'
```

### 2. Add Manager Instance
```typescript
private gameModeManager!: GameModeManager
```

### 3. Initialize in create()
```typescript
// Create event handlers for game mode transitions
const gameModeEventHandlers: GameModeManagerEventHandlers = {
  onVictory: () => {
    // Any additional victory handling
  },
  onGameOver: () => {
    // Any additional game over handling
  },
  onRespawn: (roomState) => {
    // Re-initialize input system
    const gameContainer = this.game.canvas.parentElement
    this.inputSystem = new InputSystem({
      scene: this,
      joystickContainer: gameContainer ?? undefined,
    })
    // Grant temporary immunity
    this.isLevelingUp = true
    this.time.delayedCall(2000, () => {
      this.isLevelingUp = false
    })
  },
  onSkipRun: () => {
    // Any additional skip run handling
  },
  onUpdateHealthUI: () => {
    this.updatePlayerHealthUI(this.player)
  },
  onUpdateRoomUI: () => {
    this.updateRoomUI()
  },
}

// Create game mode manager config
const gameModeConfig: GameModeManagerConfig = {
  scene: this,
  player: this.player,
  enemies: this.enemies,
  enemyBulletPool: this.enemyBulletPool,
  bombPool: this.bombPool,
  particles: this.particles,
  abilitySystem: this.abilitySystem,
  dropManager: this.dropManager,
  difficultyConfig: this.difficultyConfig,
  eventHandlers: gameModeEventHandlers,
  getInputSystem: () => this.inputSystem,
  getBoss: () => this.boss,
  getCurrentBossType: () => this.currentBossType,
  getCurrentRoom: () => this.currentRoom,
  getTotalRooms: () => this.totalRooms,
  getEndlessWave: () => this.endlessWave,
  getAcquiredAbilitiesArray: () => this.getAcquiredAbilitiesArray(),
  getRunSeedString: () => this.runSeedString,
}

// Initialize game mode manager
this.gameModeManager = new GameModeManager(gameModeConfig)

// Initialize game mode state
const isEndlessMode = this.game.registry.get('isEndlessMode') === true
const isDailyChallengeMode = this.game.registry.get('isDailyChallengeMode') === true
this.gameModeManager.initialize(isEndlessMode, isDailyChallengeMode)
```

### 4. Replace State Access

Replace all direct state access with manager calls:

**Before:**
```typescript
if (this.isGameOver) return
```

**After:**
```typescript
if (this.gameModeManager.isGameOver()) return
```

**Before:**
```typescript
const playTimeMs = Date.now() - this.runStartTime
```

**After:**
```typescript
const playTimeMs = Date.now() - this.gameModeManager.getRunStartTime()
```

### 5. Replace Method Calls

Replace direct method calls with manager calls:

**Before:**
```typescript
this.triggerVictory()
```

**After:**
```typescript
this.gameModeManager.triggerVictory()
```

**Before:**
```typescript
this.triggerGameOver()
```

**After:**
```typescript
this.gameModeManager.triggerGameOver()
```

**Before:**
```typescript
this.handleSkipRun()
```

**After:**
```typescript
this.gameModeManager.handleSkipRun()
```

**Before:**
```typescript
this.handleRespawn(roomState)
```

**After:**
```typescript
this.gameModeManager.handleRespawn(roomState)
```

### 6. Remove Extracted Code from GameScene

After integration is complete and tested:

1. Remove the extracted methods:
   - `triggerVictory()`
   - `triggerGameOver()`
   - `saveRoomStateForRespawn()`
   - `handleRespawn()`
   - `showRespawnEffect()`
   - `pushEnemiesAway()`
   - `handleSkipRun()`

2. Remove the extracted state variables:
   - `isEndlessMode`
   - `isDailyChallengeMode`
   - `respawnUsed`
   - `runStartTime`
   - Keep `isGameOver` if used for game state flags, but prefer `gameModeManager.isGameOver()`

3. Update imports:
   - Remove `RespawnRoomState` and `EnemyRespawnState` from GameOverScene import
   - These types are now exported from GameModeManager

## Testing Checklist

After integration, test the following scenarios:

- [ ] **Victory**: Complete a chapter and verify victory screen shows correctly
- [ ] **Defeat**: Die and verify game over screen shows correctly
- [ ] **Extra Life**: Verify extra life revives player at 30% HP
- [ ] **Respawn**: Die, watch ad, verify respawn works with room state preserved
- [ ] **Endless Mode**: Verify waves progress correctly
- [ ] **Daily Challenge**: Verify daily challenge completion is recorded
- [ ] **Skip Run**: Verify skip run functionality works
- [ ] **Build**: Run `pnpm run build` to verify TypeScript compilation
- [ ] **Lint**: Run `pnpm run lint` to verify ESLint passes

## Notes

- The manager uses getter functions for dynamic state (room number, boss, etc.) to avoid stale data
- Event handlers allow GameScene to handle scene-specific logic (input system, immunity)
- The manager is fully self-contained and doesn't directly modify GameScene state
- All extracted types (RespawnRoomState, EnemyRespawnState) are now exported from GameModeManager
