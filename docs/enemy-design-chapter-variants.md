# Chapter-Specific Enemy Design Document

## Overview

This document outlines the design for unique enemy sets per chapter, ensuring each chapter feels distinct through enemy variety while maintaining balanced difficulty progression. The system builds upon the 9 existing base enemy types and creates thematic variants for each chapter.

---

## Current State Analysis

### Existing Base Enemy Types

| Type | Base HP | Behavior | Speed | Attack Pattern |
|------|---------|----------|-------|----------------|
| **Melee** | 30 | Chase player directly | 80 | Contact damage (5) |
| **Ranged Shooter** | 30 | Kite at 250px, telegraph shots | 60 | Single aimed projectile |
| **Spreader** | 30 | Stationary | 0 | 4-direction spread (cardinals) |
| **Bomber** | 30 | Maintain 120-220px distance | 60-70 | AOE bombs with wind-up |
| **Burrower** | 30 | Underground movement, surface attack | 40 (underground) | 6-direction burst on surface |
| **Tank** | 90 (3x) | Slow approach | 30 | 8-direction charged spread |
| **Charger** | 30 | Idle then dash attack | 80/350 (charge) | 2.5x contact damage on charge |
| **Healer** | 18 (0.6x) | Stay 200px away, strafe | 70 | Heals allies in 150px range |
| **Spawner** | 45 (1.5x) | Stationary | 0 | Spawns up to 3 minions |

### Current Chapter Enemy Pools

| Chapter | Name | Current Pool |
|---------|------|--------------|
| 1 | Dark Dungeon | melee, ranged, spreader |
| 2 | Forest Ruins | melee, ranged, spreader, bomber, burrower |
| 3 | Frozen Caves | melee, ranged, spreader, bomber, burrower, tank, charger |
| 4 | Volcanic Depths | melee, ranged, spreader, bomber, burrower, tank, charger, healer |
| 5 | Shadow Realm | all 9 types |

### Chapter Scaling Multipliers

| Chapter | HP Mult | Dmg Mult | Extra Enemies |
|---------|---------|----------|---------------|
| 1 | 1.0x | 1.0x | +0 |
| 2 | 1.2x | 1.15x | +1 |
| 3 | 1.4x | 1.3x | +2 |
| 4 | 1.6x | 1.45x | +3 |
| 5 | 1.8x | 1.6x | +4 |

---

## Design Philosophy

### Goals

1. **Thematic Coherence**: Each chapter's enemies should visually and mechanically fit its environment
2. **Progressive Complexity**: Later chapters introduce more complex mechanics
3. **Memorable Encounters**: Players should associate specific enemy behaviors with specific chapters
4. **Balanced Variety**: Mix of new variants and returning base types per chapter
5. **Avoid Bloat**: Variants modify existing behaviors rather than creating entirely new enemy classes

### Implementation Approach

Rather than creating 45+ entirely new enemy classes, we use a **variant system**:

1. **Base Type + Variant ID**: e.g., `melee:dungeon_skeleton`, `ranged:frost_archer`
2. **Variant Modifiers**: Stats, visual tint, behavior tweaks, special abilities
3. **Chapter-Specific Pools**: Each chapter draws from its themed variants
4. **Shared Codebase**: Variants extend base classes with configuration

---

## Chapter 1: Dark Dungeon

**Theme**: Ancient stone corridors, flickering torches, decay and bone
**Color Palette**: Grays, browns, orange torch glow, bone white
**Atmosphere**: Classic dungeon crawl, introductory difficulty

### Enemy Roster (3 types)

#### 1.1 Dungeon Skeleton (Melee Variant)
- **Base Type**: Melee
- **Visual**: Bone-white skeleton with rusted sword
- **HP**: 30 (1.0x)
- **Speed**: 80
- **Behavior**: Standard melee chase
- **Special**: None (pure introduction enemy)
- **Tint**: 0xE8DCC8 (bone white)

#### 1.2 Torch Wraith (Ranged Variant)
- **Base Type**: Ranged Shooter
- **Visual**: Ghostly figure with orange flame core
- **HP**: 25 (slightly less)
- **Speed**: 50 (slower)
- **Behavior**: Kite behavior, longer aim time (700ms)
- **Special**: Bullets leave brief flame trails (visual only)
- **Tint**: 0xFF6600 (orange glow)

#### 1.3 Cobweb Spreader (Spreader Variant)
- **Base Type**: Spreader
- **Visual**: Spider-like creature in web
- **HP**: 35
- **Speed**: 0 (stationary)
- **Behavior**: 4-direction spread, 3.5s cooldown
- **Special**: Projectiles slow player briefly on hit (0.5s, 30% slow)
- **Tint**: 0x888888 (gray)

### Chapter 1 Summary
- Introduces core enemy archetypes
- No complex mechanics
- Cobweb slow provides first taste of status effects
- 3 enemy types total

---

## Chapter 2: Forest Ruins

**Theme**: Overgrown temples, nature reclaiming civilization, primal creatures
**Color Palette**: Greens, browns, moss, ancient stone, leaf accents
**Atmosphere**: Nature-based threats, more mobility, ambush tactics

### Enemy Roster (5 types)

#### 2.1 Vine Creeper (Melee Variant)
- **Base Type**: Melee
- **Visual**: Plant-creature with vine tentacles
- **HP**: 36 (1.2x chapter scaling)
- **Speed**: 70 (slightly slower)
- **Behavior**: Standard chase with path curving
- **Special**: On death, spawns 2 temporary root traps (1s duration, deal 3 damage if stepped on)
- **Tint**: 0x228B22 (forest green)

#### 2.2 Moss Archer (Ranged Variant)
- **Base Type**: Ranged Shooter
- **Visual**: Camouflaged humanoid with wooden bow
- **HP**: 30
- **Speed**: 55
- **Behavior**: Standard kite, faster shots (400ms aim)
- **Special**: Starts partially invisible (50% alpha), becomes fully visible when attacking
- **Tint**: 0x556B2F (dark olive)

#### 2.3 Spore Spreader (Spreader Variant)
- **Base Type**: Spreader
- **Visual**: Giant mushroom with pulsing cap
- **HP**: 40
- **Speed**: 0
- **Behavior**: 6-direction spread (instead of 4)
- **Special**: Projectiles apply poison on hit (2 damage/sec for 3s)
- **Tint**: 0x9ACD32 (yellow-green)

#### 2.4 Burrowing Root (Burrower Variant)
- **Base Type**: Burrower
- **Visual**: Thick root system that travels underground
- **HP**: 35
- **Speed**: 50 (faster underground)
- **Behavior**: Standard burrow cycle
- **Special**: Surfaces closer to player (within 30px instead of 50px)
- **Tint**: 0x8B4513 (saddle brown)

#### 2.5 Firefly Bomber (Bomber Variant)
- **Base Type**: Bomber
- **Visual**: Large glowing insect
- **HP**: 32
- **Speed**: 80 (faster, more erratic)
- **Behavior**: Erratic movement pattern while maintaining distance
- **Special**: Bombs explode into smaller projectile burst (4 directions) after main explosion
- **Tint**: 0xFFFF00 (yellow glow)

### Chapter 2 Summary
- Introduces poison, visibility mechanics, on-death effects
- More emphasis on positioning (root traps, burrow ambush)
- 5 enemy types total

---

## Chapter 3: Frozen Caves

**Theme**: Glacial caverns, crystalline formations, bitter cold
**Color Palette**: Ice blue, white, crystal purple, frost effects
**Atmosphere**: Slow and dangerous, ice mechanics, high durability enemies

### Enemy Roster (7 types)

#### 3.1 Frost Zombie (Melee Variant)
- **Base Type**: Melee
- **Visual**: Frozen undead with ice crystals
- **HP**: 50 (high for melee)
- **Speed**: 55 (slow but tanky)
- **Behavior**: Relentless slow chase
- **Special**: On hit, applies brief chill (20% slow for 1s). Dies in ice explosion (20px radius, 5 damage)
- **Tint**: 0x87CEEB (sky blue)

#### 3.2 Crystal Archer (Ranged Variant)
- **Base Type**: Ranged Shooter
- **Visual**: Ice elemental with crystal bow
- **HP**: 35
- **Speed**: 50
- **Behavior**: Standard kite
- **Special**: Shots leave ice patches on ground (last 3s, slow player by 40% when crossed)
- **Tint**: 0x00BFFF (deep sky blue)

#### 3.3 Blizzard Spreader (Spreader Variant)
- **Base Type**: Spreader
- **Visual**: Snow vortex creature
- **HP**: 45
- **Speed**: 10 (very slow drift)
- **Behavior**: Slowly drifts toward player while firing
- **Special**: 8-direction spread (instead of 4), projectiles curve slightly toward player
- **Tint**: 0xB0E0E6 (powder blue)

#### 3.4 Ice Burrower (Burrower Variant)
- **Base Type**: Burrower
- **Visual**: Crystalline worm
- **HP**: 40
- **Speed**: 35 (slower)
- **Behavior**: Standard burrow but longer underground (3s instead of 2s)
- **Special**: On surface, fires 8 projectiles (instead of 6). Leaves ice patch where it surfaces.
- **Tint**: 0xADD8E6 (light blue)

#### 3.5 Glacier Tank (Tank Variant)
- **Base Type**: Tank
- **Visual**: Massive ice golem
- **HP**: 150 (5x base instead of 3x)
- **Speed**: 20 (extremely slow)
- **Behavior**: Very slow approach, longer charge time (1.2s)
- **Special**: Fires 12 projectiles (instead of 8). Takes 25% less damage from front (shield effect)
- **Tint**: 0x4682B4 (steel blue)

#### 3.6 Avalanche Charger (Charger Variant)
- **Base Type**: Charger
- **Visual**: Rolling ice boulder creature
- **HP**: 40
- **Speed**: 60 normal, 400 charge
- **Behavior**: Longer wind-up (1s), faster charge
- **Special**: Leaves ice trail during charge (slows player). Bounces off walls once before stopping.
- **Tint**: 0xE0FFFF (light cyan)

#### 3.7 Frost Bomber (Bomber Variant)
- **Base Type**: Bomber
- **Visual**: Ice elemental with crystalline bombs
- **HP**: 38
- **Speed**: 50
- **Behavior**: Standard bomber
- **Special**: Bombs create ice patch on explosion (3s duration, 50px radius). Slows player in area by 50%.
- **Tint**: 0x00CED1 (dark turquoise)

### Chapter 3 Summary
- Heavy emphasis on slow/ice mechanics
- Introduces front-facing damage reduction (Tank)
- Wall bounce mechanic (Charger)
- Environmental hazards (ice patches)
- 7 enemy types total

---

## Chapter 4: Volcanic Depths

**Theme**: Lava flows, scorching heat, volcanic activity
**Color Palette**: Reds, oranges, black obsidian, magma glow
**Atmosphere**: Aggressive enemies, fire damage, high DPS threats

### Enemy Roster (8 types)

#### 4.1 Magma Elemental (Melee Variant)
- **Base Type**: Melee
- **Visual**: Humanoid made of molten rock
- **HP**: 45
- **Speed**: 90 (faster than normal)
- **Behavior**: Aggressive chase
- **Special**: Deals fire DOT on contact (3 damage/sec for 2s). Explodes on death (30px radius, 8 damage)
- **Tint**: 0xFF4500 (orange-red)

#### 4.2 Cinder Sniper (Ranged Variant)
- **Base Type**: Ranged Shooter
- **Visual**: Obsidian archer wreathed in flame
- **HP**: 30
- **Speed**: 65
- **Behavior**: Kite at longer range (300px)
- **Special**: Fires 2 projectiles in quick succession. Projectiles pierce through first target.
- **Tint**: 0xFF6347 (tomato)

#### 4.3 Eruption Spreader (Spreader Variant)
- **Base Type**: Spreader
- **Visual**: Volcanic vent creature
- **HP**: 50
- **Speed**: 0
- **Behavior**: Stationary with periodic eruption
- **Special**: Alternates between 4-way spread and single large projectile that splits into 8 on impact
- **Tint**: 0xDC143C (crimson)

#### 4.4 Lava Worm (Burrower Variant)
- **Base Type**: Burrower
- **Visual**: Fire serpent that swims through rock
- **HP**: 45
- **Speed**: 60 (fast underground)
- **Behavior**: Aggressive surface timing
- **Special**: Leaves lava trail when surfaced (2s duration, deals 5 damage/sec). Invulnerable for 0.5s after surfacing.
- **Tint**: 0xFF8C00 (dark orange)

#### 4.5 Obsidian Juggernaut (Tank Variant)
- **Base Type**: Tank
- **Visual**: Massive obsidian construct
- **HP**: 120
- **Speed**: 35 (faster than ice tank)
- **Behavior**: Standard tank with faster charge (0.6s)
- **Special**: Fires projectiles that explode on impact (15px radius, 4 damage). Enrages at 30% HP (50% speed boost)
- **Tint**: 0x8B0000 (dark red)

#### 4.6 Inferno Charger (Charger Variant)
- **Base Type**: Charger
- **Visual**: Flaming bull creature
- **HP**: 35
- **Speed**: 85 normal, 380 charge
- **Behavior**: Shorter cooldown between charges (2s instead of 3s)
- **Special**: Leaves fire trail during charge (2s duration, 4 damage/sec). Can charge twice before stun.
- **Tint**: 0xFF2400 (scarlet)

#### 4.7 Ash Bomber (Bomber Variant)
- **Base Type**: Bomber
- **Visual**: Volcanic imp with magma bombs
- **HP**: 35
- **Speed**: 75
- **Behavior**: More aggressive positioning (closer range)
- **Special**: Bombs leave lava pool (4s duration, 6 damage/sec). Throws 2 bombs in quick succession.
- **Tint**: 0xB22222 (firebrick)

#### 4.8 Flame Priest (Healer Variant)
- **Base Type**: Healer
- **Visual**: Robed fire cultist
- **HP**: 25
- **Speed**: 80
- **Behavior**: Standard healer positioning
- **Special**: Heals also grant fire shield to allies (absorbs 10 damage). Applies fire DOT to player if too close (15 damage over 5s)
- **Tint**: 0xCD5C5C (indian red)

### Chapter 4 Summary
- Introduces fire DOT, lava pools, explosive deaths
- High DPS environment - punishes mistakes heavily
- Healer with offensive capability
- Double-attack patterns common
- 8 enemy types total

---

## Chapter 5: Shadow Realm

**Theme**: The void between worlds, ultimate darkness, eldritch horror
**Color Palette**: Deep purple, black, void blue, ethereal white
**Atmosphere**: Unpredictable, reality-bending mechanics, maximum challenge

### Enemy Roster (9 types - all base types represented with ultimate variants)

#### 5.1 Void Stalker (Melee Variant)
- **Base Type**: Melee
- **Visual**: Shadow creature with multiple limbs
- **HP**: 55
- **Speed**: 100 (very fast)
- **Behavior**: Aggressive pursuit with phase-through ability
- **Special**: Can teleport 80px toward player every 4s. Briefly invulnerable during teleport (0.3s).
- **Tint**: 0x4B0082 (indigo)

#### 5.2 Nightmare Archer (Ranged Variant)
- **Base Type**: Ranged Shooter
- **Visual**: Ethereal specter with void bow
- **HP**: 35
- **Speed**: 70
- **Behavior**: Erratic movement, phases in/out
- **Special**: Fires 3 projectiles in spread. Becomes intangible for 1s after firing (can't be hit).
- **Tint**: 0x9932CC (dark orchid)

#### 5.3 Chaos Spreader (Spreader Variant)
- **Base Type**: Spreader
- **Visual**: Writhing mass of tentacles
- **HP**: 60
- **Speed**: 20 (slow drift)
- **Behavior**: Random movement, unpredictable firing
- **Special**: Fires 4-12 projectiles randomly. Direction randomized each shot. Projectiles home slightly.
- **Tint**: 0x8A2BE2 (blue violet)

#### 5.4 Phase Shifter (Burrower Variant)
- **Base Type**: Burrower
- **Visual**: Reality-tearing creature
- **HP**: 50
- **Speed**: 80 (fast phase movement)
- **Behavior**: Phases in/out of reality instead of burrowing
- **Special**: Can attack while phased (reduced damage). Surfaces create void zones (3s, slow + 3 dps).
- **Tint**: 0x7B68EE (medium slate blue)

#### 5.5 Void Titan (Tank Variant)
- **Base Type**: Tank
- **Visual**: Massive eldritch construct
- **HP**: 180 (6x base)
- **Speed**: 25
- **Behavior**: Slow inevitable approach
- **Special**: Absorbs projectiles (up to 5) then releases them back at player. Creates gravity well on death (pulls player toward center for 2s).
- **Tint**: 0x483D8B (dark slate blue)

#### 5.6 Shadow Dash (Charger Variant)
- **Base Type**: Charger
- **Visual**: Pure darkness in humanoid form
- **HP**: 45
- **Speed**: 70 normal, 500 charge (extremely fast)
- **Behavior**: Short wind-up (0.4s), very fast charge
- **Special**: Phases through obstacles during charge. Creates shadow clones (2) after charge that attack once then fade.
- **Tint**: 0x191970 (midnight blue)

#### 5.7 Void Bomber (Bomber Variant)
- **Base Type**: Bomber
- **Visual**: Floating void orb creature
- **HP**: 40
- **Speed**: 60
- **Behavior**: Standard bomber
- **Special**: Bombs implode (pull player toward center before exploding). Creates temporary portals that spawn 1 minion enemy.
- **Tint**: 0x6A5ACD (slate blue)

#### 5.8 Soul Leech (Healer Variant)
- **Base Type**: Healer
- **Visual**: Ghostly leech creature
- **HP**: 30
- **Speed**: 90 (fast, hard to catch)
- **Behavior**: Extremely evasive, maximum distance
- **Special**: Heals by stealing player HP (drains 5 HP/3s within 100px range). Healed allies gain brief damage boost.
- **Tint**: 0x9400D3 (dark violet)

#### 5.9 Void Mother (Spawner Variant)
- **Base Type**: Spawner
- **Visual**: Massive egg-like void creature
- **HP**: 70
- **Speed**: 0
- **Behavior**: Stationary spawner
- **Special**: Spawns shadow versions of random enemy types (not just minions). Max 4 spawns. On death, all spawns explode.
- **Tint**: 0x800080 (purple)

### Chapter 5 Summary
- Every enemy type has reality-bending mechanics
- Introduces player HP drain, projectile reflection
- Maximum mechanical complexity
- Teleportation and phasing common
- Clone/decoy mechanics
- 9 enemy types total (all base types with ultimate variants)

---

## Implementation Approach

### Variant Data Structure

```typescript
interface EnemyVariant {
  id: string                    // e.g., "frost_zombie"
  baseType: EnemyType           // e.g., "melee"
  chapter: ChapterId            // e.g., 3
  name: string                  // Display name
  description: string           // Tooltip text

  // Stat modifiers (multiply base stats)
  stats: {
    hpMultiplier: number        // e.g., 1.5
    speedMultiplier: number     // e.g., 0.8
    damageMultiplier: number    // e.g., 1.2
  }

  // Visual
  spriteKey?: string            // Custom sprite or null for tinted base
  tint: number                  // Fallback/additional tint
  scale?: number                // Size modifier

  // Behavior modifiers
  behavior: {
    // Type-specific overrides
    fireRate?: number           // For ranged types
    projectileCount?: number    // For spread types
    projectileSpeed?: number
    aimDuration?: number        // For ranged types
    movePattern?: 'chase' | 'kite' | 'strafe' | 'erratic'
  }

  // Special abilities
  abilities: EnemyAbility[]
}

interface EnemyAbility {
  id: string                    // e.g., "on_death_explode"
  trigger: 'on_death' | 'on_hit' | 'on_attack' | 'periodic' | 'on_surface' | 'on_charge'
  effect: AbilityEffect
  params: Record<string, number | string | boolean>
}

type AbilityEffect =
  | 'explode'           // radius, damage
  | 'spawn_hazard'      // type (ice/fire/void), duration, radius
  | 'apply_status'      // status (slow/burn/poison), duration, intensity
  | 'spawn_projectiles' // count, speed, pattern
  | 'teleport'          // range
  | 'spawn_minions'     // count, type
  | 'reflect_projectiles' // max_count
  | 'drain_hp'          // amount, range
  | 'create_clone'      // count, duration
  | 'grant_shield'      // amount
  | 'phase_invulnerable' // duration
```

### File Structure

```
src/
├── config/
│   ├── chapterData.ts         // Update with variant pools
│   └── enemyVariantData.ts    // NEW: Variant definitions
├── entities/
│   ├── Enemy.ts               // Update with variant support
│   ├── EnemyVariantFactory.ts // NEW: Creates variants from data
│   └── abilities/             // NEW: Modular ability implementations
│       ├── OnDeathExplode.ts
│       ├── SpawnHazard.ts
│       ├── ApplyStatus.ts
│       └── ...
└── systems/
    └── EnemySpawner.ts        // Update to use variants
```

### Updated Chapter Enemy Pools

```typescript
// In chapterData.ts
export const CHAPTER_DEFINITIONS: Record<ChapterId, ChapterDefinition> = {
  1: {
    // ... existing config
    enemyVariants: [
      'dungeon_skeleton',   // melee
      'torch_wraith',       // ranged
      'cobweb_spreader',    // spreader
    ],
  },
  2: {
    enemyVariants: [
      'vine_creeper',       // melee
      'moss_archer',        // ranged
      'spore_spreader',     // spreader
      'burrowing_root',     // burrower
      'firefly_bomber',     // bomber
    ],
  },
  // ... etc
}
```

---

## Balance Considerations

### Difficulty Curve

| Chapter | Avg Enemy HP | Avg Enemy DPS | Mechanics Introduced |
|---------|--------------|---------------|---------------------|
| 1 | 30 | Low | Slow debuff |
| 2 | 36 | Low-Med | Poison, visibility, on-death effects |
| 3 | 50 | Medium | Ice patches, wall bounce, damage reduction |
| 4 | 50 | High | Fire DOT, lava pools, double attacks |
| 5 | 60 | Very High | Teleport, HP drain, projectile reflect |

### Enemy Composition Per Room

| Chapter | Ratio by Type |
|---------|---------------|
| 1 | 50% melee, 30% ranged, 20% spreader |
| 2 | 40% melee, 25% ranged, 15% spreader, 10% burrower, 10% bomber |
| 3 | 30% melee, 20% ranged, 15% spreader, 15% tank, 10% charger, 10% other |
| 4 | 25% melee, 20% ranged, 15% spreader, 15% tank, 15% bomber, 10% healer |
| 5 | Even distribution across all types |

### Priority Targets

Players should learn target priority per chapter:

1. **Chapter 1**: Kill spreaders first (positional threats)
2. **Chapter 2**: Kill burrowers before they surface, bombers for AOE denial
3. **Chapter 3**: Kill spreaders (slow patches), avoid chargers
4. **Chapter 4**: Kill healers immediately, avoid bomber lava pools
5. **Chapter 5**: Kill soul leeches ASAP, manage spawner spawns

---

## Visual Design Guidelines

### Per-Chapter Color Themes

| Chapter | Primary Tint | Effect Color | Particle Color |
|---------|--------------|--------------|----------------|
| 1 | Bone/Gray | Orange (fire) | Brown (dust) |
| 2 | Green | Yellow-green | Green (spore) |
| 3 | Ice Blue | White (frost) | Light blue (ice) |
| 4 | Orange-Red | Red-orange | Yellow (ember) |
| 5 | Purple | Dark purple | Violet (void) |

### Sprite Generation Prompts

```bash
# Chapter 1 examples
pnpm run generate-sprite "skeleton warrior with rusty sword" --type enemy --clean
pnpm run generate-sprite "ghostly wraith with orange flames" --type enemy --clean
pnpm run generate-sprite "spider creature in cobweb" --type enemy --clean

# Chapter 2 examples
pnpm run generate-sprite "plant creature with vine tentacles" --type enemy --clean
pnpm run generate-sprite "moss covered archer camouflaged" --type enemy --clean
pnpm run generate-sprite "giant mushroom with glowing spores" --type enemy --clean

# Chapter 3 examples
pnpm run generate-sprite "frozen zombie with ice crystals" --type enemy --clean
pnpm run generate-sprite "crystal ice elemental archer" --type enemy --clean
pnpm run generate-sprite "massive ice golem tank" --type enemy --clean

# Chapter 4 examples
pnpm run generate-sprite "magma elemental humanoid" --type enemy --clean
pnpm run generate-sprite "obsidian archer wreathed in flames" --type enemy --clean
pnpm run generate-sprite "volcanic fire cultist priest" --type enemy --clean

# Chapter 5 examples
pnpm run generate-sprite "shadow creature with multiple limbs" --type enemy --clean
pnpm run generate-sprite "ethereal void specter archer" --type enemy --clean
pnpm run generate-sprite "writhing mass of tentacles chaos" --type enemy --clean
```

---

## Testing Checklist

### Per-Variant Testing

- [ ] Correct sprite/tint applied
- [ ] Base stats modified correctly
- [ ] Special ability triggers correctly
- [ ] Visual effects display properly
- [ ] Sound effects play (if applicable)
- [ ] Does not break object pooling
- [ ] Performance acceptable with 10+ on screen

### Per-Chapter Testing

- [ ] All variants spawn correctly
- [ ] Difficulty feels appropriate for chapter position
- [ ] No impossible enemy combinations
- [ ] Player has counterplay options
- [ ] Chapter feels thematically distinct
- [ ] Mini-boss room uses correct mini-boss variant

### Cross-Chapter Testing

- [ ] Smooth difficulty progression 1 -> 5
- [ ] No sudden difficulty spikes
- [ ] Each chapter introduces new mechanic without overwhelming
- [ ] Returning players recognize chapter by enemy types

---

## Summary

This design introduces **32 unique enemy variants** across 5 chapters:

| Chapter | New Variants | Total Types |
|---------|--------------|-------------|
| 1 - Dark Dungeon | 3 | 3 |
| 2 - Forest Ruins | 5 | 5 |
| 3 - Frozen Caves | 7 | 7 |
| 4 - Volcanic Depths | 8 | 8 |
| 5 - Shadow Realm | 9 | 9 |

**Key Mechanics by Chapter**:
- **Ch.1**: Slow debuff (intro)
- **Ch.2**: Poison, visibility, on-death traps
- **Ch.3**: Ice patches, damage reduction, wall bounce
- **Ch.4**: Fire DOT, lava pools, double attacks, enrage
- **Ch.5**: Teleport, HP drain, projectile reflection, clones

The variant system allows for thematic diversity without code explosion, and the modular ability system enables easy mixing and matching of special effects across enemy types.
