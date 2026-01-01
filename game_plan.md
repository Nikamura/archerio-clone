# Archer.io Web Clone: Complete Development Plan

The Archero-style roguelike shooter succeeds through a deceptively simple core mechanic: **stop to shoot, move to dodge**. This creates a fundamental tension between offense and defense that drives the entire game experience. Building a web-based clone requires carefully layering complexity onto this foundation without breaking what makes it work. This plan structures development into three fully playable versions, each complete and polished before moving forward.

## The core loop that makes Archero work

The game's brilliance lies in splitting control: the player handles movement via virtual joystick while the game handles aiming and shooting automatically. When the player releases the joystick to stop moving, their character auto-fires at the nearest enemy. This creates **100+ micro-decisions per minute**—every moment of stillness is a calculated risk. According to design analyses, this mechanic achieves "the right amount of control and agency" while remaining "truly hyper-casual."

The roguelike layer compounds this with run-based ability selection. Every level-up presents three random abilities (multishot, ricochet, elemental damage), and smart combinations create exponential power growth. Players who die lose their abilities but keep permanent progression—equipment, hero levels, and talent upgrades persist. This dual-loop (run-based skills + permanent meta-progression) drives both session engagement and long-term retention.

---

## Technical foundation: Phaser.js architecture

**Recommended stack:**
- **Engine:** Phaser 3.6+ with Arcade Physics (significantly faster than Matter.js for this genre)
- **Touch controls:** nipplejs for virtual joystick + phaser3-rex-plugins as backup
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

**Three enemy archetypes:**
| Enemy | Behavior | Attack |
|-------|----------|--------|
| Melee Rusher | Moves directly toward player | Contact damage |
| Ranged Shooter | Stops periodically, fires at player | Single projectile with red telegraph line |
| Spreader | Stationary, fires 4-direction pattern | Slow projectiles |

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
[x] Player controller with joystick input (nipplejs + keyboard fallback)
[x] Auto-aim + auto-fire system (fires at nearest enemy when stationary)
[x] Bullet pool (100 bullets)
[x] Enemy bullet pool (100 enemy bullets)
[x] 3 enemy AI behaviors (melee rusher, ranged shooter with telegraph, spreader)
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
- ✅ Virtual joystick controls (mobile ready, Y-axis fixed)
- ✅ Three enemy types: Melee, Ranged Shooter, Spreader
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
- ✅ **8 abilities implemented** - All MVP abilities complete:
  - Front Arrow (+1 projectile, -25% damage per level)
  - Multishot (side arrows at 45°, -15% attack speed per level)
  - Attack Speed (+25% multiplicative)
  - Attack Boost (+30% damage multiplicative)
  - Piercing Shot (arrows pass through enemies, -33% damage per enemy)
  - Ricochet (arrows bounce 3x between enemies per level)
  - Fire Damage (+18% DOT over 2 seconds, additive stacking)
  - Crit Boost (+10% crit chance additive, +40% crit damage multiplicative)
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
  - All effects work with Front Arrow and Multishot projectiles
- ✅ **Enemy health bars** - Small health bars appear above enemies when damaged (hidden at full HP)
  - Color changes: green (>50%) → yellow (25-50%) → red (<25%)
  - Follows enemy movement, auto-hides when enemy dies or resets
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
- ✅ ESLint + TypeScript build passing
- ✅ 92 unit tests passing with high coverage
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
6. ⚠️ **Room complete screen shows UI clutter** - When room is cleared and "ENTER" prompt appears, instruction text and health bar should be hidden for cleaner presentation
7. ✅ **Ability selection not working** - FIXED: Two issues resolved:
   - Phaser Containers require explicit hit area geometry (not just `setSize()` + `setInteractive()`)
   - Used `new Phaser.Geom.Rectangle(-width/2, -height/2, width, height)` as hit area (offset because container origin is center)
   - Added `this.input.enabled = true` and `this.scene.bringToTop()` to ensure input is captured when launched over GameScene
8. ✅ **Joystick Y-axis inverted** - FIXED: nipplejs uses mathematical angles (counter-clockwise), but screen Y-axis is inverted. Added negation to sin component for correct movement direction.
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
- Spend gold to unlock random talents (Archero-style lottery)
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
- Screen shake on damage/boss attacks
- Particle effects for abilities and deaths
- Visual telegraph for all enemy attacks

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
    - CurrencyManager now saves/loads from localStorage (`archerio_currency_data` key)
    - lastEnergyUpdate timestamp preserved for accurate offline regeneration
    - getTimeUntilNextEnergy() and getFormattedTimeUntilNextEnergy() for UI display
    - Timer continues from correct position after page refresh
[ ] 5 chapter environments with unique enemy sets
[ ] 15 boss encounters (3 per chapter × 5 chapters)
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
[ ] Daily reward calendar
[ ] Achievement tracking
[ ] Expanded procedural generation (more room templates, enemy combinations)
[ ] Performance optimization pass (target 50+ entities at 60 FPS)
```

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