# Equipment System

Equipment provides permanent stat bonuses and is managed by `EquipmentManager`.

## Equipment Slots (4)

| Slot   | Primary Stat          |
| ------ | --------------------- |
| Weapon | Attack damage         |
| Armor  | Max HP                |
| Ring   | Attack speed          |
| Spirit | Special effects (pet) |

## Weapon Types (4)

| Weapon       | Behavior                       | Stats                      |
| ------------ | ------------------------------ | -------------------------- |
| Brave Bow    | Balanced, standard projectiles | Base stats                 |
| Saw Blade    | Fast attack, small projectiles | -20% damage, +attack speed |
| Staff        | Homing projectiles             | Slower fire rate           |
| Death Scythe | Slow, high damage, knockback   | +45% damage, -attack speed |

_Note: Death Scythe's negative attack speed is a defining trait and doesn't scale with rarity/level._

## Rarity Tiers (5)

| Rarity    | Border Color | Max Level | Perks    |
| --------- | ------------ | --------- | -------- |
| Common    | Gray         | 20        | None     |
| Great     | Green        | 30        | +1 perk  |
| Rare      | Blue         | 40        | +2 perks |
| Epic      | Purple       | 50        | +3 perks |
| Legendary | Gold         | 70        | +4 perks |

## Equipment Perks (17)

Perks provide additional bonuses unlocked at certain rarity tiers:

| Perk                 | Tier                  | Effect        |
| -------------------- | --------------------- | ------------- |
| Attack Boost (S/M/L) | Common/Rare/Epic      | +damage       |
| Attack Speed (S/M)   | Great/Epic            | +attack speed |
| Crit Chance (S/M)    | Great/Epic            | +crit chance  |
| Crit Damage (S/M)    | Great/Epic            | +crit damage  |
| Health Boost (S/M/L) | Common/Rare/Legendary | +max HP       |
| Damage Reduction (S) | Rare                  | -damage taken |
| Dodge (S/M)          | Great/Epic            | +dodge chance |
| XP Boost (S)         | Common                | +bonus XP     |
| Gold Boost (S)       | Common                | +gold drops   |

## Fusion System

Combine 3 identical items to create 1 higher-tier item:

```
3x Common → 1x Great
3x Great → 1x Rare
3x Rare → 1x Epic
3x Epic → 1x Legendary
```

Fusion is available in the Equipment Scene with visual feedback showing the resulting item.

## Equipment Upgrades

- Use gold to level up equipment
- Each level provides incremental stat increases
- Max level depends on rarity tier
- Upgrade costs scale with level and rarity

## Selling Equipment

- Sell price = 30% of total invested gold (base cost + upgrades)
- Prevents exploiting upgrade→sell cycles

## Inventory Management

### Sorting Options

- **★ Rarity**: Sort by rarity (Legendary first)
- **Lv Level**: Sort by upgrade level
- **⚔ Slot**: Sort by equipment slot type

### Equipment Comparison

- Green up-arrow appears on items better than currently equipped
- Detail popup shows stat comparison with +/- indicators

## Drop Sources

- End-of-run chests (based on performance)
- Daily rewards
- Achievement rewards
- Chapter completion rewards
