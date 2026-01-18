# Core Gameplay

## The Core Loop

The game's brilliance lies in splitting control: the player handles movement via virtual joystick while the game handles aiming and shooting automatically. When the player releases the joystick to stop moving, their character auto-fires at the nearest enemy. This creates **100+ micro-decisions per minute**—every moment of stillness is a calculated risk.

This mechanic achieves "the right amount of control and agency" while remaining "truly hyper-casual."

## Dual Progression Loop

The roguelike layer compounds the core mechanic with run-based ability selection:

1. **Run-based skills**: Every level-up presents three random abilities (multishot, ricochet, elemental damage), and smart combinations create exponential power growth
2. **Permanent meta-progression**: Players who die lose their abilities but keep permanent progression—equipment, hero levels, and talent upgrades persist

This dual-loop drives both session engagement and long-term retention.

## Difficulty Levels

| Difficulty | Player Stats                     | Enemy Stats                                     |
| ---------- | -------------------------------- | ----------------------------------------------- |
| **Easy**   | +50% HP (150), +20% damage/speed | -30% HP, -25% damage, -20% spawns, -40% boss HP |
| **Normal** | Standard (100 HP)                | Standard stats                                  |
| **Hard**   | -20% HP (80), -10% damage/speed  | +40% HP, +30% damage, +30% spawns, +50% boss HP |

## Elemental Resistances

Different chapters have different elemental resistances, encouraging players to adapt their builds:

| Chapter             | Fire | Cold | Bleed | Notes                     |
| ------------------- | ---- | ---- | ----- | ------------------------- |
| Ch1 Dark Dungeon    | 1.0  | 1.0  | 1.0   | Neutral to all elements   |
| Ch2 Forest Ruins    | 1.3  | 1.0  | 1.0   | Dry forest burns easily   |
| Ch3 Frozen Caves    | 1.5  | 0.5  | 1.0   | Weak to fire, resist cold |
| Ch4 Volcanic Depths | 0.5  | 1.5  | 1.2   | Resist fire, weak to cold |
| Ch5 Shadow Realm    | 0.9  | 0.9  | 0.8   | Slight resistance to all  |

_Values < 1.0 = resistant (less damage), > 1.0 = vulnerable (more damage)_

## Game Speed

Players can speed up gameplay for faster progression using the speed toggle button in the top-right corner of the HUD:

| Speed | Effect | Color |
|-------|--------|-------|
| **1x** | Normal speed | Blue |
| **2x** | Double speed | Green |
| **3x** | Triple speed | Orange |
| **5x** | Five times speed | Orange |

Click the button to cycle through speeds. The setting persists across sessions.

## Level Structure

- 20 rooms per chapter with door transitions
- Mini-boss at room 10, final boss at room 20
- Room-based: clear all enemies → door opens → next room
- Angel choice rooms (heal 30% HP OR gain ability)
- Run ends on death or boss defeat
