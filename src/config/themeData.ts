// Theme system definitions

export type ThemeId = 'medieval' | 'vaporwave' | 'lotr' | 'strangerThings'

export interface ThemeColors {
  // Primary button colors (Play button, primary actions)
  primaryButton: number
  primaryButtonHover: number

  // Secondary button colors (Menu buttons)
  secondaryButton: number
  secondaryButtonHover: number

  // Health bar gradient
  healthFull: number
  healthMid: number
  healthLow: number

  // XP and boss bars
  xpBar: number
  bossHealth: number

  // Text colors (CSS format)
  titleText: string
  accentText: string
  mutedText: string

  // Chapter selection colors
  chapterColors: Record<number, number>
}

export interface ThemeAssets {
  // Per-hero sprites
  atreusSprite: string
  helixSprite: string
  meowgikSprite: string
  bulletSprite: string
  menuBg: string
  chapter1Bg: string
  chapter2Bg: string
  chapter3Bg: string
  chapter4Bg: string
  chapter5Bg: string
  loadingBarColor: number
  loadingBgColor: number
}

export interface ThemeDefinition {
  id: ThemeId
  name: string
  description: string
  unlockCost: number
  unlockCurrency: 'gold' | 'gems' | 'free'
  colors: ThemeColors
  assets: ThemeAssets
}

export const THEME_DEFINITIONS: Record<ThemeId, ThemeDefinition> = {
  medieval: {
    id: 'medieval',
    name: 'Medieval',
    description: 'The classic dungeon-crawler aesthetic',
    unlockCost: 0,
    unlockCurrency: 'free',
    colors: {
      primaryButton: 0x4a9eff,
      primaryButtonHover: 0x6bb6ff,
      secondaryButton: 0x6b8e23,
      secondaryButtonHover: 0x7fa32f,
      healthFull: 0x00ff00,
      healthMid: 0xffaa00,
      healthLow: 0xff0000,
      xpBar: 0x4488ff,
      bossHealth: 0xff2222,
      titleText: '#ffffff',
      accentText: '#ffdd00',
      mutedText: '#aaaaaa',
      chapterColors: {
        1: 0x4a4a4a,
        2: 0x2d5a27,
        3: 0x4a8ab5,
        4: 0x8b2500,
        5: 0x3d1a5c,
      },
    },
    assets: {
      atreusSprite: 'atreusSprite',
      helixSprite: 'helixSprite',
      meowgikSprite: 'meowgikSprite',
      bulletSprite: 'bulletSprite',
      menuBg: 'menuBg',
      chapter1Bg: 'chapter1Bg',
      chapter2Bg: 'chapter2Bg',
      chapter3Bg: 'chapter3Bg',
      chapter4Bg: 'chapter4Bg',
      chapter5Bg: 'chapter5Bg',
      loadingBarColor: 0xffffff,
      loadingBgColor: 0x222222,
    },
  },
  vaporwave: {
    id: 'vaporwave',
    name: 'Vaporwave',
    description: 'Neon lights and retro vibes',
    unlockCost: 10000,
    unlockCurrency: 'gold',
    colors: {
      primaryButton: 0xff00ff,
      primaryButtonHover: 0xff66ff,
      secondaryButton: 0x00ffff,
      secondaryButtonHover: 0x66ffff,
      healthFull: 0x00ffff,
      healthMid: 0xff00ff,
      healthLow: 0xff0066,
      xpBar: 0xff00ff,
      bossHealth: 0xff0066,
      titleText: '#00ffff',
      accentText: '#ff00ff',
      mutedText: '#9999ff',
      chapterColors: {
        1: 0x6600cc,
        2: 0x00cc99,
        3: 0x0099ff,
        4: 0xff0066,
        5: 0x9900ff,
      },
    },
    assets: {
      atreusSprite: 'vaporwave_atreusSprite',
      helixSprite: 'vaporwave_helixSprite',
      meowgikSprite: 'vaporwave_meowgikSprite',
      bulletSprite: 'vaporwave_bulletSprite',
      menuBg: 'vaporwave_menuBg',
      chapter1Bg: 'vaporwave_chapter1Bg',
      chapter2Bg: 'vaporwave_chapter2Bg',
      chapter3Bg: 'vaporwave_chapter3Bg',
      chapter4Bg: 'vaporwave_chapter4Bg',
      chapter5Bg: 'vaporwave_chapter5Bg',
      loadingBarColor: 0xff00ff,
      loadingBgColor: 0x1a0033,
    },
  },
  lotr: {
    id: 'lotr',
    name: 'Middle-Earth',
    description: 'Journey through the realms of Tolkien',
    unlockCost: 666,
    unlockCurrency: 'gold',
    colors: {
      // Gold and forest green - Elvish aesthetic
      primaryButton: 0xd4af37, // Gold
      primaryButtonHover: 0xffd700, // Bright gold
      secondaryButton: 0x2e5d34, // Forest green
      secondaryButtonHover: 0x3e7d44, // Lighter forest green
      // Health bar - green to gold to Mordor red
      healthFull: 0x4a7c59, // Elvish green
      healthMid: 0xd4af37, // Gold (One Ring)
      healthLow: 0x8b0000, // Dark red (Eye of Sauron)
      // XP and boss - gold and Mordor fire
      xpBar: 0xd4af37, // Gold
      bossHealth: 0xff4500, // Mordor orange-red
      // Text colors - parchment and gold
      titleText: '#f5deb3', // Wheat/parchment
      accentText: '#ffd700', // Gold
      mutedText: '#8b7355', // Tan/brown
      // Chapter colors themed to Middle-Earth locations
      chapterColors: {
        1: 0x228b22, // The Shire - forest green
        2: 0x4682b4, // Rivendell - steel blue
        3: 0x2f4f4f, // Moria - dark slate gray
        4: 0x8b0000, // Mordor - dark red
        5: 0x1c1c1c, // Mount Doom - near black
      },
    },
    assets: {
      atreusSprite: 'lotr_atreusSprite',
      helixSprite: 'lotr_helixSprite',
      meowgikSprite: 'lotr_meowgikSprite',
      bulletSprite: 'lotr_bulletSprite',
      menuBg: 'lotr_menuBg',
      chapter1Bg: 'lotr_chapter1Bg',
      chapter2Bg: 'lotr_chapter2Bg',
      chapter3Bg: 'lotr_chapter3Bg',
      chapter4Bg: 'lotr_chapter4Bg',
      chapter5Bg: 'lotr_chapter5Bg',
      loadingBarColor: 0xd4af37, // Gold
      loadingBgColor: 0x1a1a0a, // Dark parchment
    },
  },
  strangerThings: {
    id: 'strangerThings',
    name: 'Upside Down',
    description: 'Enter the dark dimension from Hawkins',
    unlockCost: 44,
    unlockCurrency: 'gems',
    colors: {
      // Red and dark - Upside Down aesthetic
      primaryButton: 0xcc0000, // Stranger Things red
      primaryButtonHover: 0xff0000, // Bright red
      secondaryButton: 0x1a1a2e, // Dark blue-black
      secondaryButtonHover: 0x2a2a4e, // Slightly lighter
      // Health bar - eerie colors
      healthFull: 0x00ff88, // Toxic green (like Eleven's powers)
      healthMid: 0xffaa00, // Warning orange
      healthLow: 0xcc0000, // Danger red
      // XP and boss - glowing red/purple
      xpBar: 0xff00aa, // Pink-purple (psychic energy)
      bossHealth: 0xcc0000, // Demogorgon red
      // Text colors - flickering lights aesthetic
      titleText: '#ff0000', // Red (like the Christmas lights)
      accentText: '#00ff88', // Electric green
      mutedText: '#666688', // Faded blue-gray
      // Chapter colors themed to Stranger Things locations
      chapterColors: {
        1: 0x2e4a1e, // Hawkins - small town green
        2: 0x4a4a6e, // Hawkins Lab - sterile purple-gray
        3: 0x1a0a0a, // The Upside Down - dark red-black
        4: 0x3a1a4a, // The Void - deep purple
        5: 0x0a0a1a, // The Mind Flayer - pitch black with hint of blue
      },
    },
    assets: {
      atreusSprite: 'st_atreusSprite',
      helixSprite: 'st_helixSprite',
      meowgikSprite: 'st_meowgikSprite',
      bulletSprite: 'st_bulletSprite',
      menuBg: 'st_menuBg',
      chapter1Bg: 'st_chapter1Bg',
      chapter2Bg: 'st_chapter2Bg',
      chapter3Bg: 'st_chapter3Bg',
      chapter4Bg: 'st_chapter4Bg',
      chapter5Bg: 'st_chapter5Bg',
      loadingBarColor: 0xcc0000, // Stranger Things red
      loadingBgColor: 0x0a0a0a, // Near black
    },
  },
}

export function getAllThemeIds(): ThemeId[] {
  return Object.keys(THEME_DEFINITIONS) as ThemeId[]
}

export function isValidThemeId(id: string): id is ThemeId {
  return id in THEME_DEFINITIONS
}

export function getThemeDefinition(id: ThemeId): ThemeDefinition {
  return THEME_DEFINITIONS[id]
}

export type HeroId = 'atreus' | 'helix' | 'meowgik'

// Map heroId to the corresponding sprite key in ThemeAssets
export function getHeroSpriteKey(
  heroId: HeroId,
  assets: ThemeAssets
): string {
  switch (heroId) {
    case 'atreus':
      return assets.atreusSprite
    case 'helix':
      return assets.helixSprite
    case 'meowgik':
      return assets.meowgikSprite
    default:
      return assets.atreusSprite
  }
}
