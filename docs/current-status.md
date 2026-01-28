# Current Status

_Last updated: 2026-01-28_

## Open Bugs

_No known bugs at this time._

## Recently Fixed

| Bug | Fix |
| --- | --- |
| Joystick and menu button not responding during boss fights | Fixed UIScene blocking input by adding setTopOnly(false), and made menu container itself interactive with explicit hit area (#192, 2026-01-27) |
| Highscore events reporting wave instead of score | Fixed event data to report actual score, reduced event noise (#193, 2026-01-27) |
| Game crash when delayed callbacks fire after scene shutdown | Added scene lifecycle checks before callback execution (#191, 2026-01-27) |
| Bullets hitting immune boss causing lag | Fixed collision handling during boss immunity phases (#188, 2026-01-27) |
| Piercing/homing bullets accumulating around boss causing lag | Fixed bullet cleanup when boss is immune (#189, 2026-01-27) |
| Shield not regenerating when auto-level is enabled | Fixed shield regeneration logic (#187, 2026-01-26) |
| Mobile Fire movement stopping after holding joystick steady | Fixed gun skill input detection (#186, 2026-01-26) |
| Boss Slayer and Hero Collector achievements not working | Fixed achievement trigger conditions (#185, 2026-01-25) |
| Encyclopedia tab clicks triggering row clicks when scrolled | Fixed input event handling in scrollable containers (#182, 2026-01-25) |
| XP bar always showing empty | Fixed XP bar display logic (#180, 2026-01-24) |
| Mob spawn rate and projectile accuracy not scaling with game speed | Applied game speed multiplier to spawn intervals and accuracy calculations (#179, 2026-01-24) |

### Older Fixes (2026-01-18)

| Bug | Fix |
| --- | --- |
| Wild Boar boss charge attack not dealing damage | Added isCharging flag and getDamage() override to apply 3x damage multiplier during charge |
| Frost Giant boss attacks not dealing damage | Fixed attack damage application |
| Dodge Master had no maxLevel - players could waste picks beyond level 5 | Added maxLevel: 5 to match the 15% cap |
| Multiple bosses had hardcoded HP (200-600) ignoring bossData.ts values (5,400-18,000) | Changed bosses to use getBossDefinition() and halved all HP values for better balance |
| VoidLordBoss phase shift invulnerability - inverted condition caused teleport to never execute while boss remained immune to damage | Fixed guard flag logic to properly track teleport state |
| Endless mode stuck on Chapter 1 bosses - selectChapter() silently failed when chapter was locked, causing all waves to use demon boss | Added setChapterForEndlessMode() to bypass unlock check |

## Recent Changes

### Features Added (2026-01-19 to 2026-01-28)

| Feature | Description |
| ------- | ----------- |
| Player level on game over screen | Display level reached during run in stats section (#195) |
| Daily rewards now give chests | Days 1, 2, 4, 6 reward chests instead of gold (#196) |
| Front Arrow +1 rebalanced | Removed -15% damage penalty, now pure power increase (#194) |
| Player bullet visual settings | New settings for bullet size and opacity (#190) |
| Reset speed on boss setting | Option to auto-reset game speed to 1x when entering boss rooms (#184) |
| SimpleAnalytics integration | Basic analytics via AnalyticsManager (#183) |
| Mobile Fire ability | Shoot while moving at reduced attack speed, scales with level (#178) |

## Upcoming Features

| Feature                   | Description                           |
| ------------------------- | ------------------------------------- |
| Multiple priority layouts | Save up to 4 ability priority presets |

## V2 Roadmap (Not Started)

- Ad SDK integration (AdMob)
- IAP (Stripe)
- Battle Pass system
- Account system with cloud save
- Leaderboards
- Clan system
- Push notifications
- Analytics and A/B testing
- Cosmetic/skin system
- Localization (10+ languages)
- GDPR compliance
