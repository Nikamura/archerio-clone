# Current Status

_Last updated: 2026-01-18_

## Open Bugs

_No known bugs at this time._

## Recently Fixed

| Bug | Fix |
| --- | --- |
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
