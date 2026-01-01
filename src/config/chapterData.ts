/**
 * Chapter configuration data and definitions.
 * Defines all 5 chapters with themes, enemy rosters, and room layouts.
 */

// ============================================
// Type Definitions
// ============================================

/**
 * Valid chapter identifiers (1-5)
 */
export type ChapterId = 1 | 2 | 3 | 4 | 5

/**
 * Enemy types available in the game
 * MVP enemies: melee, ranged, spreader
 * V1 enemies: bomber, burrower, tank, charger, healer, spawner
 */
export type EnemyType =
  | 'melee'
  | 'ranged'
  | 'spreader'
  | 'bomber'
  | 'burrower'
  | 'tank'
  | 'charger'
  | 'healer'
  | 'spawner'

/**
 * Room types within a chapter
 */
export type RoomType = 'combat' | 'angel' | 'miniboss' | 'boss'

/**
 * Boss types for each chapter
 */
export type BossType =
  | 'demon' // Chapter 1 - Dark Dungeon
  | 'treant' // Chapter 2 - Forest Ruins
  | 'frost_giant' // Chapter 3 - Frozen Caves
  | 'magma_wyrm' // Chapter 4 - Volcanic Depths
  | 'void_lord' // Chapter 5 - Shadow Realm

/**
 * Chapter theme configuration
 */
export interface ChapterTheme {
  /** Background asset key */
  backgroundKey: string
  /** Tile/floor asset key */
  floorKey: string
  /** Primary color for UI elements */
  primaryColor: number
  /** Secondary/accent color */
  accentColor: number
  /** Ambient music track key */
  musicKey: string
}

/**
 * Difficulty scaling for a chapter
 */
export interface ChapterScaling {
  /** Enemy HP multiplier (base = 1.0) */
  enemyHpMultiplier: number
  /** Enemy damage multiplier (base = 1.0) */
  enemyDamageMultiplier: number
  /** Additional enemies per room compared to chapter 1 */
  extraEnemiesPerRoom: number
  /** Boss HP multiplier (base = 1.0) */
  bossHpMultiplier: number
  /** Boss damage multiplier (base = 1.0) */
  bossDamageMultiplier: number
}

/**
 * Reward configuration for chapter completion
 */
export interface ChapterRewards {
  /** Base gold reward */
  gold: number
  /** Base gem reward */
  gems: number
  /** Base scroll reward */
  scrolls: number
}

/**
 * Complete chapter definition
 */
export interface ChapterDefinition {
  /** Chapter ID (1-5) */
  id: ChapterId
  /** Display name */
  name: string
  /** Short description */
  description: string
  /** Total rooms in this chapter */
  totalRooms: number
  /** Theme configuration */
  theme: ChapterTheme
  /** Available enemy types for this chapter */
  enemyTypes: EnemyType[]
  /** Boss type for chapter boss fight */
  bossType: BossType
  /** Mini-boss type (typically a stronger version of an enemy) */
  miniBossType: EnemyType
  /** Difficulty scaling compared to base */
  scaling: ChapterScaling
  /** Completion rewards */
  rewards: ChapterRewards
  /** First-time completion bonus multiplier */
  firstTimeBonus: number
}

/**
 * Room layout within a chapter
 * Defines which room numbers are which type
 */
export interface ChapterRoomLayout {
  /** Combat rooms (most rooms) */
  combatRooms: number[]
  /** Angel rooms (heal or ability choice) */
  angelRooms: number[]
  /** Mini-boss rooms */
  miniBossRooms: number[]
  /** Boss room (final room) */
  bossRoom: number
}

// ============================================
// Constants
// ============================================

/** Total rooms per chapter */
export const ROOMS_PER_CHAPTER = 20

/** Star rating thresholds */
export const STAR_THRESHOLDS = {
  /** 1 star: Just complete the chapter */
  ONE_STAR: 0, // Always awarded on completion
  /** 2 stars: Complete with >50% HP remaining */
  TWO_STAR_HP_THRESHOLD: 0.5,
  /** 3 stars: Complete with no deaths during run */
  THREE_STAR_NO_DEATHS: true,
}

/** Star reward multipliers */
export const STAR_REWARD_MULTIPLIERS = {
  1: 1.0,
  2: 1.5,
  3: 2.0,
}

// ============================================
// Room Layout (Same for all chapters)
// ============================================

/**
 * Standard room layout for all chapters:
 * - Rooms 1-4: Combat
 * - Room 5: Angel
 * - Rooms 6-9: Combat
 * - Room 10: Mini-boss
 * - Rooms 11-14: Combat
 * - Room 15: Angel
 * - Rooms 16-19: Combat
 * - Room 20: Chapter Boss
 */
export const STANDARD_ROOM_LAYOUT: ChapterRoomLayout = {
  combatRooms: [1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19],
  angelRooms: [5, 15],
  miniBossRooms: [10],
  bossRoom: 20,
}

/**
 * Get the room type for a given room number
 */
export function getRoomTypeForNumber(roomNumber: number): RoomType {
  if (roomNumber === STANDARD_ROOM_LAYOUT.bossRoom) {
    return 'boss'
  }
  if (STANDARD_ROOM_LAYOUT.miniBossRooms.includes(roomNumber)) {
    return 'miniboss'
  }
  if (STANDARD_ROOM_LAYOUT.angelRooms.includes(roomNumber)) {
    return 'angel'
  }
  return 'combat'
}

// ============================================
// Chapter Definitions
// ============================================

export const CHAPTER_DEFINITIONS: Record<ChapterId, ChapterDefinition> = {
  1: {
    id: 1,
    name: 'Dark Dungeon',
    description: 'Ancient stone corridors lit by flickering torches.',
    totalRooms: ROOMS_PER_CHAPTER,
    theme: {
      backgroundKey: 'bg_dungeon',
      floorKey: 'floor_stone',
      primaryColor: 0x4a4a4a,
      accentColor: 0xff6600,
      musicKey: 'music_dungeon',
    },
    enemyTypes: ['melee', 'ranged', 'spreader'],
    bossType: 'demon',
    miniBossType: 'spreader', // Larger spreader as mini-boss
    scaling: {
      enemyHpMultiplier: 1.0,
      enemyDamageMultiplier: 1.0,
      extraEnemiesPerRoom: 0,
      bossHpMultiplier: 1.0,
      bossDamageMultiplier: 1.0,
    },
    rewards: {
      gold: 500,
      gems: 20,
      scrolls: 2,
    },
    firstTimeBonus: 2.0, // Double rewards on first completion
  },
  2: {
    id: 2,
    name: 'Forest Ruins',
    description: 'Overgrown temples reclaimed by nature.',
    totalRooms: ROOMS_PER_CHAPTER,
    theme: {
      backgroundKey: 'bg_forest',
      floorKey: 'floor_moss',
      primaryColor: 0x2d5a27,
      accentColor: 0x8bc34a,
      musicKey: 'music_forest',
    },
    enemyTypes: ['melee', 'ranged', 'spreader', 'bomber', 'burrower'],
    bossType: 'treant',
    miniBossType: 'bomber',
    scaling: {
      enemyHpMultiplier: 1.2, // +20% HP
      enemyDamageMultiplier: 1.15, // +15% damage
      extraEnemiesPerRoom: 1,
      bossHpMultiplier: 1.5, // +50% HP
      bossDamageMultiplier: 1.15,
    },
    rewards: {
      gold: 750,
      gems: 30,
      scrolls: 3,
    },
    firstTimeBonus: 2.0,
  },
  3: {
    id: 3,
    name: 'Frozen Caves',
    description: 'Glacial caverns with crystalline formations.',
    totalRooms: ROOMS_PER_CHAPTER,
    theme: {
      backgroundKey: 'bg_ice',
      floorKey: 'floor_ice',
      primaryColor: 0x87ceeb,
      accentColor: 0x00bfff,
      musicKey: 'music_ice',
    },
    enemyTypes: ['melee', 'ranged', 'spreader', 'bomber', 'burrower', 'tank', 'charger'],
    bossType: 'frost_giant',
    miniBossType: 'tank',
    scaling: {
      enemyHpMultiplier: 1.4, // +40% HP
      enemyDamageMultiplier: 1.3, // +30% damage
      extraEnemiesPerRoom: 2,
      bossHpMultiplier: 2.0, // +100% HP
      bossDamageMultiplier: 1.3,
    },
    rewards: {
      gold: 1000,
      gems: 50,
      scrolls: 4,
    },
    firstTimeBonus: 2.0,
  },
  4: {
    id: 4,
    name: 'Volcanic Depths',
    description: 'Lava flows and scorching heat.',
    totalRooms: ROOMS_PER_CHAPTER,
    theme: {
      backgroundKey: 'bg_volcano',
      floorKey: 'floor_obsidian',
      primaryColor: 0x8b0000,
      accentColor: 0xff4500,
      musicKey: 'music_volcano',
    },
    enemyTypes: ['melee', 'ranged', 'spreader', 'bomber', 'burrower', 'tank', 'charger', 'healer'],
    bossType: 'magma_wyrm',
    miniBossType: 'charger',
    scaling: {
      enemyHpMultiplier: 1.6, // +60% HP
      enemyDamageMultiplier: 1.45, // +45% damage
      extraEnemiesPerRoom: 3,
      bossHpMultiplier: 2.5, // +150% HP
      bossDamageMultiplier: 1.45,
    },
    rewards: {
      gold: 1500,
      gems: 75,
      scrolls: 5,
    },
    firstTimeBonus: 2.0,
  },
  5: {
    id: 5,
    name: 'Shadow Realm',
    description: 'The void between worlds. Ultimate darkness.',
    totalRooms: ROOMS_PER_CHAPTER,
    theme: {
      backgroundKey: 'bg_void',
      floorKey: 'floor_void',
      primaryColor: 0x1a0033,
      accentColor: 0x9932cc,
      musicKey: 'music_void',
    },
    enemyTypes: [
      'melee',
      'ranged',
      'spreader',
      'bomber',
      'burrower',
      'tank',
      'charger',
      'healer',
      'spawner',
    ],
    bossType: 'void_lord',
    miniBossType: 'spawner',
    scaling: {
      enemyHpMultiplier: 1.8, // +80% HP
      enemyDamageMultiplier: 1.6, // +60% damage
      extraEnemiesPerRoom: 4,
      bossHpMultiplier: 3.0, // +200% HP
      bossDamageMultiplier: 1.6,
    },
    rewards: {
      gold: 2500,
      gems: 100,
      scrolls: 8,
    },
    firstTimeBonus: 2.0,
  },
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get chapter definition by ID
 */
export function getChapterDefinition(chapterId: ChapterId): ChapterDefinition {
  return CHAPTER_DEFINITIONS[chapterId]
}

/**
 * Get all chapter IDs
 */
export function getAllChapterIds(): ChapterId[] {
  return [1, 2, 3, 4, 5]
}

/**
 * Check if a chapter ID is valid
 */
export function isValidChapterId(id: number): id is ChapterId {
  return id >= 1 && id <= 5
}

/**
 * Get enemy pool for a specific chapter
 * Returns all enemy types available in that chapter
 */
export function getEnemyPoolForChapter(chapterId: ChapterId): EnemyType[] {
  return [...CHAPTER_DEFINITIONS[chapterId].enemyTypes]
}

/**
 * Get base enemies per room for a chapter
 * Starts with 3 enemies in chapter 1, increases with chapter scaling
 */
export function getBaseEnemiesPerRoom(chapterId: ChapterId, roomNumber: number): number {
  const baseCount = 3
  const chapter = CHAPTER_DEFINITIONS[chapterId]

  // Room scaling: later rooms have more enemies
  const roomScaling = Math.floor(roomNumber / 5) // +1 enemy every 5 rooms

  // Mini-boss rooms have fewer but tougher enemies
  if (STANDARD_ROOM_LAYOUT.miniBossRooms.includes(roomNumber)) {
    return 1 // Just the mini-boss
  }

  // Boss rooms
  if (roomNumber === STANDARD_ROOM_LAYOUT.bossRoom) {
    return 1 // Just the boss
  }

  // Angel rooms have no enemies
  if (STANDARD_ROOM_LAYOUT.angelRooms.includes(roomNumber)) {
    return 0
  }

  return baseCount + chapter.scaling.extraEnemiesPerRoom + roomScaling
}

/**
 * Calculate total difficulty multiplier for enemy stats
 * Combines chapter scaling with difficulty setting
 */
export function getEnemyHpForChapter(
  chapterId: ChapterId,
  baseHp: number,
  difficultyMultiplier: number = 1.0
): number {
  const chapter = CHAPTER_DEFINITIONS[chapterId]
  return Math.round(baseHp * chapter.scaling.enemyHpMultiplier * difficultyMultiplier)
}

/**
 * Calculate enemy damage for a chapter
 */
export function getEnemyDamageForChapter(
  chapterId: ChapterId,
  baseDamage: number,
  difficultyMultiplier: number = 1.0
): number {
  const chapter = CHAPTER_DEFINITIONS[chapterId]
  return Math.round(baseDamage * chapter.scaling.enemyDamageMultiplier * difficultyMultiplier)
}

/**
 * Calculate boss HP for a chapter
 */
export function getBossHpForChapter(
  chapterId: ChapterId,
  baseHp: number,
  difficultyMultiplier: number = 1.0
): number {
  const chapter = CHAPTER_DEFINITIONS[chapterId]
  return Math.round(baseHp * chapter.scaling.bossHpMultiplier * difficultyMultiplier)
}

/**
 * Calculate boss damage for a chapter
 */
export function getBossDamageForChapter(
  chapterId: ChapterId,
  baseDamage: number,
  difficultyMultiplier: number = 1.0
): number {
  const chapter = CHAPTER_DEFINITIONS[chapterId]
  return Math.round(baseDamage * chapter.scaling.bossDamageMultiplier * difficultyMultiplier)
}

/**
 * Calculate star rating based on run performance
 * @param completed Whether the chapter was completed
 * @param hpRemaining Current HP at completion
 * @param maxHp Maximum HP
 * @param deathsDuringRun Number of deaths during the run
 * @returns Star rating (0-3)
 */
export function calculateStarRating(
  completed: boolean,
  hpRemaining: number,
  maxHp: number,
  deathsDuringRun: number
): 0 | 1 | 2 | 3 {
  if (!completed) {
    return 0
  }

  let stars: 0 | 1 | 2 | 3 = 1 // Base star for completion

  // 2 stars: Complete with >50% HP
  const hpPercentage = maxHp > 0 ? hpRemaining / maxHp : 0
  if (hpPercentage > STAR_THRESHOLDS.TWO_STAR_HP_THRESHOLD) {
    stars = 2
  }

  // 3 stars: Complete with no deaths
  if (deathsDuringRun === 0 && hpPercentage > STAR_THRESHOLDS.TWO_STAR_HP_THRESHOLD) {
    stars = 3
  }

  return stars
}

/**
 * Calculate chapter completion rewards
 * @param chapterId The completed chapter
 * @param stars Star rating achieved (1-3)
 * @param firstTime Whether this is the first time completing
 */
export function calculateChapterRewards(
  chapterId: ChapterId,
  stars: 1 | 2 | 3,
  firstTime: boolean
): ChapterRewards {
  const chapter = CHAPTER_DEFINITIONS[chapterId]
  const starMultiplier = STAR_REWARD_MULTIPLIERS[stars]
  const firstTimeMultiplier = firstTime ? chapter.firstTimeBonus : 1.0

  return {
    gold: Math.floor(chapter.rewards.gold * starMultiplier * firstTimeMultiplier),
    gems: Math.floor(chapter.rewards.gems * starMultiplier * firstTimeMultiplier),
    scrolls: Math.floor(chapter.rewards.scrolls * starMultiplier * firstTimeMultiplier),
  }
}

/**
 * Get the next chapter ID (or null if at max)
 */
export function getNextChapterId(currentChapterId: ChapterId): ChapterId | null {
  if (currentChapterId >= 5) {
    return null
  }
  return (currentChapterId + 1) as ChapterId
}

/**
 * Get the previous chapter ID (or null if at first)
 */
export function getPreviousChapterId(currentChapterId: ChapterId): ChapterId | null {
  if (currentChapterId <= 1) {
    return null
  }
  return (currentChapterId - 1) as ChapterId
}
