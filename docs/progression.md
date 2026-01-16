# Progression Systems

All permanent progression systems that persist across runs.

## Currencies

Managed by `CurrencyManager`.

| Currency | Source                      | Use                                       |
| -------- | --------------------------- | ----------------------------------------- |
| Gold     | Enemy drops, chests         | Equipment upgrades, hero unlocks, talents |
| Gems     | Achievements, daily rewards | Open chests                               |
| Scrolls  | Chests, rewards             | Equipment-specific upgrades               |
| Energy   | Time-based regeneration     | Start runs                                |

### Energy System

- Maximum: 20 energy
- Cost per run: 5 energy
- Regeneration: 1 energy per 12 minutes
- Offline regeneration supported
- Ad-based refill: +1 energy (mock implementation)

## Talent System

Managed by `TalentManager`. Lottery-style permanent upgrades.

### Talent Tiers

| Tier   | Examples                                              |
| ------ | ----------------------------------------------------- |
| Common | +100 HP, +25 Attack per level                         |
| Rare   | +1% Attack Speed, +50 healing per level-up            |
| Epic   | +3% equipment stats, Glory (start run with 1 ability) |

### Talent Lottery

- Spend gold to spin for random talent
- Costs escalate with each spin
- Blocked when all talents maxed (prevents wasted gold)

## Chapter System

Managed by `ChapterManager`. 5 chapters with unique content.

### Chapters

| Chapter | Theme           | Rooms | Notes                              |
| ------- | --------------- | ----- | ---------------------------------- |
| 1       | Dark Dungeon    | 20    | Tutorial chapter, neutral elements |
| 2       | Forest Ruins    | 20    | Fire vulnerable, 3 unique bosses   |
| 3       | Frozen Caves    | 20    | Fire strong, cold resistant        |
| 4       | Volcanic Depths | 20    | Cold strong, fire resistant        |
| 5       | Shadow Realm    | 20    | Slight resistance to all           |

### Room Structure

- Rooms 1-9, 11-19: Combat rooms
- Room 10: Mini-boss
- Room 20: Final boss
- Angel rooms appear periodically (heal or ability)

### Chapter Unlocks

- Complete previous chapter to unlock next
- Each chapter unlocks new abilities in the pool

## Chest System

Managed by `ChestManager`.

### Chest Types

| Type   | Contents               | Source                    |
| ------ | ---------------------- | ------------------------- |
| Wooden | Common-Great equipment | Basic rewards             |
| Silver | Great-Rare equipment   | Better performance        |
| Golden | Rare-Epic equipment    | Best performance, premium |

### Chest Opening

- ChestScene with opening animations
- Equipment drops based on chest tier
- Pity system: Guaranteed Epic every 10 Obsidian pulls

## Daily Rewards

Managed by `DailyRewardManager`.

- 7-day reward cycle
- Escalating rewards each day
- 48-hour streak timeout
- Rewards include: Gold, gems, chests, scrolls

## Achievements

Managed by `AchievementManager`.

### Achievement Tiers

- Bronze
- Silver
- Gold
- Platinum

### Example Achievements

- Complete chapters
- Defeat bosses
- Collect equipment
- Reach certain levels

Rewards: Gems, equipment, cosmetics

## Save System

Managed by `SaveManager`.

- Full localStorage persistence
- Version migration for updates
- 55 unit tests for reliability
- All managers auto-save on mutation

### Storage Keys

| Key                             | Data                      |
| ------------------------------- | ------------------------- |
| `aura_archer_save_data`         | Overall game state        |
| `aura_archer_currency_data`     | Currencies                |
| `aura_archer_equipment_data`    | Inventory, equipped items |
| `aura_archer_talent_data`       | Talent levels             |
| `aura_archer_chest_data`        | Chest inventory           |
| `aura_archer_daily_rewards`     | Login streak              |
| `aura_archer_achievements`      | Achievement progress      |
| `aura_archer_hero_data`         | Hero unlocks, levels      |
| `aura_archer_chapter_data`      | Chapter progress          |
| `aura_archer_encyclopedia_data` | Discovered entries        |
