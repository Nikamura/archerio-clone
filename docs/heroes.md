# Heroes System

Heroes are permanent characters with unique abilities. Managed by `HeroManager`.

## Available Heroes (3)

### Atreus (Free)

- **Cost**: Free (starting hero)
- **Passive**: Balanced stats
- **Description**: Standard archer with no special abilities

### Helix (1,500 Gold)

- **Cost**: 1,500 gold
- **Passive**: +5% damage per 10% missing HP
- **Description**: Rage-based hero that deals more damage when hurt
- **Playstyle**: High risk, high reward

### Meowgik (300 Gems)

- **Cost**: 300 gems
- **Passive**: Summons spirit cats that attack enemies
- **Description**: Summoner hero with autonomous damage dealers
- **Playstyle**: Pet-based damage

## Hero Leveling

- Invest gold to level up heroes
- Each level provides permanent stat increases:
  - +HP
  - +Attack
  - +Attack Speed (minor)
- Hero-specific perks unlock at level milestones

## Hero Stats Summary

The STATS button in HeroesScene shows combined stats from all sources:

| Source             | Indicator |
| ------------------ | --------- |
| Hero base stats    | H:        |
| Equipment          | E:        |
| Talents            | T:        |
| Percentage bonuses | +%:       |

## Hero Selection

- Only one hero can be active per run
- Select hero from HeroesScene before starting a run
- Locked heroes show unlock cost and requirements

## Hero Animations

- Shooting animation: Scale pulse + recoil effect
- Squash/stretch effect with slight positional kickback
- Visual feedback for auto-fire while stationary
