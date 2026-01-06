# GameScene Refactoring Plan

**Goal:** Reduce GameScene from 3,624 lines to ~800 lines through aggressive system extraction

## Summary

Extract **7 major systems** from GameScene, consolidate **4+ scattered death handlers** into unified flow, extract **hero-specific abilities** to dedicated manager, and reorganize **479-line create()** into focused initialization methods.

**Target Result:**
- GameScene: ~800 lines (orchestration only)
- 7 New Systems: ~2,800 lines (focused responsibilities)
- Unified Death Handling: Single code path via DeathFlowManager
- Organized create(): 6 focused initialization methods

---

## Bug Fixes During Refactoring

### BUG #1: Inconsistent XP Rewards (WILL FIX)
**Current behavior:** Different kill sources award different base XP:
- Bullet kills: base=1 (normal), 10 (boss)
- DoT/Aura/Chainsaw kills: base=2 (normal), 10 (boss)

**Fix:** Unify to base=1 for all normal enemy kills. This was a copy-paste error.

### BUG #2: Inconsistent Fire Spread (WILL FIX)
**Current behavior:** Fire spread on death only triggers from CombatSystem kills (bullets, spirit cats, lightning). DoT/Aura/Chainsaw deaths do NOT spread fire.

**Fix:** Unify so ALL kill sources spread fire if the dying enemy was burning.

---

## Architecture Decision: Event Callbacks

**Decision:** CombatSystem will continue using event callbacks to communicate with GameScene, which then delegates to DeathFlowManager.

**Flow:**
```
CombatSystem.bulletHitEnemy()
  → enemy dies
  → CombatSystem emits onEnemyKilled(enemy, killInfo)
  → GameScene receives event
  → GameScene calls deathFlowManager.handleEnemyDeath(enemy, killInfo)
```

**Implication:** CombatSystem's `handleEnemyKilled()` must be **gutted** to only emit the event. All death logic (particles, shake, bloodthirst, XP, fire spread) moves to DeathFlowManager.

---

## System Dependency Diagram

**GameScene** (Orchestrator Only)
- `create()` → `initializeSystems()` → sets up all systems
- `update()` → delegates to each system's `update()`
- Receives ALL events from systems, routes to appropriate handlers

**Kill Event Emitters → DeathFlowManager:**
| System | Emits | Queries |
|--------|-------|---------|
| CombatSystem | `onEnemyKilled`, `onPlayerDamaged`, `onBossHealth` | - |
| HeroAbilityManager | `onEnemyKilled` | `getBoss()` |

**Data Owners:**
| System | Owns |
|--------|------|
| SpawnManager | `boss`, `wallGroup`, `pendingEnemySpawns` |
| DropManager | `goldEarned`, `killStats` |
| GameModeManager | `isEndless`, `endlessWave`, `isGameOver` |
| RoomManager | `currentRoom`, `isRoomCleared`, `isTransitioning` |

**Query Dependencies:**
- DeathFlowManager → `spawnManager.getBoss()` (for boss death particles)
- RoomManager → `spawnManager.getPendingSpawnCount()` (for room clear check)
- HeroAbilityManager → `spawnManager.getBoss()` (for targeting)

**Event Flow (Enemy Death):**
1. CombatSystem.bulletHitEnemy() → enemy.takeDamage() → enemy dies
2. CombatSystem emits `onEnemyKilled(enemy, killInfo)`
3. GameScene receives event
4. GameScene calls `deathFlowManager.handleEnemyDeath(enemy, killInfo)`
5. DeathFlowManager handles ALL death logic uniformly
6. DeathFlowManager emits `onRoomClearCheck`
7. GameScene routes to `roomManager.checkRoomCleared()`

**Query Pattern (No Caching):**
- Systems NEVER cache boss reference
- Always query: `spawnManager.getBoss()`
- Always check: `if (boss && boss.active)`

**UIScene Communication:**
- GameScene → `this.events.emit('updateXP', amount)`
- UIScene listens to GameScene events
- UIScene reference obtained via: `this.scene.get('UIScene')`

**Key Principles:**
- **Single Source of Truth**: SpawnManager owns boss, DeathFlowManager owns death logic
- **Event-Driven**: Systems emit events, GameScene routes them
- **Query-Based**: Cross-system data access via getter functions, never cached references
- **No Circular Deps**: Information flows downward, queries flow upward

---

## Systems to Extract

### 1. DropManager (~180 lines)
**File:** `src/scenes/game/DropManager.ts`

**Responsibilities:**
- Gold/health drop spawning
- Drop rate calculations
- Kill tracking for stats/achievements

**Methods to Move:**
- `spawnDrops()`, `recordKill()`, `getEnemyType()`, `calculateHealthPotionValue()`, `normalizeBossType()`

**State to Move:**
- `goldEarned`, `enemiesKilled`, `heroXPEarned`

**Dependencies:**
- `goldPool`, `healthPool` (passed in config)
- `player` (for health potion calculations)

---

### 2. DeathFlowManager (~300 lines)
**File:** `src/scenes/game/DeathFlowManager.ts`

**Current Problem:** Death handling scattered across 4+ locations with duplicated logic

**Responsibilities:**
- **Single entry point** for ALL enemy deaths (bullets, DOT, chainsaw, aura, spirit cat, lightning)
- Fire spread on death (NOW UNIFIED - all sources spread)
- Death particles and screen shake
- Haptic feedback
- Bloodthirst healing
- XP gain with multipliers (NOW UNIFIED - base=1 for all)
- Boss-specific handling (particles, UI hide)
- Enemy destruction and cache invalidation
- Room cleared check trigger
- Coordinates with DropManager for drops

**Methods to Create:**
```typescript
handleEnemyDeath(enemy: Enemy, killInfo: KillInfo): void  // Main entry point
private applyFireSpread(enemy: Enemy): void               // Spread to nearby if burning
private applyDeathEffects(enemy: Enemy, isBoss: boolean): void  // Particles, shake, haptics
private applyOnKillBonuses(enemy: Enemy, isBoss: boolean): void // Bloodthirst, XP
private cleanupEnemy(enemy: Enemy, isBoss: boolean): void // Destroy, cache, boss ref
```

**Consolidates (DELETE after migration):**
- `CombatSystem.handleEnemyKilled()` lines 615-651 → gut to event-only
- `GameScene.handleCombatEnemyKilled()` lines 1648-1669
- `GameScene.handleEnemyDOTDeath()` lines 3139-3187
- `GameScene.applyDamageAura()` death handling lines 2753-2794
- `GameScene.applyChainsawDamage()` death handling lines 2897-2938

**Interface:**
```typescript
interface KillInfo {
  source: 'bullet' | 'dot' | 'chainsaw' | 'aura' | 'spirit_cat' | 'lightning_chain'
  isBoss: boolean
  isCrit?: boolean
  wasOnFire: boolean      // For unified fire spread
  position: { x: number, y: number }  // For particle effects
}

interface DeathFlowConfig {
  scene: Phaser.Scene
  player: Player
  enemies: Phaser.Physics.Arcade.Group
  particles: ParticleManager
  screenShake: ScreenShake
  dropManager: DropManager
  eventHandlers: DeathFlowEventHandlers
}

interface DeathFlowEventHandlers {
  onRoomClearCheck: () => void           // Trigger room cleared check
  onBossKilled: () => void               // Clear boss ref, hide UI
  onXPGained: (xp: number) => void       // Update XP UI
  onPlayerHealed: (amount: number) => void // Update health UI
  onEnemyCacheInvalidate: () => void     // Invalidate nearest enemy cache
}
```

**UIScene Events Emitted:**
- DeathFlowManager does NOT emit to UIScene directly
- Uses `eventHandlers.onXPGained()` → GameScene → UIScene
- Uses `eventHandlers.onBossKilled()` → GameScene → UIScene.hideBossHealth

---

### 3. Slim Down CombatSystem (~845 → ~550 lines)
**File:** `src/scenes/game/CombatSystem.ts`

**Changes:**
1. **GUT `handleEnemyKilled()`** - Remove ALL logic, keep only event emission:
   ```typescript
   // BEFORE (lines 615-651): particles, shake, bloodthirst, XP, events
   // AFTER:
   private handleEnemyKilled(enemy: Enemy, isBoss: boolean, killInfo: KillInfo): void {
     this.eventHandlers.onEnemyKilled(enemy, killInfo)
   }
   ```

2. **Remove `applyDamageAura()`** (line 519) → moves to HeroAbilityManager

3. **Remove `spiritCatHitEnemy()`** (line 471) → moves to HeroAbilityManager

4. **Keep:**
   - `bulletHitEnemy()` - Collision, damage, piercing, bouncing
   - `bulletHitWall()` - Wall collision
   - `enemyBulletHitPlayer()` - Enemy projectile damage
   - `enemyHitPlayer()` - Enemy melee damage
   - `handleBombExplosion()` - Bomb AOE
   - `applyBulletStatusEffects()` - Status effect application
   - `applyLightningChain()` - Chain lightning (calls handleEnemyKilled on chain kills)
   - `applyKnockback()` - Knockback utility
   - `spreadFireOnDeath()` - Keep here, called by DeathFlowManager
   - Visual helpers (showHitFlash, drawLightningLine)

**Updated Event Interface:**
```typescript
interface CombatEventHandlers {
  onEnemyKilled: (enemy: Enemy, killInfo: KillInfo) => void  // Changed signature
  onPlayerDamaged: (damage: number) => void
  onPlayerHealed: (amount: number) => void
  onPlayerDeath: () => void
  onBossHealthUpdate: (health: number, maxHealth: number) => void
  // Removed: onBossKilled, onLevelUp, onXPGained (now in DeathFlowManager)
}
```

---

### 4. HeroAbilityManager (~450 lines)
**File:** `src/scenes/game/HeroAbilityManager.ts`

**Responsibilities:**
- Chainsaw orbit system (Helix passive)
- Spirit cats (Meowgik passive)
- Damage aura visual AND damage

**Methods to Move:**
- From GameScene: `updateChainsawOrbit()`, `applyChainsawDamage()`, `updateDamageAuraVisual()`, `updateSpiritCats()`, `spawnSpiritCat()`
- From CombatSystem: `applyDamageAura()` (line 519), `spiritCatHitEnemy()` (line 471)
- Remove duplicate `applyDamageAura()` from GameScene (line 3262)

**State to Move:**
- `chainsawSprites`, `chainsawOrbitAngle`, `lastChainsawDamageTime`, `chainsawHitEnemies`
- `damageAuraGraphics`, `lastAuraDamageTime`
- `spiritCatPool`, `spiritCatConfig`, `lastSpiritCatSpawnTime`
- All chainsaw/aura constants

**Kill Handling:**
When chainsaw/aura/spirit cat kills enemy:
```typescript
// In HeroAbilityManager
if (killed) {
  this.eventHandlers.onEnemyKilled(enemy, {
    source: 'chainsaw', // or 'aura' or 'spirit_cat'
    isBoss: this.isBoss(enemy),
    isCrit: false,
    wasOnFire: enemy.isOnFire(),
    position: { x: enemy.x, y: enemy.y }
  })
}
```

**Interface:**
```typescript
interface HeroAbilityConfig {
  scene: Phaser.Scene
  player: Player
  enemies: Phaser.Physics.Arcade.Group
  eventHandlers: HeroAbilityEventHandlers
}

interface HeroAbilityEventHandlers {
  onEnemyKilled: (enemy: Enemy, killInfo: KillInfo) => void
  getBoss: () => Boss | null  // Query, don't cache
}
```

---

### 5. SpawnManager (~600 lines) - MUST BE CREATED BEFORE RoomManager
**File:** `src/scenes/game/SpawnManager.ts`

**Responsibilities:**
- Enemy spawning for rooms
- Boss and mini-boss spawning
- Wave-based spawning with timers
- Enemy positioning and generation
- **Owns boss reference** (single source of truth)
- **Owns room generation state**
- **Owns wall group**
- **Owns pendingEnemySpawns** (queried by RoomManager for room clear check)

**Methods to Move:**
- `spawnEnemiesForRoom()`, `spawnBoss()`, `spawnMiniBoss()`, `spawnMinion()`
- `spawnEnemyFromPosition()`, `spawnEnemiesFromGeneration()`
- `enableWorldBoundsWhenOnScreen()`, `showBossNameAnnouncement()`
- `spawnEnemies()`, `cancelWaveTimers()`

**State to Move:**
- `boss`, `currentBossType`, `bossSpawnTime`
- `roomGenerator`, `currentGeneratedRoom`
- `pendingEnemySpawns`, `activeWaveTimers`
- `wallGroup` (created here, exposed for collision setup)
- Door spawn constants

**Public API:**
```typescript
class SpawnManager {
  // Boss state (single source of truth)
  getBoss(): Boss | null
  setBoss(boss: Boss | null): void
  isBoss(enemy: Enemy): boolean

  // Room generation
  getPendingSpawnCount(): number
  getWallGroup(): Phaser.Physics.Arcade.StaticGroup

  // Spawning
  spawnEnemiesForRoom(roomNumber: number): void
  spawnBoss(bossType: string): void
  cancelWaveTimers(): void
}
```

**UIScene Events Emitted:**
- `'showBossHealth'` - via eventHandlers
- `'updateBossHealth'` - via eventHandlers
- `'hideBossHealth'` - via eventHandlers (on boss death, triggered by DeathFlowManager)

---

### 6. RoomManager (~500 lines) - Depends on SpawnManager
**File:** `src/scenes/game/RoomManager.ts`

**Responsibilities:**
- Room transitions and door logic
- Room cleared detection
- Cleanup between rooms
- Room state management
- Magnetic drop collection on room clear

**Methods to Move:**
- `spawnDoor()`, `enterDoor()`, `transitionToNextRoom()`, `cleanupRoom()`
- `checkRoomCleared()`, `updateRoomUI()`
- `startNextEndlessWave()`, `showEndlessWaveNotification()`
- Magnetic collection logic (lines 1432-1441)

**State to Move:**
- `currentRoom`, `totalRooms`, `isRoomCleared`, `isTransitioning`
- `doorSprite`, `doorText`

**Dependencies:**
- Needs `pendingEnemySpawns` count from SpawnManager for room clear check
- Needs `enemies` group for active enemy count

**UIScene Events Emitted:**
- `'roomCleared'` - via eventHandlers
- `'endlessWave'` - via eventHandlers

---

### 7. GameModeManager (~500 lines)
**File:** `src/scenes/game/GameModeManager.ts`

**Responsibilities:**
- Endless mode wave progression
- Daily challenge mode logic
- Respawn system (one-time use)
- Victory/defeat conditions
- Run statistics

**Methods to Move:**
- `triggerVictory()`, `triggerGameOver()`
- `saveRoomStateForRespawn()`, `handleRespawn()`, `showRespawnEffect()`, `pushEnemiesAway()`
- `handleSkipRun()`

**State to Move:**
- `isEndlessMode`, `endlessWave`, `endlessDifficultyMultiplier`
- `isDailyChallengeMode`, `respawnUsed`, `runStartTime`
- `isGameOver`

---

## GameScene After Extraction (~800 lines)

### What Remains in GameScene:

**Core Orchestration (~150 lines)**
```typescript
create()     // Initialize all systems, set up collisions
update()     // Delegate to systems in correct order
shutdown()   // Cleanup all systems
```

**Initialization Methods (~350 lines)**
```typescript
registerEventListeners()   // ~80 lines - Event setup
initializeGameMode()       // ~60 lines - Mode detection, RNG seed
initializePools()          // ~50 lines - Pool creation
initializeSystems()        // ~80 lines - System instantiation
initializeCollisions()     // ~80 lines - Physics overlap setup
```

**Event Handlers (~150 lines)**
```typescript
handleDebugSkip()          // Debug functionality
handleVisibilityChange()   // Pause on tab switch
handleLevelUp()            // Show ability selection
handleCombatPlayerDeath()  // Trigger game over
// Event routing to systems
```

**UI Coordination (~100 lines)**
```typescript
updatePlayerHealthUI()     // Sync health bar
updateXPUI()               // Sync XP bar
// UIScene event emissions
```

**Remaining Getters/Utilities (~50 lines)**
```typescript
getDifficultyConfig()
getPlayer()
getEnemies()
// Pool accessors for systems
```

**Note:** Breaking up `create()` reorganizes code into methods, it doesn't reduce total lines. The 479 lines become 350 lines across 5 methods + 130 lines in create() orchestration = 480 lines. The benefit is readability and maintainability, not line count reduction.

---

## Migration Order (With Verification Checkpoints)

Execute in this sequence on a single branch with commits after each step.

### Step 1: DropManager (Lowest Dependencies)
1. Create `src/scenes/game/DropManager.ts`
2. Extract `spawnDrops()`, `recordKill()`, `getEnemyType()`, `calculateHealthPotionValue()`, `normalizeBossType()`
3. Move state: `goldEarned`, `enemiesKilled`, `heroXPEarned`
4. Update GameScene: `this.dropManager = new DropManager(config)`
5. Update all call sites: `this.dropManager.spawnDrops(enemy)`

**Verification Checkpoint:**
- [ ] `pnpm run build` passes
- [ ] `pnpm run lint` passes
- [ ] Kill 10 enemies, verify gold drops appear
- [ ] Kill boss, verify increased gold amount
- [ ] Health potion drops work (5% chance)
- [ ] Git commit: `refactor: extract DropManager from GameScene`

---

### Step 2: DeathFlowManager (Consolidates Death Handling)
1. Create `src/scenes/game/DeathFlowManager.ts`
2. Implement `handleEnemyDeath(enemy, killInfo)` with:
   - Fire spread check (call CombatSystem.spreadFireOnDeath if wasOnFire)
   - Death particles (boss vs normal)
   - Screen shake + haptics
   - Bloodthirst healing
   - XP calculation (UNIFIED: base=1 for normal, 10 for boss)
   - DropManager.spawnDrops() call
   - Enemy.destroy()
   - Cache invalidation
   - Room clear check trigger
3. Update GameScene to create DeathFlowManager
4. Update `handleCombatEnemyKilled()` to delegate to DeathFlowManager
5. Delete `handleEnemyDOTDeath()` - route through DeathFlowManager
6. Update DOT death handling in update() to use DeathFlowManager

**Verification Checkpoint:**
- [ ] `pnpm run build` passes
- [ ] `pnpm run lint` passes
- [ ] Bullet kills: particles, drops, XP work
- [ ] DOT kills (fire): particles, drops, XP work
- [ ] Bloodthirst healing works on kill
- [ ] Fire spreads on death (set enemy on fire, kill it, nearby enemies catch fire)
- [ ] Boss kill: special particles, UI hides, drops work
- [ ] Room clears after all enemies dead
- [ ] Git commit: `refactor: extract DeathFlowManager, unify death handling`

---

### Step 3: Gut CombatSystem
1. Modify `handleEnemyKilled()` to ONLY emit event with KillInfo
2. Remove particles, screen shake, bloodthirst, XP logic from CombatSystem
3. Update event handler signature: `onEnemyKilled(enemy, killInfo)`
4. GameScene receives event, calls `deathFlowManager.handleEnemyDeath()`
5. Update `applyLightningChain()` to use new KillInfo format

**Verification Checkpoint:**
- [ ] `pnpm run build` passes
- [ ] `pnpm run lint` passes
- [ ] Bullet kills still work end-to-end
- [ ] Lightning chain kills work (chain to 3 enemies)
- [ ] Spirit cat kills work (if Meowgik)
- [ ] No duplicate particles/effects on kill
- [ ] Git commit: `refactor: gut CombatSystem.handleEnemyKilled, delegate to DeathFlowManager`

---

### Step 4: HeroAbilityManager
1. Create `src/scenes/game/HeroAbilityManager.ts`
2. Extract chainsaw orbit: `updateChainsawOrbit()`, `applyChainsawDamage()`, state
3. Extract damage aura: `updateDamageAuraVisual()`, `applyDamageAura()`, state
4. Extract spirit cats: `updateSpiritCats()`, `spawnSpiritCat()`, `spiritCatHitEnemy()`, state
5. Remove duplicate `applyDamageAura()` from GameScene (line 3262)
6. Remove `applyDamageAura()` and `spiritCatHitEnemy()` from CombatSystem
7. Update GameScene `update()`: Call `heroAbilityManager.update(time, delta)`
8. Wire all kills to emit onEnemyKilled → GameScene → DeathFlowManager

**Verification Checkpoint:**
- [ ] `pnpm run build` passes
- [ ] `pnpm run lint` passes
- [ ] Helix chainsaw orbits and damages enemies
- [ ] Chainsaw kills trigger full death flow (particles, drops, XP)
- [ ] Damage aura visual renders correctly
- [ ] Damage aura kills trigger full death flow
- [ ] Meowgik spirit cats spawn and attack
- [ ] Spirit cat kills trigger full death flow
- [ ] Git commit: `refactor: extract HeroAbilityManager from GameScene and CombatSystem`

---

### Step 5: SpawnManager (BEFORE RoomManager - provides pendingSpawns query)
1. Create `src/scenes/game/SpawnManager.ts`
2. Extract spawning: `spawnEnemiesForRoom()`, `spawnBoss()`, `spawnMiniBoss()`, `spawnMinion()`
3. Extract generation: `spawnEnemyFromPosition()`, `spawnEnemiesFromGeneration()`
4. Move boss state: `boss`, `currentBossType`, `bossSpawnTime`
5. Move generation state: `roomGenerator`, `currentGeneratedRoom`, `pendingEnemySpawns`, `activeWaveTimers`
6. Move `wallGroup` creation and ownership
7. Expose `getBoss()`, `getPendingSpawnCount()`, `getWallGroup()`
8. Update all systems to use `spawnManager.getBoss()`
9. GameScene temporarily handles room clear check (moved to RoomManager in Step 6)

**Verification Checkpoint:**
- [ ] `pnpm run build` passes
- [ ] `pnpm run lint` passes
- [ ] Enemies spawn correctly in room 1
- [ ] Wave-based spawning works (enemies spawn in waves)
- [ ] Boss spawns with announcement
- [ ] Mini-boss spawns correctly
- [ ] Boss health bar shows/updates/hides
- [ ] Wall collisions work (bullets hit walls)
- [ ] Git commit: `refactor: extract SpawnManager from GameScene`

---

### Step 6: RoomManager (After SpawnManager - can now query pendingSpawns)
1. Create `src/scenes/game/RoomManager.ts`
2. Extract door logic: `spawnDoor()`, `enterDoor()`
3. Extract transitions: `transitionToNextRoom()`, `cleanupRoom()`
4. Extract room state: `currentRoom`, `totalRooms`, `isRoomCleared`, `isTransitioning`
5. Extract room clear: `checkRoomCleared()` (queries SpawnManager for pending spawns)
6. Extract endless: `startNextEndlessWave()`, `showEndlessWaveNotification()`
7. Move magnetic collection logic
8. Update all GameScene references to use `roomManager.*`

**Verification Checkpoint:**
- [ ] `pnpm run build` passes
- [ ] `pnpm run lint` passes
- [ ] Door spawns after room clear
- [ ] Door interaction transitions to next room
- [ ] Room counter UI updates correctly
- [ ] Cleanup removes bullets, resets state
- [ ] Endless mode waves progress
- [ ] Magnetic collection works on room clear
- [ ] Git commit: `refactor: extract RoomManager from GameScene`

---

### Step 7: GameModeManager
1. Create `src/scenes/game/GameModeManager.ts`
2. Extract victory/defeat: `triggerVictory()`, `triggerGameOver()`
3. Extract respawn: `saveRoomStateForRespawn()`, `handleRespawn()`, `showRespawnEffect()`, `pushEnemiesAway()`
4. Extract mode state: `isEndlessMode`, `endlessWave`, `isDailyChallengeMode`, `respawnUsed`
5. Extract skip: `handleSkipRun()`
6. Move `isGameOver` ownership

**Verification Checkpoint:**
- [ ] `pnpm run build` passes
- [ ] `pnpm run lint` passes
- [ ] Victory triggers after final boss
- [ ] Game over triggers on player death
- [ ] Respawn works (once only)
- [ ] Endless mode difficulty scaling works
- [ ] Skip run works in debug
- [ ] Git commit: `refactor: extract GameModeManager from GameScene`

---

### Step 8: Break Up create()
1. Extract `registerEventListeners()` - all event.on() calls
2. Extract `initializeGameMode()` - mode detection, RNG, stats reset
3. Extract `initializePools()` - bullet, gold, health pool creation
4. Extract `initializeSystems()` - all system instantiation
5. Extract `initializeCollisions()` - physics.add.overlap() setup
6. Update `create()` to call these methods

**Verification Checkpoint:**
- [ ] `pnpm run build` passes
- [ ] `pnpm run lint` passes
- [ ] Game starts correctly
- [ ] All systems initialize
- [ ] Collisions work
- [ ] Git commit: `refactor: break up GameScene.create() into focused methods`

---

### Step 9: Final Cleanup
1. Remove unused fields from GameScene
2. Remove unused imports
3. Add JSDoc comments to public system APIs
4. Run: `pnpm run lint` (must pass with 0 warnings)
5. Run: `pnpm run build` (must pass with 0 errors)

**Verification Checkpoint:**
- [ ] `pnpm run build` passes
- [ ] `pnpm run lint` passes
- [ ] Full game playthrough: start → 5 rooms → boss → victory
- [ ] All heroes work (test Helix chainsaw, Meowgik cats)
- [ ] All kill types work (bullets, DOT, chainsaw, aura, spirit cat, lightning)
- [ ] Endless mode works
- [ ] No console errors
- [ ] Git commit: `refactor: cleanup GameScene, remove dead code`

---

### Step 10: Update Documentation
1. Update `CLAUDE.md` with GameScene architecture guidelines
2. Update `game_plan.md` with system responsibilities
3. Document the extraction pattern for future systems

**Add to CLAUDE.md (Architecture Overview section):**
```markdown
### GameScene System Architecture

GameScene is an **orchestrator only** (~800 lines max). All gameplay logic lives in dedicated systems under `src/scenes/game/`:

| System | Responsibility | Lines |
|--------|----------------|-------|
| `CombatSystem` | Damage calculations, collisions, status effects | ~550 |
| `DeathFlowManager` | Unified enemy death handling | ~300 |
| `InputSystem` | Keyboard + joystick input | ~300 |
| `AbilitySystem` | Ability selection and application | ~250 |
| `DropManager` | Gold/health drops, kill tracking | ~180 |
| `HeroAbilityManager` | Chainsaw, spirit cats, damage aura | ~450 |
| `RoomManager` | Room transitions, doors, cleanup | ~500 |
| `SpawnManager` | Enemy/boss spawning, waves, walls | ~600 |
| `GameModeManager` | Endless mode, victory/defeat, respawn | ~500 |

**Death Flow (Single Path):**
All enemy deaths → DeathFlowManager.handleEnemyDeath() → unified particles, XP, drops, cleanup

**Boss State:**
SpawnManager owns boss reference. Other systems query via spawnManager.getBoss()

**Rules for GameScene:**
- GameScene ONLY orchestrates systems - no direct gameplay logic
- New features go in existing systems or new dedicated systems
- If adding code to GameScene, ask: "Which system should own this?"
- GameScene should never exceed 1000 lines

**Adding New Systems:**
1. Create `src/scenes/game/NewSystem.ts`
2. Follow the SystemConfig + EventHandlers pattern
3. Initialize in GameScene's `initializeSystems()`
4. Export from `src/scenes/game/index.ts`
```

**Git commit:** `docs: add GameScene architecture guidelines to CLAUDE.md`

---

## Critical Files to Modify

1. **`src/scenes/GameScene.ts`** - Main refactoring target (3,624 → ~800 lines)
2. **`src/scenes/game/CombatSystem.ts`** - Gut handleEnemyKilled (~845 → ~550 lines)
3. **`src/scenes/game/DeathFlowManager.ts`** (NEW) - Unified death handling (~300 lines)
4. **`src/scenes/game/DropManager.ts`** (NEW) - Drop spawning (~180 lines)
5. **`src/scenes/game/HeroAbilityManager.ts`** (NEW) - Hero abilities (~450 lines)
6. **`src/scenes/game/RoomManager.ts`** (NEW) - Room flow (~500 lines)
7. **`src/scenes/game/SpawnManager.ts`** (NEW) - Spawning + walls (~600 lines)
8. **`src/scenes/game/GameModeManager.ts`** (NEW) - Game modes (~500 lines)
9. **`CLAUDE.md`** - Architecture guidelines (Step 10)

---

## System Extraction Pattern (Template)

All new systems follow this pattern:

```typescript
import Phaser from 'phaser'
import { Player } from '../../entities/Player'
import { Enemy } from '../../entities/Enemy'

// 1. Config interface - all dependencies injected
export interface SystemConfig {
  scene: Phaser.Scene
  player: Player
  enemies: Phaser.Physics.Arcade.Group
  // Other dependencies...
  eventHandlers: SystemEventHandlers
}

// 2. Event handlers interface - callbacks to parent
export interface SystemEventHandlers {
  onSomethingHappened: (data: DataType) => void
  // Query methods for data owned by other systems
  getBoss: () => Boss | null
}

// 3. System class
export class System {
  private scene: Phaser.Scene
  private player: Player
  private enemies: Phaser.Physics.Arcade.Group
  private eventHandlers: SystemEventHandlers

  constructor(config: SystemConfig) {
    this.scene = config.scene
    this.player = config.player
    this.enemies = config.enemies
    this.eventHandlers = config.eventHandlers
  }

  update(time: number, delta: number): void {
    // System logic
    // Emit events: this.eventHandlers.onSomethingHappened(data)
    // Query other systems: const boss = this.eventHandlers.getBoss()
  }

  destroy(): void {
    // Cleanup graphics, timers, etc.
  }
}

export default System
```

**Key Principles:**
- Single Responsibility - one reason to change
- Dependency Injection - all deps via config
- Event-Driven Communication - emit events, don't call parent directly
- Query, Don't Cache - get fresh data via eventHandlers getters
- Type Safety - interfaces for all contracts

---

## Risk Mitigation

**Risk 1: Boss state management**
- Boss reference needed by multiple systems
- **Solution:** SpawnManager owns boss state, provides `getBoss()` getter. Other systems query, never cache.

**Risk 2: Circular dependencies**
- Systems may need to call each other
- **Solution:** Use event handlers for actions, query functions for data. No direct system-to-system calls.

**Risk 3: Death handler race conditions**
- Multiple damage sources could kill same enemy in same frame
- **Solution:** Enemy.takeDamage() returns true only once (health check). DeathFlowManager receives single death event.

**Risk 4: State synchronization**
- Systems may have stale references after cleanup
- **Solution:** Query managers via eventHandlers, don't store references. Check `enemy.active` before operations.

**Risk 5: Performance overhead**
- More systems = more function calls per frame
- **Solution:** Batch operations where possible. Monitor with performance profiler. Accept small overhead for maintainability.

**Risk 6: Breaking mid-refactor**
- Large refactor could leave code in broken state
- **Solution:** Linear commits after each step. Each step must pass build+lint. Can revert individual commits if needed.

---

## Success Metrics

1. **Line Count:**
   - GameScene: ~800 lines (down from 3,624)
   - CombatSystem: ~550 lines (down from 845)
   - 7 new systems: ~3,030 lines total
   - Total: ~4,380 lines (up from ~4,470, but properly distributed)

2. **Death Handling:**
   - Single code path for ALL enemy deaths
   - Unified XP calculation (base=1)
   - Unified fire spread (all sources)
   - No duplicated logic

3. **Code Quality:**
   - 0 lint warnings
   - 0 TypeScript errors
   - Clear system boundaries
   - Documented interfaces

4. **Maintainability:**
   - Each system has single responsibility
   - New features have obvious home
   - Easy to understand in isolation

---

## Post-Refactoring Benefits

1. **Easier debugging** - Isolated systems, clear data flow
2. **Faster feature development** - Know where to add code
3. **Better code reuse** - Systems portable to other scenes
4. **Simpler onboarding** - Understand one system at a time
5. **Performance monitoring** - Profile systems independently
6. **Safer refactoring** - Changes isolated to single system
7. **Consistent behavior** - Unified death handling fixes bugs
