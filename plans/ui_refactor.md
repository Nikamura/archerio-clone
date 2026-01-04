# Main Menu Refactoring Plan

## Goal
Transform the cluttered 1,070-line MainMenuScene into a clean, mobile-optimized layout with:
- Bottom tab navigation for secondary features
- Single dominant PLAY button with mode selector
- Collapsible chapter/difficulty selection

## Current vs. New Layout

### Current (20+ visible buttons)
```
Currency Bar
Title + High Score
Chapter Selection (5 buttons)
Difficulty (4 buttons)
PLAY | ENDLESS
DAILY CHALLENGE
Heroes | Equip | Talents | Guide
Chests | Daily
Achievements
Shop
Settings
Footer
```

### New (Clean, focused)
```
+------------------------------------------+
|  💰 Gold    ARROW GAME    ⚙️ Settings    |  <- Compact header
+------------------------------------------+
|                                          |
|     ▼ Chapter 3 - Normal                 |  <- Collapsible selector
|                                          |
|         [  Story  ▼  ]                   |  <- Mode dropdown
|                                          |
|      ╔══════════════════════╗            |
|      ║                      ║            |
|      ║        PLAY          ║            |  <- Large dominant button
|      ║                      ║            |
|      ╚══════════════════════╝            |
|                                          |
|      ⚡ DAILY CHALLENGE (if available)   |  <- Conditional
|                                          |
+==========================================+
|  🏠     ⚔️      🎁      🛒      •••     |  <- Bottom nav with badges
|  Home   Gear   Rewards  Shop    More     |
+------------------------------------------+
```

## Implementation Phases

### Phase 1: Extract Components (~400 lines reduction)
**Goal**: Reduce MainMenuScene complexity without visible changes

1. **Create `NoEnergyModal.ts`** - Extract lines 695-786 (energy popup)
2. **Create `MockAdPopup.ts`** - Extract lines 792-970 (ad popup with cat)
3. **Create `CurrencyBar.ts`** - Reusable currency display component
4. **Extract torch/particle creation** to utility function

Files to create:
- `src/ui/components/NoEnergyModal.ts` (~100 lines)
- `src/ui/components/MockAdPopup.ts` (~180 lines)
- `src/ui/components/CurrencyBar.ts` (~60 lines)

### Phase 2: Create Bottom Navigation Bar
**Goal**: Move secondary features to persistent bottom nav

1. **Create `BottomNavBar.ts`** component:
   ```typescript
   interface NavItem {
     id: string
     icon: string       // Emoji icon
     label: string
     scene?: string     // Target scene or null for callback
     badge?: number     // Notification count
     onClick?: () => void
   }
   ```

2. **Navigation items**:
   | Icon | Label | Target | Badge Source |
   |------|-------|--------|--------------|
   | 🏠 | Home | - (current) | - |
   | ⚔️ | Gear | EquipmentScene | - |
   | 🎁 | Rewards | ChestScene | `chestManager.getTotalChests()` |
   | 🛒 | Shop | ShopScene | - |
   | ••• | More | Opens drawer | Sum of other badges |

3. **Create `MoreDrawer.ts`** - Slide-up panel containing:
   - Heroes
   - Talents
   - Daily Rewards (badge if claimable)
   - Achievements (badge with count)
   - Encyclopedia/Guide

Files to create:
- `src/ui/components/BottomNavBar.ts` (~150 lines)
- `src/ui/components/MoreDrawer.ts` (~180 lines)

### Phase 3: Create Play Section with Mode Selector
**Goal**: Single dominant PLAY button with mode dropdown

1. **Create `ModeSelector.ts`** - Dropdown for game modes:
   - Story (Normal chapter progression)
   - Endless (Wave survival)
   - Daily Challenge (fixed seed, shows completion status)

2. **Create `PlaySection.ts`** - Contains:
   - Collapsible chapter/difficulty row
   - Mode selector dropdown
   - Large PLAY button (200x60px)

3. **Modify `ChapterSelectPanel.ts`** - Add collapse/expand:
   - Collapsed: Shows "Chapter X - Difficulty" as single row
   - Expanded: Full chapter buttons + difficulty selector

Files to create:
- `src/ui/components/ModeSelector.ts` (~100 lines)
- `src/scenes/menus/PlaySection.ts` (~200 lines)

Files to modify:
- `src/scenes/menus/ChapterSelectPanel.ts` - Add collapse functionality
- `src/scenes/menus/DifficultyPanel.ts` - Integrate into collapsed view

### Phase 4: Refactor MainMenuScene
**Goal**: Assemble new components, reduce to ~250 lines

1. Replace inline button creation with components
2. Use new `BottomNavBar` for navigation
3. Use new `PlaySection` for play area
4. Use extracted modals for energy/ad popups
5. Remove deprecated code

Final structure:
```typescript
create() {
  this.createBackground()
  this.createHeader()          // Compact: currency + settings
  this.createPlaySection()     // Mode selector + PLAY button
  this.createBottomNavBar()    // 5 nav items with badges
}
```

### Phase 5: Polish & Animation
1. Entrance animations for components
2. Smooth drawer transitions
3. Button press feedback
4. Badge pulse animations

## Files to Create
| File | Lines | Purpose |
|------|-------|---------|
| `src/ui/components/BottomNavBar.ts` | ~150 | Fixed bottom navigation |
| `src/ui/components/MoreDrawer.ts` | ~180 | Slide-up secondary menu |
| `src/ui/components/ModeSelector.ts` | ~100 | Game mode dropdown |
| `src/ui/components/NoEnergyModal.ts` | ~100 | Energy popup extraction |
| `src/ui/components/MockAdPopup.ts` | ~180 | Ad popup extraction |
| `src/ui/components/CurrencyBar.ts` | ~60 | Reusable currency display |
| `src/scenes/menus/PlaySection.ts` | ~200 | Play area container |

## Files to Modify
| File | Changes |
|------|---------|
| `src/scenes/MainMenuScene.ts` | Reduce from 1070 to ~250 lines |
| `src/scenes/menus/ChapterSelectPanel.ts` | Add collapse/expand |
| `src/scenes/menus/DifficultyPanel.ts` | Compact mode for collapsed state |
| `src/ui/components/index.ts` | Export new components |

## Testing Checklist
- [ ] All features accessible (via nav bar or drawer)
- [ ] Badge notifications update correctly
- [ ] Energy check works before PLAY
- [ ] All 3 game modes work (Story/Endless/Daily)
- [ ] Chapter/difficulty selection persists
- [ ] Collapsed state expands on tap
- [ ] Bottom nav 44px touch targets
- [ ] Theme colors applied
- [ ] Scene transitions work from all nav items
- [ ] Debug mode still functions

## Key Patterns to Follow
- Use existing `createButton()` from `Button.ts`
- Follow `ChapterSelectPanel` extraction pattern
- Use `UIAnimations.ts` for transitions
- Manager pattern for any new state
- ThemeManager for all colors

## Risk Mitigation
- Keep original code in `createLegacyLayout()` initially
- Feature flag for gradual rollout
- Test all scene transitions
- Verify badge updates via manager events
