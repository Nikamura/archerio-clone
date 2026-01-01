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
- Main menu: Play button, settings toggle
- Level-up modal: 3 ability cards, darkened background
- Death screen: "Try Again" button, basic stats (rooms cleared, enemies killed)
- Victory screen: Run complete message, restart button

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
[x] Scene management: MainMenu, Game, GameOver (Boot, Preloader, MainMenu, Game, UI)
[x] Player controller with joystick input (nipplejs + keyboard fallback)
[x] Auto-aim + auto-fire system (fires at nearest enemy when stationary)
[x] Bullet pool (100 bullets)
[x] Enemy bullet pool (100 enemy bullets)
[x] 3 enemy AI behaviors (melee rusher, ranged shooter with telegraph, spreader)
[x] Collision detection (player/enemy, bullet/enemy, enemy-bullet/player)
[x] Automated visual testing with Puppeteer
[ ] Room system with door transitions
[ ] XP/leveling system
[ ] Ability selection modal
[ ] 8 working abilities with stacking
[ ] Boss with 3 attack patterns
[x] Health system with damage feedback (UI update needed)
[ ] Basic audio (shoot, hit, level-up, death)
[x] Touch controls working on mobile browsers (virtual joystick implemented)
[x] 60 FPS on desktop (tested via Puppeteer)
```

**CURRENT STATUS (2026-01-01):**
- ✅ Basic project structure with TypeScript + Vite
- ✅ Core "stop to shoot, move to dodge" mechanic working
- ✅ Virtual joystick controls (mobile ready)
- ✅ Three enemy types: Melee, Ranged Shooter, Spreader
- ✅ Auto-aim targeting nearest enemy
- ✅ Enemy bullet system with collision
- ✅ Player damage system (enemy melee + bullets)
- ✅ Real-time health bar UI updates
- ✅ Portrait mode (375x667) optimized for mobile
- ✅ Precise hitbox collision detection
- ✅ Puppeteer automated testing with screenshots
- 🚧 Dev server running at http://localhost:3000/

**TESTING:**
Run `pnpm run test:visual` to automatically test the game and capture screenshots.
Screenshots are saved to `test/screenshots/`

**KNOWN BUGS:**
1. ✅ **Map too large** - FIXED: Changed from 800x600 to 375x667 (portrait mode, iPhone SE size)
2. ✅ **Enemy hitbox too large** - FIXED: Reduced enemy collision circle from 15px to 10px, bullets set to 4-5px radius
3. ✅ **Player hitpoints not decreasing** - FIXED: Added player-enemy collision (5 damage), enemy bullets now damage player (10 damage), UI health bar updates in real-time
4. 🐛 **No game over when player dies** - Player can continue getting hit after reaching 0 HP. Need to add death screen and restart functionality

**NEXT PRIORITIES:**
1. Implement room system with door transitions
2. Add XP/leveling system
3. Create ability selection modal
4. Implement first 3-4 abilities (Front Arrow, Multishot, Attack Speed, Attack Boost)
5. Add health system UI updates and player death

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
[ ] Equipment data model and inventory system
[ ] Fusion mechanic with UI
[ ] Hero unlock and selection system
[ ] Currency management and persistence (localStorage → IndexedDB)
[ ] Talent lottery system
[ ] Chapter progression with unlock gates
[ ] Energy system with timer
[ ] 5 chapter environments with unique enemy sets
[ ] 15 boss encounters (3 per chapter × 5 chapters)
[ ] Save/load system for all progression
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