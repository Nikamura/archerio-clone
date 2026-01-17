// Theme colors (medieval)
export const THEME_COLORS = {
  primaryButton: 0x4a9eff,
  primaryButtonHover: 0x6bb6ff,
  secondaryButton: 0x6b8e23,
  secondaryButtonHover: 0x7fa32f,
  healthFull: 0x00ff00,
  healthMid: 0xffaa00,
  healthLow: 0xff0000,
  xpBar: 0x4488ff,
  bossHealth: 0xff2222,
  bossNamePrimary: "#ffd700",
  bossNameSecondary: "#ff4444",
  bossNameStroke: "#2a0000",
  titleText: "#ffffff",
  accentText: "#ffdd00",
  mutedText: "#aaaaaa",
  chapterColors: {
    1: 0x4a4a4a,
    2: 0x2d5a27,
    3: 0x4a8ab5,
    4: 0x8b2500,
    5: 0x3d1a5c,
  } as Record<number, number>,
};

// Theme assets (medieval)
export const THEME_ASSETS = {
  atreusSprite: "atreusSprite",
  helixSprite: "helixSprite",
  meowgikSprite: "meowgikSprite",
  bulletSprite: "bulletSprite",
  menuBg: "menuBg",
  playButton: "playButton_medieval",
  chapter1Bg: "chapter1Bg",
  chapter2Bg: "chapter2Bg",
  chapter3Bg: "chapter3Bg",
  chapter4Bg: "chapter4Bg",
  chapter5Bg: "chapter5Bg",
  chapter1Icon: "chapter1Icon_medieval",
  chapter2Icon: "chapter2Icon_medieval",
  chapter3Icon: "chapter3Icon_medieval",
  chapter4Icon: "chapter4Icon_medieval",
  chapter5Icon: "chapter5Icon_medieval",
  loadingBarColor: 0xffffff,
  loadingBgColor: 0x222222,
  enemyMelee: "enemyMelee",
  enemyRanged: "enemyRanged",
  enemySpreader: "enemySpreader",
  enemyHealer: "enemyHealer",
  enemySpawner: "enemySpawner",
  enemyBomber: "enemyBomber",
  enemyCharger: "enemyCharger",
  enemyBurrower: "enemyBurrower",
  enemyTank: "enemyTank",
  enemyMinion: "enemyMinion",
};

export type HeroId = "atreus" | "helix" | "meowgik";

// Map enemyType to the corresponding sprite key
export function getEnemySpriteKey(enemyType: string): string {
  switch (enemyType) {
    case "melee":
      return THEME_ASSETS.enemyMelee;
    case "ranged":
      return THEME_ASSETS.enemyRanged;
    case "spreader":
      return THEME_ASSETS.enemySpreader;
    case "healer":
      return THEME_ASSETS.enemyHealer;
    case "spawner":
      return THEME_ASSETS.enemySpawner;
    case "bomber":
      return THEME_ASSETS.enemyBomber;
    case "charger":
      return THEME_ASSETS.enemyCharger;
    case "burrower":
      return THEME_ASSETS.enemyBurrower;
    case "tank":
      return THEME_ASSETS.enemyTank;
    case "minion":
      return THEME_ASSETS.enemyMinion;
    default:
      return THEME_ASSETS.enemyMelee;
  }
}

// Map heroId to the corresponding sprite key
export function getHeroSpriteKey(heroId: HeroId): string {
  switch (heroId) {
    case "atreus":
      return THEME_ASSETS.atreusSprite;
    case "helix":
      return THEME_ASSETS.helixSprite;
    case "meowgik":
      return THEME_ASSETS.meowgikSprite;
    default:
      return THEME_ASSETS.atreusSprite;
  }
}

// Default enemy names
const DEFAULT_ENEMY_NAMES: Record<string, string> = {
  melee: "Slime",
  ranged: "Skeleton Archer",
  spreader: "Spreader",
  bomber: "Bomber",
  tank: "Tank",
  charger: "Charger",
  healer: "Healer",
  spawner: "Spawner",
};

// Get enemy name for encyclopedia
export function getEnemyName(enemyType: string): string {
  return DEFAULT_ENEMY_NAMES[enemyType] ?? enemyType;
}

// Chapter to floor tile type mapping
const CHAPTER_FLOOR_TYPES: Record<number, string> = {
  1: "dungeon",
  2: "forest",
  3: "ice",
  4: "lava",
  5: "shadow",
};

// Get floor texture key for a chapter
export function getChapterFloorType(chapter: number): string {
  return CHAPTER_FLOOR_TYPES[chapter] ?? "dungeon";
}
