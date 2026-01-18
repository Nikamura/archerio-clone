# Bosses

Bosses appear at room 10 (mini-boss) and room 20 (final boss) of each chapter. All bosses extend the `BaseBoss` abstract class and have 3 attack patterns.

> **Note**: Attack pattern names below are descriptive. Actual implementation may use different internal phase names while achieving similar gameplay effects.

## Boss Architecture

```typescript
export default class SomeBoss extends BaseBoss {
  constructor(scene, x, y, bulletPool, options?) {
    super(scene, x, y, bulletPool, "textureKey", options);
  }

  // Select attack phase based on pattern number
  protected selectAttackPhase(
    pattern: number,
    playerX: number,
    playerY: number,
  ): void {
    switch (pattern) {
      case 0:
        this.phase = "attack_1";
        break;
      case 1:
        this.phase = "attack_2";
        break;
      case 2:
        this.phase = "attack_3";
        break;
    }
  }

  // Handle the current attack phase
  protected handleAttackPhase(
    time: number,
    playerX: number,
    playerY: number,
  ): void {
    switch (this.phase) {
      case "attack_1":
        this.handleAttack1(time);
        break;
      // ...
    }
  }
}
```

### BaseBoss Helper Methods

| Method                                                 | Description                 |
| ------------------------------------------------------ | --------------------------- |
| `fireSpread(count, speed)`                             | Circular projectile pattern |
| `fireAtPlayer(playerX, playerY, count, speed, spread)` | Aimed shots                 |
| `drawTelegraphLine/Circle()`                           | Visual attack warnings      |
| `pulseWarning(elapsed)`                                | Flashing warning effect     |
| `showWarningPulse(elapsed)`                            | Alternative warning visual  |
| `finishAttack(time)`                                   | Return to idle phase        |

## Bosses by Chapter (15 Total)

### Chapter 1: Dark Dungeon

**Demon Boss** (Room 10 & 20)

- Phase 1: Spread shot (circular pattern)
- Phase 2: Barrage (rapid fire at player)
- Phase 3: Charge attack (dash toward player)

### Chapter 2: Forest Ruins

**Tree Guardian**

- Phase 1: Root attack (ground-based projectiles)
- Phase 2: Leaf storm (scattered projectiles)
- Phase 3: Branch sweep (wide area attack)

**Wild Boar**

- Phase 1: Charge (multiple dashes)
- Phase 2: Ground pound (AOE)
- Phase 3: Rage mode (increased speed)

**Forest Spirit**

- Phase 1: Nature bolt (homing projectiles)
- Phase 2: Summon minions
- Phase 3: Healing phase (recovers HP)

### Chapter 3: Frozen Caves

**Ice Golem**

- Phase 1: Ice spikes (ground eruption)
- Phase 2: Frost breath (cone attack)
- Phase 3: Shatter (explodes into fragments)

**Frost Wyrm**

- Phase 1: Ice beam (sweeping laser)
- Phase 2: Blizzard (screen-wide projectiles)
- Phase 3: Dive attack (disappears and strikes)

**Crystal Guardian**

- Phase 1: Crystal shards (bouncing projectiles)
- Phase 2: Prism beam (reflected attacks)
- Phase 3: Crystal cage (surrounds player)

### Chapter 4: Volcanic Depths

**Lava Golem**

- Phase 1: Magma balls (arcing projectiles)
- Phase 2: Eruption (spawns lava pools)
- Phase 3: Molten form (increased damage)

**Magma Wyrm**

- Phase 1: Fire breath (sweeping flame)
- Phase 2: Burrow attack (underground strike)
- Phase 3: Meteor rain (falling projectiles)

**Inferno Demon**

- Phase 1: Flame wave (expanding rings)
- Phase 2: Hellfire (targeted explosions)
- Phase 3: Demon summon (spawns adds)

### Chapter 5: Shadow Realm

**Void Lord**

- Phase 1: Shadow bolts (homing darkness)
- Phase 2: Void zone (damage areas)
- Phase 3: Phase shift (becomes invulnerable, teleports)
- _Note: Fixed bug where phase shift flag was inverted, causing perma-invincibility_

**Nightmare**

- Phase 1: Fear pulse (slowing effect)
- Phase 2: Shadow clones (multiple copies)
- Phase 3: Dream collapse (screen-wide attack)

**Final Boss** (Multi-phase)

- Multiple health bars
- Combines attack patterns from previous bosses
- Final phase has enrage mechanic

## Boss Stats

Base HP values (before chapter/difficulty multipliers):

| Boss | Chapter | Base HP |
| ---- | ------- | ------- |
| Demon Lord | 1 | 3,000 |
| Tree Guardian | 2 | 3,750 |
| Wild Boar King | 2 | 3,300 |
| Forest Spirit | 2 | 2,700 |
| Ice Golem | 3 | 5,250 |
| Frost Wyrm | 3 | 4,200 |
| Crystal Guardian | 3 | 4,500 |
| Magma Wyrm | 4 | 6,000 |
| Inferno Demon | 4 | 5,250 |
| Lava Golem | 4 | 6,750 |
| Void Lord | 5 | 7,500 |
| Nightmare | 5 | 5,700 |
| The Void Incarnate (Final) | 5 | 9,000 |

## Boss Visual Telegraphs

All boss attacks have visual warnings:

- **Red lines**: Indicate projectile paths
- **Warning circles**: Show AOE explosion radius
- **Pulse effects**: Flash before major attacks
- **Danger zones**: Highlighted ground areas

## Boss Health Bar

- Full-width bar appears at top of screen
- Only visible during boss fights
- Shows boss name and HP percentage
