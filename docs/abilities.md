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

| Ability        | Effect                           |
| -------------- | -------------------------------- |
| Diagonal Arrow | Fires additional diagonal arrows |
| Through Wall   | Arrows pass through walls        |

### Utility Abilities

| Ability      | Effect                           |
| ------------ | -------------------------------- |
| Bloodthirst  | Heal HP on enemy kill            |
| Speed Boost  | +movement speed                  |
| Vitality     | +max HP                          |
| Dodge Master | +3% dodge chance (capped at 15%) |

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
