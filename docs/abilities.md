# Abilities

Abilities are gained during runs through level-ups and angel rooms. Players level up every 10 kills and choose from 3 random abilities. Abilities stack when chosen multiple times.

## Ability Categories

### Core Abilities

| Ability            | Effect                                 | Penalty                   |
| ------------------ | -------------------------------------- | ------------------------- |
| Front Arrow +1     | Additional forward projectile          | -15% damage per stack     |
| Multishot          | Multiple projectiles in spread pattern | -10% attack speed         |
| Attack Speed Boost | +25% attack speed                      | None                      |
| Attack Boost       | +30% damage                            | None                      |
| Piercing Shot      | Arrows pass through enemies            | -33% damage per enemy hit |
| Ricochet           | Bounces 3x between enemies             | None                      |
| Fire Damage        | 18% weapon damage over 2 seconds DOT   | None                      |
| Crit Boost         | +10% crit chance, +40% crit damage     | None                      |

### Elemental Abilities

| Ability         | Effect                                  | Synergy                         |
| --------------- | --------------------------------------- | ------------------------------- |
| Ice Shot        | Freezes enemies for 2s                  | +50% damage to frozen (Shatter) |
| Poison Shot     | Stacking DOT that increases with stacks | None                            |
| Lightning Chain | Chains to nearby enemies on hit         | 250px chain range               |
| Bleed           | 10% DOT, 2x damage if enemy is moving   | None                            |

### Arrow Modifiers

| Ability          | Effect                           | Max Level |
| ---------------- | -------------------------------- | --------- |
| Diagonal Arrow   | Fires additional diagonal arrows | —         |
| Through Wall     | Arrows pass through walls        | 1         |
| Homing Arrows    | Bullets track enemies            | 3         |
| Explosive Arrows | AOE on bullet impact             | 3         |

### Orbital Abilities

| Ability        | Effect                         | Max Level |
| -------------- | ------------------------------ | --------- |
| Rotating Orbs  | +1 damage orb orbits player    | 5         |
| Orbital Shields| +1 shield that blocks bullets  | 3         |
| Spirit Pets    | +1 homing wisp companion       | 5         |

### Defensive Abilities

| Ability        | Effect                         | Max Level |
| -------------- | ------------------------------ | --------- |
| Shield Barrier | Absorbs damage (UI bar shown)  | 3         |
| Knockback      | Push enemies on hit            | 3         |

### On-Kill Effects

| Ability    | Effect                         | Max Level |
| ---------- | ------------------------------ | --------- |
| Death Nova | AOE explosion on enemy kill    | 3         |

### Utility Abilities

| Ability      | Effect                           | Max Level |
| ------------ | -------------------------------- | --------- |
| Bloodthirst  | Heal HP on enemy kill            | 5         |
| Speed Boost  | +15% move, +5% attack speed      | —         |
| Vitality     | +15% max HP                      | —         |
| Dodge Master | +3% dodge chance (15% cap)       | 5         |

### Game Modifier Abilities (Risk/Reward)

| Ability      | Effect                             | Max Level | Risk                    |
| ------------ | ---------------------------------- | --------- | ----------------------- |
| Ascetic      | +200% XP gain (3x multiplier)      | 1         | Blocks ALL healing      |
| Horde Magnet | +50% enemies, +100% XP per level   | —         | Greatly increased difficulty |

**Ascetic**: High-risk glass cannon build. All healing is disabled (potions, Bloodthirst, talents). Rewards skilled play with 3x XP for rapid progression. Cannot be stacked (maxLevel: 1).

**Horde Magnet**: Stackable challenge modifier. Each level adds +50% enemy count and +100% XP gain (2x, 3x, 4x...). Multiplicative with Ascetic (e.g., Ascetic + Horde Magnet L3 = 12x XP). Can be taken infinitely for extreme challenge runs.

### Devil Abilities (HP Cost)

| Ability    | Effect              | Cost         |
| ---------- | ------------------- | ------------ |
| Extra Life | Revive once per run | HP sacrifice |

## Passive Synergies

Certain abilities have built-in synergies:

- **Ice Shot + Shatter**: Frozen enemies take +50% damage from all sources
- **Fire Damage + Fire Spread**: When a burning enemy dies, fire spreads to nearby enemies

## Ability Priority System

Players can set a priority order for auto-learned abilities:

- Drag-and-drop UI to arrange ability priority
- Highest priority available ability is selected during auto-level-up
- Priority applies when level-up selection times out

## Stacking Behavior

Most abilities can stack multiple times:

- Damage abilities: Additive bonuses
- Arrow count: Each stack adds projectiles
- Attack speed: Multiplicative stacking
- Some abilities have `maxLevel` limits (e.g., Extra Life = 1)

## XP and Leveling

- Level up every 10 kills (typical run = 3 level-ups)
- XP scales exponentially: `baseXP * 1.5^(level-2)`
- Each level-up presents 3 random ability choices
- Max attack speed capped at 10 attacks/second (`MAX_ATTACK_SPEED = 5.0`)
