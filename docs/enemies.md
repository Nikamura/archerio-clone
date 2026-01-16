# Enemies

All enemy types with their behaviors and attack patterns.

## Enemy Types (9 Total)

### Melee Rusher

- **Behavior**: Moves directly toward player
- **Attack**: Contact damage on collision
- **Speed**: Normal
- **Health**: Low

### Ranged Shooter

- **Behavior**: Stops periodically, fires at player
- **Attack**: Single projectile with red telegraph line
- **Speed**: Medium
- **Health**: Low
- **Telegraph**: Shows aim direction before firing

### Spreader

- **Behavior**: Stationary with hopping movement between shots
- **Attack**: Slow projectiles in cardinal directions (4-way pattern)
- **Speed**: None (hops occasionally)
- **Health**: Medium
- **Note**: Validates position on spawn to avoid walls

### Charger

- **Behavior**: Normal movement, then dashes at player
- **Attack**: High contact damage during charge (2.5x normal)
- **Speed**: Normal → Fast (during charge)
- **Health**: Medium
- **State**: Stunned briefly after charge completes

### Bomber

- **Behavior**: Medium speed, keeps distance from player
- **Attack**: Throws AOE bombs that explode after 1.5s
- **Speed**: Medium
- **Health**: Medium
- **Telegraph**: Warning circle shows explosion radius

### Tank

- **Behavior**: Very slow movement toward player
- **Attack**: 8-way spread shot with charge-up animation
- **Speed**: Very slow
- **Health**: High (3x normal)
- **Size**: Large (48x48)

### Burrower

- **Behavior**: Burrows underground, surfaces near player
- **Attack**: Spread attack on surfacing (6 projectiles)
- **Speed**: Fast (underground)
- **Health**: Medium
- **State**: Invulnerable while burrowed

### Healer

- **Behavior**: Stays away from player, seeks injured allies
- **Attack**: Heals 10 HP to nearby enemies every 3 seconds
- **Speed**: Medium
- **Health**: Low
- **Range**: Healing aura affects nearby enemies
- **Priority**: High priority target for players

### Spawner

- **Behavior**: Stationary
- **Attack**: Spawns up to 3 weak minion enemies
- **Speed**: None (stationary)
- **Health**: High
- **Spawns**: Minions are weaker versions of standard enemies

## Enemy Health Bars

- Color transitions: Green → Yellow → Red based on remaining HP
- Only visible when enemy has taken damage

## Enemy-Enemy Collision

Enemies have physics collision with each other to prevent stacking/overlapping.

## Chapter Modifiers

Each chapter applies **per-enemy-type** modifiers to enemy stats. The implementation uses granular tuning rather than global multipliers. Example modifiers from Chapter 2:

| Enemy Type | Speed | Cooldown | Proj. Speed |
| ---------- | ----- | -------- | ----------- |
| Melee      | 1.15x | -        | -           |
| Ranged     | -     | -        | 1.2x        |
| Spreader   | -     | 0.9x     | -           |
| Bomber     | 0.85x | -        | -           |

See `src/config/chapterData.ts` for exact per-enemy-type modifiers per chapter.

## Spawn System

- Enemies spawn at valid positions (checked against walls)
- Random spawn positions within room layouts
- 20 enemy combination templates per room type
- Spawns scale with room number and difficulty
