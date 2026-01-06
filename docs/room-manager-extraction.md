# RoomManager Extraction Summary

## Overview
Created `src/scenes/game/RoomManager.ts` by extracting room transition logic from GameScene.

## Methods Extracted

### Core Room Management
- `getCurrentRoom()` - Get current room number
- `getTotalRooms()` - Get total rooms for this run
- `isCleared()` - Check if current room is cleared
- `isInTransition()` - Check if transitioning between rooms
- `getEndlessWave()` - Get current endless wave number
- `getEndlessDifficultyMultiplier()` - Get endless difficulty multiplier

### Room Lifecycle
- `initialize()` - Initialize room state for new run
- `checkRoomCleared()` - Room cleared detection (checks enemies + pending spawns)
- `spawnDoor()` - Door spawning after room clear
- `enterDoor()` - Player interaction with door (private)
- `transitionToNextRoom()` - Room transition flow (private)
- `cleanupRoom()` - Cleanup between rooms (door, enemies, boss state)
- `resetToRoom1()` - Reset room state back to room 1 (for level reset feature)

### Endless Mode
- `startNextEndlessWave()` - Endless mode wave progression (private)
- `showEndlessWaveNotification()` - Endless wave UI (private)

### UI Updates
- `updateRoomUI()` - Room counter UI updates

## State Moved to RoomManager

### Room State
- `currentRoom: number` - Current room number
- `totalRooms: number` - Total rooms for this run
- `isRoomCleared: boolean` - Room cleared flag
- `isTransitioning: boolean` - Transitioning between rooms

### Door State
- `doorSprite: Phaser.GameObjects.Sprite | null` - Door sprite
- `doorText: Phaser.GameObjects.Text | null` - "ENTER" text
- `doorCollider: Phaser.Physics.Arcade.Collider | null` - Door-player collision

### Endless Mode State
- `endlessWave: number` - Current wave in endless mode
- `endlessDifficultyMultiplier: number` - Difficulty multiplier (1.5^wave)

## Dependencies

### RoomManager Dependencies (via constructor)
- `scene: Phaser.Scene` - Scene reference
- `spawnManager: SpawnManager` - Query `getPendingSpawnCount()` for room clear check
- `enemies: Phaser.Physics.Arcade.Group` - Query `getChildren()` for active enemy count
- `goldPool: GoldPool` - Magnetic collection on room clear
- `healthPool: HealthPool` - Magnetic collection on room clear
- `isEndlessMode: boolean` - Mode flag

### Event Handlers (RoomManagerEventHandlers)
- `onRoomCleared(goldCollected, healthCollected)` - Room cleared with pickup amounts
- `onEndlessWave()` - Endless wave started
- `onVictory()` - All rooms completed
- `onSpawnEnemies(roomNumber)` - Request enemy spawning for new room
- `onPlayerHealed(amount)` - Player healed from health pickup collection

## Public API

```typescript
interface RoomManager {
  // State queries
  getCurrentRoom(): number
  getTotalRooms(): number
  isCleared(): boolean
  isInTransition(): boolean
  getEndlessWave(): number
  getEndlessDifficultyMultiplier(): number

  // Lifecycle
  initialize(): void
  checkRoomCleared(): void
  resetToRoom1(): void
  destroy(): void

  // UI
  updateRoomUI(): void
}
```

## Integration Pattern

### In GameScene
1. Initialize RoomManager in `create()` after SpawnManager (dependency)
2. Call `roomManager.initialize()` to reset state
3. Call `roomManager.updateRoomUI()` to sync UI
4. Replace direct room state access with `roomManager.getCurrentRoom()`, etc.
5. Call `roomManager.checkRoomCleared()` when enemies die
6. Implement event handlers to handle room manager events

### Example Integration
```typescript
// GameScene.ts
private roomManager!: RoomManager

create() {
  // ... initialize SpawnManager first ...

  // Initialize RoomManager
  this.roomManager = new RoomManager({
    scene: this,
    spawnManager: this.spawnManager,
    enemies: this.enemies,
    goldPool: this.goldPool,
    healthPool: this.healthPool,
    isEndlessMode: this.isEndlessMode,
    eventHandlers: {
      onRoomCleared: (gold, health) => {
        this.dropManager.addGoldEarned(gold)
        // Health already applied via onPlayerHealed callback
      },
      onEndlessWave: () => {
        // Endless wave started - no special handling needed
      },
      onVictory: () => {
        this.triggerVictory()
      },
      onSpawnEnemies: (roomNumber) => {
        this.spawnEnemiesForRoom()
      },
      onPlayerHealed: (amount) => {
        this.player.heal(amount)
        this.updatePlayerHealthUI(this.player)
      }
    }
  })

  this.roomManager.initialize()
  this.roomManager.updateRoomUI()
}

// Replace direct room state access
const room = this.roomManager.getCurrentRoom()
const total = this.roomManager.getTotalRooms()
```

## Benefits
1. **Separation of Concerns** - Room logic isolated from combat/ability systems
2. **Testability** - Room transitions can be unit tested
3. **Clarity** - Single source of truth for room state
4. **Maintainability** - Room logic changes contained to one file

## Next Steps (Not Completed)
1. Import RoomManager in GameScene
2. Initialize in `create()` after SpawnManager
3. Replace direct room state access with roomManager methods
4. Remove extracted methods from GameScene
5. Test with `pnpm run build && pnpm run lint`

## Files Modified
- ✅ Created `src/scenes/game/RoomManager.ts`
- ✅ Updated `src/scenes/game/index.ts` (added export)
- ⏳ TODO: Update `src/scenes/GameScene.ts` (integration)

## Build Status
- ✅ TypeScript compilation: PASSING
- ✅ ESLint: PASSING (0 warnings)
