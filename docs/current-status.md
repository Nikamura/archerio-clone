# Current Status

_Last updated: 2026-01-18_

## Open Bugs

_No known bugs at this time._

## Recently Fixed

| Bug | Fix |
| --- | --- |
| Wild Boar boss charge attack not dealing damage | Added isCharging flag and getDamage() override to apply 3x damage multiplier during charge (2026-01-18) |
| Frost Giant boss attacks not dealing damage | Fixed attack damage application (2026-01-18) |
| Dodge Master had no maxLevel - players could waste picks beyond level 5 | Added maxLevel: 5 to match the 15% cap (2026-01-18) |
| Multiple bosses had hardcoded HP (200-600) ignoring bossData.ts values (5,400-18,000) | Changed bosses to use getBossDefinition() and halved all HP values for better balance (2026-01-18) |
| VoidLordBoss phase shift invulnerability - inverted condition caused teleport to never execute while boss remained immune to damage | Fixed guard flag logic to properly track teleport state (2026-01-18) |
| Endless mode stuck on Chapter 1 bosses - selectChapter() silently failed when chapter was locked, causing all waves to use demon boss | Added setChapterForEndlessMode() to bypass unlock check (2026-01-18) |

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
