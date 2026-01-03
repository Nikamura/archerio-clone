# Arrow Game: Complete Development Plan

This roguelike shooter succeeds through a deceptively simple core mechanic: **stop to shoot, move to dodge**. This creates a fundamental tension between offense and defense that drives the entire game experience. This plan structures development into three fully playable versions, each complete and polished before moving forward.

## The core loop that makes Arrow Game work

The game's brilliance lies in splitting control: the player handles movement via virtual joystick while the game handles aiming and shooting automatically. When the player releases the joystick to stop moving, their character auto-fires at the nearest enemy. This creates **100+ micro-decisions per minute**—every moment of stillness is a calculated risk. According to design analyses, this mechanic achieves "the right amount of control and agency" while remaining "truly hyper-casual."

The roguelike layer compounds this with run-based ability selection. Every level-up presents three random abilities (multishot, ricochet, elemental damage), and smart combinations create exponential power growth. Players who die lose their abilities but keep permanent progression—equipment, hero levels, and talent upgrades persist. This dual-loop (run-based skills + permanent meta-progression) drives both session engagement and long-term retention.

---

## Technical foundation: Phaser.js architecture

**Recommended stack:**
- **Engine:** Phaser 3.6+ with Arcade Physics (significantly faster than Matter.js for this genre)
- **Touch controls:** Native Phaser Graphics for virtual joystick
- **ECS (optional):** bitECS for 1000+ entity management, though standard OOP works for MVP
- **Build:** Vite or Webpack with tree-shaking

**Critical performance requirements:**
- Object pooling for all bullets, enemies, and particles (pre-allocate 100+ bullets)
- Single texture atlas under 4096x4096 for mobile compatibility
- Target 60 FPS desktop, 30-60 FPS mobile
- Under 100 draw calls per frame

```javascript
// Core pattern: Object pool for bullets
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

---

## Asset Generation Scripts

The project includes AI-powered scripts for generating game art assets using Google's Gemini API. All generated assets have transparent backgrounds (PNG) and are optimized for game use.

**Requirements:**
- Set `GEMINI_API_KEY` in `.env` file
- Optionally set `GEMINI_MODEL` (default: `gemini-2.0-flash-exp`)

### Generic Image Generation

```bash
pnpm run generate-image <prompt> [width] [height] [--output <path>]
```

Use for backgrounds, UI elements, and non-sprite assets:

```bash
# Examples
pnpm run generate-image "dark dungeon stone floor texture" 512 512
pnpm run generate-image "forest background parallax layer" 1024 768
pnpm run generate-image "treasure chest icon" 64 64 --output assets/ui/chest.png
```

### Sprite Generation

```bash
pnpm run generate-sprite <description> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--type, -t` | Sprite type: `player`, `enemy`, `boss`, `projectile`, `item`, `effect`, `ui`, `generic` |
| `--size, -s` | Sprite size in pixels (default varies by type) |
| `--style` | Art style: `"pixel art"`, `"hand-drawn"`, `"vector"` (default: pixel art) |
| `--output, -o` | Output file/directory path |
| `--anim, -a` | Animation type for multi-frame generation |
| `--frames, -f` | Number of animation frames |
| `--clean, -c` | **Recommended:** Remove background for true PNG transparency |

**Sprite Types & Default Sizes:**
| Type | Size | Use Case |
|------|------|----------|
| `player` | 64px | Hero characters |
| `enemy` | 64px | Standard enemies |
| `boss` | 128px | Boss enemies |
| `projectile` | 32px | Bullets, arrows, spells |
| `item` | 32px | Collectibles, pickups |
| `effect` | 64px | Visual effects, particles |
| `ui` | 48px | Interface icons |

**Single Sprite Examples:**
```bash
pnpm run generate-sprite "archer with bow" --type player --clean
pnpm run generate-sprite "red slime monster" --type enemy --clean
pnpm run generate-sprite "golden arrow" --type projectile -c
pnpm run generate-sprite "health potion" --type item --clean
pnpm run generate-sprite "fire dragon" --type boss --size 128 -c
```

### Animation Sequences

Generate multiple frames for animated sprites:

**Animation Types & Default Frames:**
| Animation | Frames | Description |
|-----------|--------|-------------|
| `idle` | 4 | Breathing/subtle movement |
| `walk` | 6 | Walking cycle |
| `run` | 6 | Running cycle |
| `attack` | 4 | Attack swing/action |
| `hit` | 3 | Damage reaction |
| `death` | 4 | Death sequence |
| `cast` | 4 | Spell casting |
| `jump` | 4 | Jump arc |

**Animation Examples:**
```bash
# Generate walk animation for player (6 frames) with clean backgrounds
pnpm run generate-sprite "knight warrior" --type player --anim walk --clean

# Generate idle animation for enemy (4 frames)
pnpm run generate-sprite "green slime" --type enemy --anim idle -c

# Generate attack animation with custom frame count
pnpm run generate-sprite "wizard" --type player --anim attack --frames 6 --clean

# Generate death animation
pnpm run generate-sprite "skeleton" --type enemy --anim death -c
```

Animation frames are saved to: `assets/sprites/<type>/<name>_<anim>_<timestamp>/frame_XX.png`

### Background Removal (Standalone)

For existing images with checkerboard/solid backgrounds:

```bash
pnpm run remove-bg <image-path> [--tolerance <0-255>] [--output <path>]
```

**Examples:**
```bash
# Remove background from single image
pnpm run remove-bg assets/sprites/enemy/slime.png

# Process multiple images with glob pattern
pnpm run remove-bg "assets/sprites/player/*.png" --tolerance 40

# Custom output path
pnpm run remove-bg image.png --output clean.png
```

The tolerance option (default: 35) controls how aggressively similar colors are removed. Higher values remove more.

### Asset Organization

Generated assets are automatically organized:
```
assets/
├── generated/           # Generic images
├── sprites/
│   ├── player/          # Player sprites & animations
│   ├── enemy/           # Enemy sprites & animations
│   ├── boss/            # Boss sprites & animations
│   ├── projectile/      # Bullet/arrow sprites
│   ├── item/            # Collectible sprites
│   ├── effect/          # Visual effect sprites
│   └── ui/              # UI icons
```

### Best Practices

1. **Always use `--clean`**: AI generates fake checkerboard backgrounds, use `--clean` or `-c` for true transparency
2. **Consistency**: Generate all sprites for a character type in one session to maintain visual consistency
3. **Naming**: Use descriptive prompts that include key visual features
4. **Review**: AI generation can vary - regenerate if needed
5. **Animation**: For smooth animations, generate more frames and remove duplicates
6. **Style**: Specify art style consistently across all assets (e.g., always use "pixel art")

---

## MVP: Minimum playable core loop

**Goal:** A complete, fun 5-minute game session demonstrating the stop-to-shoot mechanic with basic progression. A player should be able to pick it up, understand it instantly, and want to play again.

### MVP features (4-6 weeks solo development)

**Core movement and combat:**
- Virtual joystick spawns at touch point (entire left half of screen)
- Player auto-fires when stationary, stops firing when moving
- Auto-aim targets nearest enemy with simple distance calculation
- Single weapon type: basic bow with moderate speed
- Projectiles use object pooling with off-screen recycling

**Nine enemy archetypes:**
| Enemy | Behavior | Attack |
|-------|----------|--------|
| Melee Rusher | Moves directly toward player | Contact damage |
| Ranged Shooter | Stops periodically, fires at player | Single projectile with red telegraph line |
| Spreader | Stationary, fires 4-direction pattern | Slow projectiles |
| Charger | Normal speed, then dashes at player | High contact damage during charge (2.5x), stunned after |
| Bomber | Medium speed, keeps distance | Throws AOE bombs that explode after 1.5s with warning circle |
| Tank | Very slow, 3x health, large (48x48) | 8-way spread shot with charge-up animation |
| Burrower | Burrows underground, surfaces near player | Spread attack on surfacing (6 projectiles) |
| Healer | Stays away from player, heals nearby allies | Heals 10 HP to nearby enemies every 3s |
| Spawner | Stationary, high health | Spawns up to 3 weak minion enemies |

**Level structure:**
- 10 rooms per run (linear progression)
- Room-based: clear all enemies → door opens → next room
- Room 5: Angel choice (heal 30% HP OR gain ability)
- Room 10: Boss fight (larger enemy with 3 attack patterns)
- Run ends on death or boss defeat

**Ability system (simplified):**
- Level up every 10 kills (3 level-ups per run typical)
- Choose from 3 abilities per level-up
- **MVP ability pool (8 abilities):**
  - Front Arrow +1 (-25% damage)
  - Multishot (-15% attack speed)
  - Attack Speed Boost (+25%)
  - Attack Boost (+30%)
  - Piercing Shot (through enemies, -33% per enemy)
  - Ricochet (bounces 3x between enemies)
  - Fire Damage (18% weapon damage over 2 seconds)
  - Crit Boost (+10% crit chance, +40% crit damage)

**Basic HUD:**
- Health bar (top-left, green → red)
- XP bar (below health)
- Room counter (top-center: "3/10")
- Pause button (top-right)
- Boss health bar (full-width, appears in boss room)

**MVP UI screens:**
- Main menu: Play button, difficulty selection (Easy/Normal/Hard), settings toggle
- Level-up modal: 3 ability cards, darkened background
- Death screen: "Try Again" button, basic stats (rooms cleared, enemies killed)
- Victory screen: Run complete message, restart button

**Difficulty selection:**
- **Easy**: Beginner-friendly with +50% player health (150 HP), +20% player damage and attack speed, -30% enemy health, -25% enemy damage, -20% enemy spawns, -40% boss health, -25% boss damage
- **Normal**: Balanced challenge with standard stats (100 HP, base damage/speed, normal enemy stats)
- **Hard**: For veterans with -20% player health (80 HP), -10% player damage and attack speed, +40% enemy health, +30% enemy damage, +30% enemy spawns, +50% boss health, +30% boss damage

**Procedural generation (minimal):**
- 5 hand-crafted room layouts per room type (combat, boss)
- Random enemy spawn positions within layouts
- Weighted random ability selection
- Seeded randomness for reproducibility

**What MVP deliberately excludes:**
No equipment, no persistent progression, no currencies, no hero selection, no ads, no complex menus. The MVP tests whether the core loop is fun.

### MVP technical checklist

```
[x] Phaser 3 project setup with Arcade Physics
[x] Scene management: MainMenu, Game, GameOver, LevelUp (Boot, Preloader, MainMenu, Game, UI, LevelUp)
[x] Player controller with joystick input (native Phaser joystick + keyboard fallback with WASD support)
[x] Auto-aim + auto-fire system (fires at nearest enemy when stationary)
[x] Bullet pool (100 bullets)
[x] Enemy bullet pool (100 enemy bullets)
[x] 6 enemy AI behaviors (melee rusher, ranged shooter, spreader, burrower, healer, spawner)
[x] Collision detection (player/enemy, bullet/enemy, enemy-bullet/player)
[x] Automated visual testing with Puppeteer
[x] Room system with door transitions
[x] XP/leveling system (level up every 10 kills)
[x] Ability selection modal (LevelUpScene with 3 random choices)
[x] 4 working abilities with stacking (Front Arrow, Multishot, Attack Speed, Attack Boost)
[x] 4 more abilities (Piercing, Ricochet, Fire Damage, Crit Boost)
[x] Boss with 3 attack patterns (spread, barrage, charge)
[x] Health system with damage feedback (UI update needed)
[x] Difficulty selection (Easy/Normal/Hard with stat modifiers)
[x] Basic audio (shoot, hit, level-up, death)
[x] Touch controls working on mobile browsers (virtual joystick implemented)
[x] 60 FPS on desktop (tested via Puppeteer)
```

**CURRENT STATUS (2026-01-01):**
- ✅ Basic project structure with TypeScript + Vite
- ✅ Core "stop to shoot, move to dodge" mechanic working
- ✅ Virtual joystick controls (mobile ready, Y-axis fixed) + WASD/arrow keyboard controls
- ✅ Nine enemy types: Melee, Ranged Shooter, Spreader, Charger, Bomber, Tank, Burrower, Healer, Spawner
- ✅ Auto-aim targeting nearest enemy
- ✅ Enemy bullet system with collision
- ✅ Player damage system (enemy melee + bullets)
- ✅ Real-time health bar UI updates
- ✅ Portrait mode (375x667) optimized for mobile
- ✅ Precise hitbox collision detection
- ✅ Puppeteer automated testing with screenshots
- ✅ Game over screen with death detection, kill tracking, and restart
- ✅ Room system with 10 rooms, door transitions, and victory screen
- ✅ Room progression with scaling difficulty
- ✅ **XP/Leveling system** - Level up every 10 kills with XP bar UI
- ✅ **Ability selection modal** - LevelUpScene with 3 random ability cards (using Container for proper click handling)
- ✅ **16 abilities implemented** - All MVP abilities + 8 new V1 abilities complete:
  - Front Arrow (+1 projectile, -25% damage per level)
  - Multishot (side arrows at 45°, -15% attack speed per level)
  - Attack Speed (+25% multiplicative)
  - Attack Boost (+30% damage multiplicative)
  - Piercing Shot (arrows pass through enemies, -33% damage per enemy)
  - Ricochet (arrows bounce 3x between enemies per level)
  - Fire Damage (+18% DOT over 2 seconds, additive stacking)
  - Crit Boost (+10% crit chance additive, +40% crit damage multiplicative)
  - **New V1 Abilities (2026-01-01):**
  - Ice Shot (15% freeze chance per level, 1.5s freeze duration, blue tint)
  - Poison Shot (5% DOT per second for 4s, stacks up to 5x, green tint)
  - Lightning Chain (chains to 2 nearby enemies per level, 50% damage, 150px range)
  - Diagonal Arrows (+2 arrows at 30° angles per level, 80% damage)
  - Rear Arrow (+1 backwards arrow per level, 70% damage)
  - Bouncy Wall (2 wall bounces per level, full damage on bounces)
  - Bloodthirst (+2 HP heal per kill per level, red flash visual)
  - Rage (+5% damage per 10% missing HP per level, scales dynamically)
- ✅ **Ability stacking** - Multiple selections of same ability compound effects correctly
- ✅ **Boss fight** - Room 10 boss with 3 attack patterns:
  - Spread Shot: 8 projectiles in circular pattern (2 waves)
  - Barrage: Telegraph for 0.8s, then fire 3 fast projectiles at player
  - Charge: Wind up with visual warning, then dash at player
  - 200 HP (10 XP reward), boss health bar UI at bottom of screen
- ✅ **Simplified ability selection** - Large vertically-stacked buttons for reliable touch input
- ✅ **Advanced ability effects** (2026-01-01):
  - Piercing: Bullets track hit count, pass through enemies if piercingLevel > 0
  - Ricochet: Bullets redirect to nearest enemy after hit, up to maxBounces times
  - Fire DOT: Enemies burn with orange tint, tick damage every 500ms for 2 seconds
  - Critical hits: Yellow tinted bullets deal increased damage (visual feedback)
  - All effects work with Front Arrow, Multishot, Diagonal, and Rear Arrow projectiles
  - **New V1 Ability Effects (2026-01-01):**
  - Freeze: Enemies can't move or attack for 1.5s, blue tint visual, effect priority system
  - Poison DOT: Stacking damage (up to 5 stacks), 1 tick/second for 4s, green tint visual
  - Lightning Chain: Damages 2 nearby enemies per level at 50% damage, 150px max range
  - Diagonal/Rear Arrows: Additional projectiles at fixed angles with damage reduction
  - Wall Bounce: Bullets reflect off walls up to N times, maintaining full damage
  - Bloodthirst: Heals player on any kill (bullet, fire, poison, or lightning chain)
  - Rage: Dynamic damage scaling based on current missing HP percentage
- ✅ **Enemy health bars** - Small health bars appear above enemies when damaged (hidden at full HP)
  - Color changes: green (>50%) → yellow (25-50%) → red (<25%)
  - Follows enemy movement, auto-hides when enemy dies or resets
- ✅ **New enemy types** (2026-01-01):
  - **Charger**: Fast dash attack enemy with telegraph
    - Normal speed until charging, then very fast (350 speed)
    - Wind-up phase (0.7s): Shakes, flashes red/cyan, shows direction line
    - Charge phase (0.6s): Dashes toward player position, leaves trail
    - Stunned phase (0.8s): Briefly stunned after charge (wobble effect)
    - 2.5x contact damage during charge, normal otherwise
    - Appears in mid-early rooms (room 3+)
  - **Bomber**: AOE bomb-throwing enemy
    - Medium speed, maintains 120-220px distance from player
    - Throws bombs that land and explode after 1.5s fuse time
    - Warning circle shows explosion radius (60px) before detonation
    - Explosion animation with expanding circle
    - Player knockback on hit
    - Appears in mid-late rooms (room 5+)
  - **Tank**: Slow, heavily armored 8-way spread shooter
    - Very slow movement (30 speed), 3x normal health
    - Larger sprite (48x48 vs normal 32x32)
    - Charge-up attack (0.8s): Purple-to-red tint with pulse
    - Fires 8 projectiles in all directions simultaneously
    - Higher contact damage (1.5x normal)
    - Appears in late rooms (room 7+)
  - **Burrower**: Burrows underground (alpha 0.3, no collision), surfaces near player to attack
    - Fires 6-projectile spread attack on surfacing
    - Invulnerable while burrowed, dust particles when burrowing/surfacing
    - Appears in mid-rooms (room 3+)
  - **Healer**: Low health support enemy that stays away from player
    - Heals 10 HP to all enemies within 150px range every 3 seconds
    - Green healing aura visual, particles on heal
    - Priority target for players
  - **Spawner**: Stationary high-health enemy that creates minions
    - Spawns up to 3 weak minion enemies every 4 seconds
    - Purple spawn aura, visual pulse on spawn
    - When spawner dies, all its minions die too
    - Minions: 30% HP, 50% damage, fast movement
    - Appears in late rooms (room 6+)
  - Enemy group integration for healing and spawning mechanics
  - BombPool and BombProjectile for bomber AOE attacks
- ✅ **Difficulty selection** (2026-01-01):
  - Three difficulty modes: Easy, Normal, Hard
  - Easy: +50% player HP, +20% damage/speed, -30% enemy HP, -25% enemy damage, -20% spawns
  - Hard: -20% player HP, -10% damage/speed, +40% enemy HP, +30% enemy damage, +30% spawns
  - Difficulty persists across runs (saved in game registry)
- ✅ **Audio system** (2026-01-01):
  - Web Audio API synthesis - no external audio files needed
  - All sounds generated at runtime using oscillators
  - Sounds: shoot, hit, player_hit, level_up, ability_select, room_clear, death, victory, menu_select, game_start
  - Integrated into all game events: shooting, damage, level-up, room completion, game over
- ✅ **Haptic feedback system** (2026-01-01):
  - HapticManager (src/systems/HapticManager.ts) using Web Vibration API
  - Graceful fallback for unsupported browsers
  - Vibration patterns for game events:
    - `light` (10ms): collecting gold/items, enemy death
    - `medium` (25ms): shooting arrows
    - `heavy` (50ms): taking damage
    - `bossHit` (40ms): hitting the boss
    - `death` ([100, 50, 100]ms): player death
    - `levelUp` ([50, 30, 50, 30, 100]ms): level up celebration
  - Toggleable via `hapticManager.enabled` property
  - iOS Safari requires user interaction first (joystick touch satisfies this)
- ✅ ESLint + TypeScript build passing
- ✅ 92 unit tests passing with high coverage
- ✅ **Seeded runs system** (2026-01-01):
  - `src/systems/SeededRandom.ts`: Deterministic PRNG using Mulberry32 algorithm
    - `random()` - Returns 0-1 like Math.random()
    - `randomInt(min, max)` - Integer in range [min, max]
    - `pick(array)` / `weightedPick(items, weights)` - Array selection
    - `getSeedString()` - Base-36 encoded seed for display/sharing
    - `parseSeed(input)` - Parse user seed input to number
  - RoomGenerator integration:
    - All randomness uses seeded RNG (layout selection, enemy combos, spawn positions)
    - `setRng(SeededRandom)` to inject seed at run start
  - Boss selection uses seeded RNG via `getRandomBossForChapter(chapterId, rng)`
  - MainMenuScene:
    - "Enter Seed" button below PLAY opens modal dialog
    - Custom seed persists via `game.registry` to GameScene
    - Shows current seed if set (cyan color)
  - GameOverScene:
    - Seed displayed with copy-to-clipboard functionality
    - "Tap to copy" hint, green flash on copy
    - Uses Clipboard API with fallback
  - Same seed = same enemy types, positions, boss selection
  - Players can share seeds to challenge friends to identical runs
- 🚧 Dev server running at http://localhost:3000/

**TESTING:**

```bash
# Unit tests (no server required)
pnpm run test              # Run all unit tests once
pnpm run test:watch        # Run tests in watch mode
pnpm run test:coverage     # Run tests with coverage report

# Visual/E2E tests (requires dev server running)
pnpm run dev               # Start dev server first (in another terminal)
pnpm run test:visual       # Puppeteer visual tests via Vitest

# Full test suite
pnpm run test:all          # Run all tests (unit + visual)
```

Coverage reports are generated in `coverage/` directory (HTML report at `coverage/index.html`).
Visual test screenshots are saved to `test/screenshots/`

**Unit-testable Game Logic:**
- `src/systems/PlayerStats.ts` - Pure game logic (86 tests, ~98% coverage)
  - Health system: damage, death detection, invincibility
  - Ability stacking: All 8 abilities with correct penalty/bonus calculations
  - Leveling: XP accumulation, level-up triggers
  - Stat calculations with ability penalties (Front Arrow damage reduction, Multishot attack speed reduction)
  - Piercing damage: 33% reduction per enemy hit
  - Fire DOT: Calculated based on current weapon damage
  - Critical hits: Roll chance, damage multipliers, combination with other abilities

**KNOWN BUGS:**
1. ✅ **Map too large** - FIXED: Changed from 800x600 to 375x667 (portrait mode, iPhone SE size)
2. ✅ **Enemy hitbox too large** - FIXED: Reduced enemy collision circle from 15px to 10px, bullets set to 4-5px radius
3. ✅ **Player hitpoints not decreasing** - FIXED: Added player-enemy collision (5 damage), enemy bullets now damage player (10 damage), UI health bar updates in real-time
4. ✅ **No game over when player dies** - FIXED: Added GameOverScene with death screen, kill tracking, and "Try Again" button to restart
5. ✅ **Player dies too fast** - FIXED: Added 500ms invincibility period after taking damage with visual flashing effect
6. ✅ **Room complete screen shows UI clutter** - FIXED (2026-01-03): Changed HUD fade alpha from 0.3 to 0 when room is cleared, so health bar and other HUD elements are fully hidden when the ENTER door prompt appears
7. ✅ **Ability selection not working** - FIXED: Two issues resolved:
   - Phaser Containers require explicit hit area geometry (not just `setSize()` + `setInteractive()`)
   - Used `new Phaser.Geom.Rectangle(-width/2, -height/2, width, height)` as hit area (offset because container origin is center)
   - Added `this.input.enabled = true` and `this.scene.bringToTop()` to ensure input is captured when launched over GameScene
8. ✅ **Joystick Y-axis inverted** - FIXED: Joystick uses mathematical angles (counter-clockwise), but screen Y-axis is inverted. Added negation to sin component for correct movement direction.
9. ✅ **AI-generated sprites too large** - FIXED (2026-01-01):
   - AI image generation created 1024x1024+ sprites instead of 32-64px
   - Resized all sprites using ImageMagick: player (64x64), bullets (32x32)
   - Adjusted display sizes: Player (64px), bullets (24px), enemy bullets (24px)
   - Backed up originals to `public/assets/sprites/originals/`
   - **LESSON**: Always specify exact pixel dimensions when using `pnpm run generate-sprite`
10. ✅ **Bullets passing through enemies (hitbox misalignment)** - FIXED (2026-01-01):
   - Issue: `setCircle()` positions hitbox at top-left corner by default, not sprite center
   - Also: Physics body used original texture size, not display size after `setDisplaySize()`
   - Fixed all entities (Bullet, EnemyBullet, Enemy, Player, Boss):
     - Added `body.setSize(displaySize, displaySize)` to sync body with display size
     - Calculated proper offset: `offset = (displaySize - radius * 2) / 2`
     - Used `body.setCircle(radius, offset, offset)` for centered hitboxes
   - Made enemy hitbox dynamic using `enemy.displayWidth` to handle varying sizes (30px melee/ranged, 36px spreader)
   - **LESSON**: Always center circular hitboxes with offset when using sprites
11. ✅ **Enemies leaving screen bounds** - FIXED (2026-01-01):
   - Issue: Enemies could move outside the visible game area (375x667)
   - Root cause: Physics world bounds were never explicitly set
   - Fixed by adding `this.physics.world.setBounds(0, 0, width, height)` in GameScene.create()
   - Added extra safety: All enemy update() methods now clamp positions to world bounds
   - Applied to: Enemy, RangedShooterEnemy, SpreaderEnemy, Boss
   - Bounds checking accounts for enemy size (15px margin for regular, 18px for spreader, 32px for boss)
   - **LESSON**: Always set physics world bounds explicitly, even if they match game size
12. ✅ **"Try Again" button not working in GameOverScene** - FIXED (2026-01-01):
   - Issue: Clicking "Try Again" button after death did not restart the game
   - Root cause: Calling `this.scene.stop('GameOverScene')` first prevented subsequent scene transitions from executing
   - When a scene stops itself, Phaser immediately halts execution of the current method
   - Fixed by reordering scene transitions in `restartGame()`:
     - First: Stop GameScene and UIScene
     - Then: Start GameScene and launch UIScene
     - Last: Stop GameOverScene (after all transitions complete)
   - **LESSON**: Always stop the current scene LAST when performing scene transitions from within that scene
13. ✅ **TalentsScene content overflow (not scrollable)** - FIXED (2026-01-01):
   - Issue: 9 talent cards with tier headers exceed the 667px screen height, content hidden below bonus panel
   - Root cause: Talent grid was created without scroll functionality
   - Fixed by implementing scrollable container:
     - Created scroll container with geometry mask (viewport: y=140 to y=557, ~417px visible area)
     - Talent cards and tier headers added to scroll container
     - Mouse wheel scrolling: `input.on('wheel')` with 0.5x scroll speed
     - Touch drag scrolling: Zone-based pointer tracking with drag start/move/end handlers
     - Scroll position clamped to content bounds (0 to maxScroll)
   - Fixed elements remain in place: header, spin button, bonus panel, back button
   - **LESSON**: For Phaser 3 scrollable content, use Container + GeometryMask + pointer/wheel input handlers
14. ✅ **Equipment and talents lost on page refresh** - FIXED (2026-01-01):
   - Issue: Equipment inventory, equipped items, and unlocked talents were not persisting across page refreshes
   - Root cause: EquipmentManager and TalentManager had `toSaveData()`/`fromSaveData()` methods but:
     - No localStorage key was defined for either manager
     - No auto-save was triggered when data changed
     - No data was loaded on game boot (managers started with empty state)
   - Fixed by adding localStorage persistence directly to each manager:
     - Added `EQUIPMENT_STORAGE_KEY = 'arrow_game_equipment_data'` and `TALENT_STORAGE_KEY = 'arrow_game_talent_data'`
     - Added `saveToStorage()` method that calls `toSaveData()` and writes to localStorage
     - Added `loadFromStorage()` method that reads localStorage and calls `fromSaveData()` on construction
     - Added `saveToStorage()` calls after all mutating operations:
       - EquipmentManager: addToInventory, removeFromInventory, equip, unequip, upgrade, clear
       - TalentManager: spin (lottery state + talent upgrades), reset, forceUnlock
   - **LESSON**: For singleton managers with save/load methods, always add auto-save on mutation and auto-load on construction
15. ✅ **EquipmentScene scroll position affects equipped item clicks** - FIXED (2026-01-03): Set equipped slots to higher depth (10) than inventory container (1) to ensure equipped items are always clickable above scrolled inventory content.
16. ✅ **EquipmentScene inventory first row cut off** - FIXED (2026-01-03): Changed first row offset from y=10 to y=SLOT_SIZE/2+5 (35px) to ensure the first row is fully visible within the mask area. Updated maxScroll calculation to account for new offset.
17. ✅ **Removed items/perks cause errors on load** - FIXED (2026-01-03):
   - Removed scythe_mage from spirit types list (was already removed from SpiritType enum)
   - Added perk validation in fromSaveData() to filter out non-existent perks
   - Unknown equipment types already skip with a warning
   - Unknown perks now skip with a warning instead of causing errors
18. ✅ **Player sprite rotates with movement direction** - FIXED (2026-01-03): Removed rotation logic in Player.update() that was causing player sprite to rotate 360° based on movement velocity. Player sprite now remains static/upright.
19. 🐛 **EquipmentScene item popup opens behind inventory** - Clicking items in inventory opens the detail popup behind the inventory container instead of on top of it.

**NEXT PRIORITIES:**
1. ✅ ~~Add 4 more abilities (Piercing Shot, Ricochet, Fire Damage, Crit Boost)~~ - DONE
2. ✅ ~~Add boss fight for room 10 with 3 attack patterns~~ - DONE (spread, barrage, charge attacks)
3. ✅ ~~Implement gameplay effects for new abilities~~ - DONE (2026-01-01):
   - ✅ Piercing: Bullets pass through enemies with damage reduction (-33% per hit)
   - ✅ Ricochet: Bullets bounce to nearest enemy (3 bounces per level)
   - ✅ Fire Damage: Apply DOT effect (18% weapon damage over 2 seconds, burns with orange tint)
   - ✅ Crit: Roll for crit on each bullet (visual: yellow tint + larger), damage multiplier applied
4. ✅ ~~**Balance pass needed**~~ - ADDRESSED (2026-01-01):
   - Added difficulty selection (Easy/Normal/Hard)
   - Hard mode: +50% boss HP, +30% boss damage, +40% enemy HP, +30% enemy damage
   - Easy mode: -40% boss HP, -25% boss damage, -30% enemy HP for beginners
5. ✅ ~~Add basic audio (shoot, hit, level-up, death sounds)~~ - DONE (2026-01-01):
   - Created AudioManager class using Web Audio API synthesis
   - Sounds: shoot, hit, player_hit, level_up, ability_select, room_clear, death, victory, menu_select, game_start
   - No external audio files needed - all sounds generated at runtime
6. ✅ ~~**Generate game assets using AI image generation**~~ - DONE (2026-01-01):
   - All sprites regenerated with proper sizes:
     - Player (archer.png): 64x64
     - Enemies (melee_slime, ranged_skeleton, spreader_eye): 64x64
     - Boss (demon): 128x128
     - Projectiles (player_arrow, enemy_fireball): 32x32
     - Door portal: 64x64
     - 8 Ability icons: 48x48 each
     - Dungeon background: 375x667
7. Polish ability UI with animations and feedback
8. ✅ **Gold drop system** - DONE (2026-01-01):
   - `src/entities/GoldPickup.ts`: Gold coin entity with spawn/collection animation
   - `src/systems/GoldPool.ts`: Object pool for 50 gold pickups with floating text
   - Gold drops from all enemy types (bullet kills and fire DOT deaths)
   - Drop amounts: Melee (5-10), Ranged (8-15), Spreader (10-20), Boss (100-200)
   - Visual features: upward arc spawn animation, idle float/pulse, magnetic pull when near player
   - Auto-collect within 50px, magnetic pull starts at 80px
   - Floating "+X" gold text on collection
   - Gold persists to SaveManager and CurrencyManager
   - Gold earned displayed on GameOverScene results screen
9. ✅ **End-of-run rewards screen** - DONE (2026-01-01):
   - Enhanced GameOverScene with detailed rewards display
   - Shows: Rooms cleared, Enemies killed, Gold earned
   - Chest reward system based on performance:
     - Base: 1 wooden chest per run
     - 5+ rooms cleared: +1 wooden chest
     - 30+ enemies killed: +1 wooden chest
     - Victory (all 10 rooms): +1 silver chest
     - Boss defeated: +1 silver chest
     - Maximum 4 chests per run
   - New files:
     - `src/data/chestData.ts`: Chest types, drop rates, reward calculation
     - `src/systems/ChestManager.ts`: Chest inventory with localStorage persistence
   - Chest types with rarity drop rates:
     - Wooden: 70% common, 25% great, 5% rare
     - Silver: 40% common, 40% great, 15% rare, 5% epic
     - Golden: 20% great, 50% rare, 25% epic, 5% legendary
   - Rewards collected when pressing CONTINUE button
   - Gold and chests added to CurrencyManager/ChestManager
10. ✅ **Chest opening UI** - DONE (2026-01-01):
   - `src/scenes/ChestScene.ts`: Full chest opening experience
   - Access via "Chests" button on MainMenuScene
   - Features:
     - Display owned chests (wooden/silver/golden) with counts
     - Tap chest to open with animation:
       - Chest shake/wobble effect
       - Flash and particle burst on open
       - Equipment card flies out with scale animation
     - Equipment reveal card shows:
       - Rarity-colored border (gray/green/blue/purple/gold)
       - Equipment name, slot icon, stats
       - Perks listed if any
       - EQUIP and CLOSE buttons
     - Uses `rollChestRarity()` from chestData.ts for weighted random
     - Uses `equipmentManager.generateRandomEquipment()` for item creation
     - Items automatically added to inventory
   - Integration:
     - ChestScene added to main.ts scene list
     - "Chests" button added to MainMenuScene menu row
     - ChestManager.removeChest() called when opening

**MVP COMPLETE!** All core features implemented. Next step is V1 with equipment and progression systems.

---

## Version 1: Full release with progression

**Goal:** A complete roguelike with permanent progression, multiple heroes, equipment, and polish. Players should feel invested after 10+ runs.

### V1 features (6-10 weeks additional)

**Expanded combat system:**
- 4 weapon types with distinct behaviors:
  - Brave Bow: Balanced, standard projectiles
  - Saw Blade: Fast attack speed (-20% damage), small projectiles
  - Staff: Homing projectiles, slower fire rate
  - Death Scythe: Slow, high damage (+45%), knockback

- 6 additional enemy types:
  - Bomber (throws AOE projectiles)
  - Burrower (underground → surface → spread attack)
  - Tank (slow, high HP, 8-way spread)
  - Charger (dash attack with wind-up)
  - Healer (restores nearby enemy HP)
  - Spawner (creates minions periodically)

**Full ability system (25 abilities):**
- Elemental tier: Fire, Ice (freeze 2s), Poison (DOT), Lightning (chain)
- Arrow modifiers: Diagonal, Side, Rear, Bouncy Wall
- Special: Dodge Master (+20%), Bloodthirst (HP on kill), Rage (damage scales with missing HP)
- Devil abilities (HP cost): Extra Life, Through Wall, Giant (+40% damage, larger hitbox)

**Equipment system:**
- 4 equipment slots: Weapon, Armor, Ring, Spirit (pet)
- 5 rarity tiers: Common → Great → Rare → Epic → Legendary
- Equipment drops from chests (end of run based on performance)
- Fusion: 3 identical items → 1 higher tier
- Equipment provides base stats + tier-specific perks

| Rarity | Border Color | Max Level | Perk Unlocks |
|--------|--------------|-----------|--------------|
| Common | Gray | 20 | None |
| Great | Green | 30 | +1 perk |
| Rare | Blue | 40 | +2 perks |
| Epic | Purple | 50 | +3 perks |
| Legendary | Gold | 70 | +4 perks |

**Hero system:**
- 3 unlockable heroes with unique starting abilities:
  - Atreus (free): Balanced stats
  - Helix (coins): +5% damage per 10% missing HP
  - Meowgik (premium): Summons spirit cats

- Hero leveling: Permanent stat increases with currency investment
- Hero-specific perks unlock at level milestones

**Currency and economy:**
- Gold: Primary currency from enemies, upgrades equipment
- Gems: Premium currency from achievements/daily rewards, opens chests
- Scrolls: Equipment-specific upgrade materials
- Energy: 5 per run, regenerates 1 per 12 minutes (20 max)

**Chapter system:**
- 5 chapters with 20 rooms each (10 combat, 5 angel, 5 boss)
- Each chapter: new enemy roster, environmental theme, difficulty scaling
- Chapter completion unlocks new abilities in the pool
- Boss variety: 3 unique bosses per chapter

**Talent system (permanent progression):**
- Spend gold to unlock random talents (lottery system)
- Common: +100 HP, +25 Attack per level
- Rare: +1% Attack Speed, +50 healing per level-up
- Epic: +3% equipment stats, Glory (start run with 1 ability)

**Polished UI/UX:**
- Animated main menu with hero showcase
- Equipment screen with slot visualization and fusion interface
- Hero selection carousel with stat comparisons
- Daily login bonus (7-day cycle with escalating rewards)
- Achievement system with gem rewards
- Run summary screen with detailed statistics

**Audio and visual polish:**
- 3 music tracks (menu, gameplay, boss)
- Sound effects for all actions (differentiated by rarity)
- Screen shake on damage/boss attacks (IMPLEMENTED: ScreenShake system)
- Particle effects for abilities and deaths (IMPLEMENTED: ParticleManager system)
- Visual telegraph for all enemy attacks (IMPLEMENTED: Boss AOE danger zones)

### V1 technical additions

```
[x] Equipment data model and inventory system (2026-01-01)
    - Equipment.ts: Complete type system (EquipmentSlot, Rarity, WeaponType, ArmorType, RingType, SpiritType)
    - 5 rarity tiers: Common (gray, L20), Great (green, L30), Rare (blue, L40), Epic (purple, L50), Legendary (gold, L70)
    - 4 weapon types: Brave Bow (balanced), Saw Blade (+40% speed, -20% dmg), Staff (homing), Death Scythe (+45% dmg, knockback)
    - 19 perks system: Attack, Speed, Crit, Health, Defense, Utility perks with rarity gating
    - equipmentData.ts: Base stats for all equipment types, upgrade cost calculations
    - EquipmentManager.ts: Singleton manager with inventory + equipped slots
      - Inventory management: add/remove/find items
      - Equip/unequip with slot validation
      - Upgrade system with level caps and cost calculations
      - Fusion system: 3 same-type/rarity items -> 1 higher rarity
      - Combined stats calculation from equipped items + perks
      - Event emitter: INVENTORY_CHANGED, EQUIPPED_CHANGED, ITEM_UPGRADED, ITEM_FUSED, STATS_CHANGED
      - Save/load integration: toSaveData()/fromSaveData()
[x] Fusion mechanic with UI
    - Fusion logic implemented in EquipmentManager
    - findFusionCandidates(): Find groups of 3+ same type/rarity items
    - fuse(): Combine 3 items -> 1 higher rarity with averaged level
    - EquipmentScene (src/scenes/EquipmentScene.ts): Full equipment UI (2026-01-01)
      - 4 equipped slots at top (weapon, armor, ring, spirit) with rarity borders
      - Scrollable inventory grid (4x4) showing unequipped items
      - Item detail panel with stats, perks, level, and rarity display
      - Equip/Unequip buttons with audio feedback
      - Upgrade button with gold cost (uses CurrencyManager)
      - Fusion button (auto-fuses first available group of 3 same type/rarity)
      - Rarity colors: Common=#888888, Great=#00AA00, Rare=#0066FF, Epic=#AA00FF, Legendary=#FFD700
      - Back button returns to MainMenuScene
      - MainMenuScene "Equip" button navigates to EquipmentScene
[x] Chest opening UI (2026-01-01)
    - ChestScene (src/scenes/ChestScene.ts): Full chest opening experience
    - Displays owned chests (wooden/silver/golden) with tap-to-open
    - Opening animation: shake, flash, particle burst, equipment card reveal
    - Equipment reveal card with rarity border, stats, perks, EQUIP/CLOSE buttons
    - Uses rollChestRarity() for weighted random and generateRandomEquipment() for item creation
    - Accessible via "Chests" button on MainMenuScene (4-button menu row)
[x] Hero unlock and selection system (2026-01-01)
    - HeroesScene (src/scenes/HeroesScene.ts): Full hero selection UI
    - 3 heroes: Atreus (free), Helix (5000 gold), Meowgik (10000 gold)
    - Hero cards display: name, level, passive ability, stats (ATK, HP, SPD, CRIT)
    - Unlock heroes with gold via CurrencyManager
    - Select unlocked heroes via SaveManager
    - Visual feedback: selected hero highlighted, locked heroes dimmed
    - Audio integration: menu sounds for selection/unlock
    - MainMenuScene "Heroes" button navigates to HeroesScene
    - **Hero icons** (2026-01-01): Unique 48x48 pixel art icons for each hero
      - hero_atreus.png: Archer portrait
      - hero_helix.png: Warrior with red rage aura
      - hero_meowgik.png: Wizard with cat familiar
      - Icons loaded in PreloaderScene, displayed in HeroesScene hero cards
      - Locked heroes show grayscale tinted icons
[x] Currency management and persistence (localStorage → IndexedDB)
    - CurrencyManager (src/systems/CurrencyManager.ts): gold, gems, scrolls, energy
    - Event-driven updates for UI integration
    - Gold drop calculations per enemy type
    - Save/load integration hooks (toSaveData/fromSaveData)
    - **Default starting currencies** (2026-01-01): New players start with 1000 gold and 50 gems
      - Defined in SaveManager.createDefaultSaveData()
      - Only applies to new saves (existing progress not affected)
      - Allows new players to unlock Helix hero (5000 gold) after a few runs
[x] Talent lottery system (2026-01-01)
    - talentData.ts: Complete talent configuration system
      - TalentTier enum: COMMON (50%), RARE (35%), EPIC (15%)
      - TalentId enum: 9 talents across 3 tiers
      - Talent interface with effectType, effectPerLevel, maxLevel
    - Common talents (50% drop rate):
      - HP Boost: +100 max HP per level (max 10)
      - Attack Boost: +25 attack per level (max 10)
      - Defense: +5% damage reduction per level (max 5)
    - Rare talents (35% drop rate):
      - Attack Speed: +1% attack speed per level (max 10)
      - Heal on Level-Up: +50 HP when leveling per level (max 5)
      - Critical Master: +2% crit chance per level (max 5)
    - Epic talents (15% drop rate):
      - Equipment Bonus: +3% equipment stats per level (max 5)
      - Glory: Start runs with 1 random ability per level (max 3)
      - Iron Will: +30% HP when below 30% per level (max 3)
    - TalentManager.ts: Singleton manager for lottery system
      - Lottery mechanics: spin(), getSpinCost(), getSpinsRemaining()
      - Escalating costs: 500 base + 250 per spin today
      - Daily spin limit: 10 spins per day (resets at midnight)
      - Talent stacking: Same talent can be rolled multiple times
      - calculateTotalBonuses(): Returns combined stats from all unlocked talents
      - Event system: talentUnlocked, talentUpgraded, spinFailed, dailyLimitReached
      - Save/load integration: toSaveData()/fromSaveData()
    - TalentsScene (src/scenes/TalentsScene.ts): Full talent lottery UI (2026-01-01)
      - Spin button with cost display and daily limit counter
      - Talent grid showing all 9 talents organized by tier (Common/Rare/Epic)
      - Tier colors: Common=#888888, Rare=#0066FF, Epic=#AA00FF
      - Talent cards show name, level (Lv.X/max), description, and current bonus
      - Spin animation with symbol cycling effect
      - Result popup shows talent tier, name, new level, and bonus gained
      - Total bonuses panel at bottom (HP, Attack, Dmg Reduction, Atk Speed, Crit, Equip Bonus)
      - Audio integration for spin and result sounds
      - MainMenuScene "Talents" button navigates to TalentsScene
[x] Chapter progression with unlock gates (2026-01-01)
    - chapterData.ts: Complete chapter configuration system
      - ChapterId type: 1-5 with full type safety
      - 5 chapters: Dark Dungeon, Forest Ruins, Frozen Caves, Volcanic Depths, Shadow Realm
      - Room layout: 20 rooms per chapter (16 combat, 2 angel, 1 miniboss, 1 boss)
      - Enemy pools: Progressive unlocks (melee/ranged/spreader -> all 9 types)
      - Chapter themes: backgroundKey, floorKey, primaryColor, accentColor, musicKey
      - Difficulty scaling per chapter: HP +20%, damage +15%, +1 enemy per chapter
      - Boss scaling: +50% HP per chapter
      - Star thresholds: 1 star (complete), 2 stars (>50% HP), 3 stars (no deaths)
      - Star reward multipliers: 1.0x, 1.5x, 2.0x
      - First-time completion bonus: 2.0x rewards
    - ChapterManager.ts: Singleton manager for chapter progression
      - Chapter selection: selectChapter(), getSelectedChapter()
      - Unlock gates: isChapterUnlocked(), getUnlockedChapters()
      - Run management: startChapter(), getCurrentRun(), advanceRoom(), clearRoom()
      - Progress tracking: getChapterProgress(), isChapterCompleted(), getBestStars()
      - Completion: completeChapter() with star calculation and rewards
      - Enemy pool: getEnemyPoolForChapter(), getCurrentEnemyPool()
      - Scaling access: getChapterScaling() for difficulty multipliers
      - Event system: chapterStarted, chapterCompleted, chapterFailed, roomEntered, roomCleared, chapterUnlocked, starRatingAchieved
      - Save/load integration: toSaveData()/fromSaveData()
[x] Energy system with timer (2026-01-01)
    - Max 20 energy, regenerates 1 per 12 minutes (720000ms)
    - Timestamp-based regeneration on load - persists across page refreshes
    - CurrencyManager now saves/loads from localStorage (`arrow_game_currency_data` key)
    - lastEnergyUpdate timestamp preserved for accurate offline regeneration
    - getTimeUntilNextEnergy() and getFormattedTimeUntilNextEnergy() for UI display
    - Timer continues from correct position after page refresh
[x] 5 chapter environments with unique backgrounds (2026-01-01)
    - Generated 5 unique AI backgrounds for each chapter (375x667 portrait resolution)
    - Chapter 1: Dark Dungeon - dark stone dungeon with torches and cobwebs
    - Chapter 2: Forest Ruins - overgrown ruins with vines and moss
    - Chapter 3: Frozen Caves - ice cave with blue crystals and frost
    - Chapter 4: Volcanic Depths - lava cave with red rocks and magma
    - Chapter 5: Shadow Realm - dark void with purple energy swirls
    - Backgrounds loaded in PreloaderScene: chapter1Bg, chapter2Bg, chapter3Bg, chapter4Bg, chapter5Bg
    - GameScene dynamically selects background based on selected chapter from ChapterManager
    - chapterData.ts updated with correct backgroundKey values for each chapter theme
[x] Chest reward system (2026-01-01)
    - chestData.ts: Chest types (wooden/silver/golden), drop rates, reward calculation
    - ChestManager.ts: Singleton manager with inventory persistence
    - End-of-run rewards based on performance (rooms, kills, boss, victory)
    - GameOverScene enhanced with rewards display and chest icons
    - Integration with CurrencyManager for gold collection
[x] Chest opening UI with equipment drops
[x] Unique enemy sets per chapter (2026-01-01)
    - Added `EnemyChapterModifiers` interface to chapterData.ts:
      - `speedMultiplier`: Movement speed modifier
      - `attackCooldownMultiplier`: Attack frequency modifier (lower = faster)
      - `projectileSpeedMultiplier`: Bullet/projectile speed modifier
      - `spawnWeight`: Enemy selection weight modifier
      - `abilityIntensityMultiplier`: Special ability intensity (heal amount, spawn rate)
    - Each chapter has unique modifiers creating distinct gameplay feel:
      - **Chapter 1 (Dark Dungeon)**: Standard enemies, more melee spawns
      - **Chapter 2 (Forest Ruins)**: Agile melee (+15% speed), faster ranged projectiles (+20%), dangerous bombers
      - **Chapter 3 (Frozen Caves)**: Slow but deadly theme - enemies slowed but chargers slide faster (+30%), tanks even tankier
      - **Chapter 4 (Volcanic Depths)**: Fast and aggressive - all enemies attack faster, healers/spawners more potent
      - **Chapter 5 (Shadow Realm)**: CHAOS - maximum danger with very fast attacks, extreme ability intensity
    - RoomGenerator uses chapter-specific spawn weights for enemy selection
    - GameScene passes chapter modifiers to all enemy constructors
    - All enemy classes updated to use modifiers:
      - Enemy (base): speedMultiplier for movement
      - RangedShooterEnemy: attackCooldownMultiplier, projectileSpeedMultiplier
      - SpreaderEnemy: attackCooldownMultiplier, projectileSpeedMultiplier
      - BomberEnemy: attackCooldownMultiplier, speedMultiplier
      - TankEnemy: attackCooldownMultiplier, projectileSpeedMultiplier, speedMultiplier
      - ChargerEnemy: attackCooldownMultiplier, speedMultiplier (affects charge speed)
      - HealerEnemy: attackCooldownMultiplier, abilityIntensityMultiplier (heal amount)
      - SpawnerEnemy: attackCooldownMultiplier, abilityIntensityMultiplier (max minions)
[x] 15 boss encounters (3 per chapter x 5 chapters) (2026-01-01)
    - Created BaseBoss abstract class for shared boss functionality:
      - Health management with damage multipliers
      - Attack cycling with phase transitions
      - Visual telegraph effects (lines, circles)
      - Projectile firing helpers (spread, aimed shots)
    - Created BossFactory for centralized boss instantiation:
      - createBoss(scene, x, y, bossType, bulletPool, options)
      - getBossDisplaySize(bossType) and getBossHitboxRadius(bossType)
    - Chapter 1 - Dark Dungeon bosses: Boss (original demon boss)
    - Chapter 2 - Forest Ruins bosses (all 3 complete):
      - TreeGuardianBoss: Vine whip (line damage), root trap (area denial), leaf storm (spiral projectiles)
      - WildBoarBoss: Fast charge, ground stomp (radial shockwave), summon minions
      - ForestSpiritBoss: Teleport (disappear/reappear), homing orbs, mirror images (decoys)
    - Chapter 3 - Frozen Caves bosses (all 3 complete):
      - IceGolemBoss: Ice breath (cone AOE/slow), ice spikes (ground pound), shield reflect
      - FrostWyrmBoss: Dive attack (off-screen), ice barrage, freezing roar (1sec freeze)
      - CrystalGuardianBoss: Laser beam (sweep), crystal turrets (spawn/fire), crystal shatter (fragment damage)
    - Chapter 4 - Volcanic Depths bosses:
      - LavaGolemBoss: Lava pools (DOT zones), meteor shower, fire wave
      - MagmaWyrmBoss: Burrow/emerge attack, fire breath sweep, segment trail
      - InfernoDemonBoss: Flame pillars, teleport dash, enrage at 30% HP
    - Chapter 5 - Shadow Realm bosses:
      - VoidLordBoss: Darkness zones (DOT), shadow tentacles, phase shift (invulnerable)
      - NightmareBoss: Screen distortion, clone multiplication, fear pulse
      - FinalBoss: Multi-phase (fire 100-70%, shadow 70-40%, combined 40-0%), minion summoning
    - Chapter-specific boss pools in chapterData.ts with random selection
    - GameScene.spawnBoss() updated to use BossFactory with chapter scaling
[x] Save/load system for all progression (2026-01-01)
    - SaveManager (src/systems/SaveManager.ts): Complete persistence system
    - Version migration support for future updates (migrateData function)
    - Hero system: unlock/select heroes, hero levels, experience tracking
    - Equipment system: inventory management, equip/unequip, rarity tiers
    - Currencies: gold, gems, scrolls with spend/add methods
    - Talents: talent points, upgrade system with max levels
    - Chapter progress: highest room, completion status, star ratings
    - Player statistics: runs, kills, deaths, playtime, bosses defeated, etc.
    - Settings persistence: difficulty, audio, language
    - Auto-save on key events (markDirty triggers save)
    - 55 unit tests with full coverage
    - Integrated with BootScene (loads on game start)
    - Integrated with GameOverScene (records run stats)
    - Integrated with MainMenuScene (persists difficulty changes)
[x] MainMenuScene UI for V1 progression systems (2026-01-01)
    - Currency display (top): Gold, Gems, Energy with regen timer
    - Player stats: Current hero name, total runs, total kills
    - Chapter indicator: Shows selected chapter
    - Menu buttons: Heroes, Equipment, Talents (placeholder functionality)
    - Energy timer: Updates every frame with "Next: MM:SS" countdown
    - Green color scheme for progression buttons (#6b8e23)
    - Mobile-optimized layout for 375x667 portrait resolution
[x] MainMenuScene visual polish (2026-01-01)
    - Dark dungeon stone wall background (menu_bg.png at 375x667)
    - Animated torches flanking the title with flickering effects:
      - Scale tween (0.95 to 1.05) with different timings per torch
      - Alpha tween (0.8-0.85 to 1.0) for flame brightness variation
    - Ember particles rising from torches using ADD blend mode
    - All UI elements have depth (10) with black stroke for visibility
    - Assets loaded in PreloaderScene: menuBg, torch
[x] Daily reward calendar (2026-01-01)
    - DailyRewardManager.ts: Complete 7-day reward cycle system
      - Track consecutive login days (1-7 cycle)
      - 48-hour streak timeout - resets to day 1 if missed
      - Reward tiers: Day 1 (100 gold), Day 2 (200 gold), Day 3 (10 gems),
        Day 4 (500 gold), Day 5 (20 gems), Day 6 (1000 gold), Day 7 (50 gems + full energy)
      - canClaimToday(), claimReward(), getCurrentDay(), getTimeUntilNextClaim()
      - Event emitter: rewardClaimed, streakReset, cycleCompleted
      - LocalStorage persistence with save/load integration
    - DailyRewardScene.ts: Calendar UI with 7-day horizontal grid
      - Day cards show reward icon, amount, claim status (checkmark/waiting)
      - Current day highlighted with pulsing border animation
      - Claim button with particle burst effect on reward claim
      - Timer showing time until next claim
      - Popup animation displaying claimed rewards
    - MainMenuScene integration:
      - "Daily Rewards" button (brown #8b4513 color)
      - Red notification badge with pulsing animation when reward available
    - Registered DailyRewardScene in main.ts scene list
[x] Achievement tracking (2026-01-01)
    - achievementData.ts: Complete achievement configuration system
      - AchievementId enum: 7 achievements with tiered progression
      - Achievement interface with tiers, requirements, and rewards
      - TIER_NAMES: Bronze/Silver/Gold/Platinum with corresponding colors
      - Achievements track player statistics: kills, runs, bosses, playtime, heroes, equipment, talents
    - Achievements with tiered rewards:
      - First Blood: Kill 1/10/100/1000 enemies (10/50/200/500 gold)
      - Survivor: Complete 1/5/25/100 runs (5/20/50/100 gems)
      - Boss Slayer: Defeat 1/5/25/50 bosses (20/100/500/1000 gold)
      - Dedicated: Play 10/50/100/500 minutes (10/50/100/200 gems)
      - Hero Collector: Unlock 1/2/3 heroes (50/100/200 gems)
      - Gear Up: Equip items in 1/2/3/4 slots (50/100/200/500 gold)
      - Talent Scout: Unlock 3/6/9 talents (20/50/100 gems)
    - AchievementManager.ts: Singleton manager for achievement tracking
      - Progress tracking: getProgress(), getAllProgress()
      - Reward system: claimReward(), claimAllRewards(), getUnclaimedRewards()
      - Statistics integration: reads from SaveManager for live stat tracking
      - checkAchievements(): Called after stat changes to detect new completions
      - Event system: achievementUnlocked, rewardClaimed, progressUpdated
      - LocalStorage persistence with save/load integration
    - AchievementsScene.ts: Full achievement UI
      - Scrollable achievement list with progress bars
      - Tier indicators showing bronze/silver/gold/platinum status
      - Claim buttons for each unclaimed tier with pulse animation
      - "Claim All" button when multiple rewards available
      - Total earned display (gold and gems)
      - Back button returns to MainMenuScene
    - MainMenuScene integration:
      - "Achievements" button (purple #4a4a8a color)
      - Red notification badge with count when unclaimed rewards available
      - Pulsing animation on badge for visibility
    - GameOverScene integration:
      - achievementManager.checkAchievements() called after run stats recorded
      - Ensures achievements update immediately after each run
[x] Visual effects polish (2026-01-01)
    - ScreenShake system (`src/systems/ScreenShake.ts`):
      - Centralized camera shake management using Phaser's camera.shake()
      - Configurable intensity presets: TINY, SMALL, MEDIUM, LARGE, EXTREME
      - Duration presets: SHORT (100ms), MEDIUM (200ms), LONG (350ms), EXTENDED (500ms)
      - Event-specific methods:
        - onPlayerDamage(): Small shake when player takes damage
        - onPlayerHeavyDamage(): Medium shake for heavy hits
        - onPlayerDeath(): Large shake on death
        - onBossAttack(): Medium shake for boss attacks
        - onBossCharge(): Medium shake when boss charges
        - onBossDeath(): Large extended shake on boss defeat
        - onExplosion(): Medium shake for enemy death explosions
        - onEnemyHit(): Tiny shake for bullet impacts
        - onCriticalHit(): Small shake for crits
      - Shake interruption control (force parameter)
      - Enable/disable toggle for accessibility
    - ParticleManager system (`src/systems/ParticleManager.ts`):
      - Centralized particle effect management using Phaser's particle emitter
      - Auto-generated 16x16 circular particle texture
      - Particle effect types with unique configurations:
        - death: Red enemy explosion (12 particles, gravity)
        - bossDeath: Large red/orange explosion (40 particles, 2 waves)
        - hit: Yellow/orange impact sparks (6 particles)
        - crit: Bright yellow burst with ADD blend (10 particles)
        - fire: Rising orange flames with ADD blend (4 particles)
        - ice: Blue crystalline scatter (8 particles)
        - levelUp: Colorful celebration burst (30 particles, ADD blend)
        - goldCollect: Golden sparkles (5 particles)
        - heal: Green rising particles (10 particles, ADD blend)
      - Each effect has tuned speed, scale, lifespan, alpha, tint, and gravity
      - Automatic emitter cleanup after particle lifespan
      - Factory function createParticleManager() for easy instantiation
    - Boss telegraph improvements:
      - Spread attack danger zone: Red pulsing circle with direction lines
      - Charge attack: Growing red line from boss to target player
      - Barrage attack: Existing telegraph lines with pulsing alpha
    - GameScene integration:
      - Bullet hits trigger hit/crit particles + screen shake
      - Fire DOT application shows fire particles
      - Enemy deaths trigger death particles + explosion shake
      - Boss death triggers large explosion particles + extended shake
      - Player damage triggers screen shake (scaled by damage amount)
      - Player death triggers death shake
      - Level up triggers celebration particles
      - Gold collection triggers gold sparkle particles
      - Health pickup triggers heal particles
      - Fire DOT kills show death + fire particles
    - Files created:
      - `src/systems/ScreenShake.ts`: Camera shake system
      - `src/systems/ParticleManager.ts`: Particle effects system
[x] Expanded procedural generation (more room templates, enemy combinations) (2026-01-01)
    - Added 6 new room layouts: Circular Siege, Advancing Wave, Staggered Lines, Crossfire, Defensive Perimeter, Central Nexus
    - Total: 22 room templates (was 16)
    - Added 5 new enemy combinations:
      - Heavy Hitters (tank duo + charger support, room 7+)
      - Elite Guard (ultimate formation with all enemy types, room 10+)
      - Fire Support (bomber + ranged combo, room 4+)
      - Coordinated Strike (charger + spreader chaos, room 5+)
      - Guardian Formation (healer with escorts, room 6+)
      - Artillery Line (tank frontline with bomber barrage, room 7+)
    - Total: 20 enemy combinations (was 14)
    - Updated chapter tacticComboNames to include new combos
[x] Performance optimization pass (target 50+ entities at 60 FPS) (2026-01-01)
    - Cached nearest enemy calculation (recalculates every 3 frames instead of every frame)
    - Added `getCachedNearestEnemy()` with validation and auto-invalidation
    - Cache invalidation on enemy death (bullet kills and DOT kills)
    - Optimized health bar updates:
      - Only redraws when health value changes
      - Position-only updates when enemy moves (skips if position unchanged)
      - Tracks `lastHealthBarValue`, `lastHealthBarX`, `lastHealthBarY` to avoid redundant redraws
    - Fixed browser global linting issues in Joystick.ts
```

**V1 COMPLETE!** All features implemented. Ready for V2 monetization and content expansion.


---

## Version 2: Monetization and content expansion

**Goal:** A sustainable free-to-play game with ethical monetization, social features, and expandable content. Ready for soft launch and player acquisition.

### V2 features (8-12 weeks additional)

**Monetization layer:**

Rewarded video ads (non-intrusive):
- Revival: Watch ad instead of dying (1 per run)
- Bonus chest: Double end-of-run rewards
- Energy refill: +5 energy (4x daily cap)
- Free daily gems: 30 gems for watching ad

IAP structure:
| Product | Price | Contents |
|---------|-------|----------|
| Starter Pack | $1.99 | 200 gems + 10K gold + 1 Epic chest |
| Gem Pile | $0.99 | 100 gems |
| Gem Bucket | $9.99 | 1100 gems |
| Battle Pass | $4.99/season | 30-tier rewards over 14 days |

Battle Pass implementation:
- Free tier: Basic rewards (gold, scrolls)
- Premium tier: Heroes, equipment, exclusive skins
- Daily quests grant Battle Pass XP
- Expires after season, replaced with new rewards

**Gacha/chest system:**
- Golden Chest: 60 gems (80% Common, 20% Great)
- Obsidian Chest: 300 gems (56% Great, 40% Rare, 4% Epic)
- Pity system: Guaranteed Epic every 10 Obsidian pulls
- Free chests via ads (1 Golden/day, 1 Obsidian/week)

**Expanded content:**
- 10 total chapters (50 rooms each for later chapters)
- 8 heroes with unique skill trees
- Endless mode: Survive as long as possible, leaderboard rankings
- Challenge modes: Daily dungeon with special rules, fixed rewards
- Special events: Limited-time themed content with exclusive rewards

**Social features:**
- Account system (guest → email → social login)
- Leaderboards: Chapter completion time, endless mode high scores
- Player profiles: Display achievements, equipped cosmetics
- Basic clan system: Join groups, donate resources, clan chest

**Cosmetic system:**
- Hero skins (color variants, themed outfits)
- Weapon skins (visual only, no stat changes)
- Victory animations
- Profile frames and titles
- Exclusive Battle Pass cosmetics

**Analytics and operations:**
- Player segmentation (whales, dolphins, F2P)
- Funnel tracking (install → first run → first death → return)
- A/B testing hooks for IAP pricing
- Remote config for balance tuning without update
- Push notification system (energy refilled, daily rewards, events)

**Quality of life:**
- Settings: Low/Medium/High graphics presets
- Effect reduction for performance
- Colorblind modes
- Tutorial system for new players
- Replay last run (same seed)

### V2 technical additions

```
[ ] Ad SDK integration (Google AdMob or similar web equivalent)
[ ] IAP integration (Stripe for web, or wrapper for app stores)
[ ] Battle Pass system with tier tracking
[ ] Server-side validation for purchases
[ ] Account system with cloud save
[ ] Leaderboard backend (Firebase Realtime DB or similar)
[ ] Push notifications (web push API)
[ ] Analytics integration (Amplitude, Mixpanel, or Firebase Analytics)
[ ] Remote config system
[ ] Seasonal content loading system
[ ] Skin/cosmetic rendering system
[ ] Clan data model and API
[ ] Anti-cheat: Server-validated run results
[ ] Localization framework (10+ languages)
[ ] GDPR compliance: Consent dialogs, data export
```

---

## Development priorities and risk mitigation

**What to prototype first:**
1. Virtual joystick + auto-aim (if this doesn't feel good, nothing else matters)
2. Stop-to-shoot timing (test different response delays: 0ms, 50ms, 100ms)
3. Enemy telegraph visibility (red lines must be readable on all backgrounds)
4. Ability selection modal (core engagement moment)

**Common failure modes:**
- **Performance death spiral:** Too many particles, too many enemies → frame drops → joystick lag → player frustration. Budget entities strictly.
- **Ability power creep:** Abilities must stack meaningfully but not trivialize content. Test 20+ minute runs with maximum ability counts.
- **Currency economy collapse:** Model expected play time to key milestones. If players can max equipment in 2 weeks, retention dies.
- **Touch target failures:** Test on actual phones, not browser emulators. Minimum 44px touch targets.

**Recommended testing cadence:**
- MVP: Daily playtest sessions, 10+ external playtesters before V1
- V1: Closed beta with 100+ players, metrics on session length, progression speed
- V2: Soft launch in limited markets (Canada, Australia), optimize before global

---

## Phaser.js implementation patterns

**Scene structure:**

```javascript
// Recommended scene organization
const scenes = [
  BootScene,      // Load core assets
  PreloaderScene, // Load game assets with progress bar
  MainMenuScene,  // Menu navigation
  GameScene,      // Core gameplay
  UIScene,        // HUD overlay (runs parallel to GameScene)
  PauseScene,     // Pause overlay
  ResultsScene    // Victory/defeat
];
```

**Ability component pattern:**

```javascript
class AbilityManager {
  constructor(player) {
    this.player = player;
    this.abilities = [];
  }

  addAbility(abilityType) {
    const existing = this.abilities.find(a => a.type === abilityType);
    if (existing) {
      existing.stack(); // Abilities can stack
    } else {
      this.abilities.push(AbilityFactory.create(abilityType, this.player));
    }
    this.recalculateStats();
  }

  modifyProjectile(projectile) {
    // Each ability can modify projectiles
    for (const ability of this.abilities) {
      ability.onProjectileFired?.(projectile);
    }
  }
}
```

**Room transition pattern:**

```javascript
onRoomCleared() {
  // Fade out
  this.cameras.main.fadeOut(300);
  
  this.time.delayedCall(300, () => {
    this.currentRoom++;
    
    if (this.currentRoom % 5 === 0) {
      this.spawnAngel(); // Every 5th room
    } else if (this.currentRoom === this.totalRooms) {
      this.spawnBoss();
    } else {
      this.generateCombatRoom();
    }
    
    this.cameras.main.fadeIn(300);
  });
}
```

---

## Timeline summary

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| MVP | 4-6 weeks | Core loop playable, 10-room runs, 8 abilities |
| V1 | 6-10 weeks | Full progression, 5 chapters, equipment, 3 heroes |
| V2 | 8-12 weeks | Monetization, social, 10 chapters, 8 heroes |
| **Total** | **18-28 weeks** | Production-ready F2P roguelike shooter |

Each version is a complete, shippable game. MVP could be released as a jam game or proof-of-concept. V1 is a full indie release. V2 is a live-service product with revenue potential. The key is resisting the urge to add V1 features during MVP—ship each milestone before expanding scope.