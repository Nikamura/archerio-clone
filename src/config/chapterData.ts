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
 * V1 enemies: bomber, tank, charger, healer, spawner
 */
export type EnemyType =
  | 'melee'
  | 'ranged'
  | 'spreader'
  | 'bomber'
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
 * Each chapter has 3 bosses (room 10 miniboss variant, room 20 main boss, room 20 alternate)
 */
export type BossType =
  // Chapter 1 - Dark Dungeon
  | 'demon'
  // Chapter 2 - Forest Ruins
  | 'treant'
  | 'tree_guardian'
  | 'wild_boar'
  | 'forest_spirit'
  // Chapter 3 - Frozen Caves
  | 'frost_giant'
  | 'ice_golem'
  | 'frost_wyrm'
  | 'crystal_guardian'
  // Chapter 4 - Volcanic Depths
  | 'lava_golem'
  | 'magma_wyrm'
  | 'inferno_demon'
  // Chapter 5 - Shadow Realm
  | 'void_lord'
  | 'nightmare'
  | 'final_boss'

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
 * Per-enemy-type stat modifiers for a chapter
 * These make each chapter feel unique by adjusting enemy behavior
 */
export interface EnemyChapterModifiers {
  /** Movement speed multiplier (1.0 = normal) */
  speedMultiplier?: number
  /** Attack speed/cooldown multiplier (lower = faster attacks) */
  attackCooldownMultiplier?: number
  /** Projectile speed multiplier for ranged enemies (1.0 = normal) */
  projectileSpeedMultiplier?: number
  /** Spawn selection weight for this enemy in this chapter (1.0 = normal) */
  spawnWeight?: number
  /** Special ability intensity (e.g., healer heal amount, spawner spawn rate) */
  abilityIntensityMultiplier?: number
}

/**
 * Enemy modifiers for all enemy types in a chapter
 */
export type ChapterEnemyModifiers = Partial<Record<EnemyType, EnemyChapterModifiers>>

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
  /** Available tactical combination names for this chapter */
  tacticComboNames: string[]
  /** Boss type for chapter boss fight */
  bossType: BossType
  /** All boss types available in this chapter (for variety) */
  bossPool: BossType[]
  /** Mini-boss type (typically a stronger version of an enemy) */
  miniBossType: EnemyType
  /** Difficulty scaling compared to base */
  scaling: ChapterScaling
  /** Per-enemy-type behavior modifiers for this chapter */
  enemyModifiers: ChapterEnemyModifiers
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
      backgroundKey: 'chapter1Bg',
      floorKey: 'floor_stone',
      primaryColor: 0x4a4a4a,
      accentColor: 0xff6600,
      musicKey: 'music_dungeon',
    },
    enemyTypes: ['melee', 'ranged', 'spreader'],
    tacticComboNames: ['Melee Rush', 'Ranged Support', 'Spread Formation'],
    bossType: 'demon',
    bossPool: ['demon'],
    miniBossType: 'spreader', // Larger spreader as mini-boss
    scaling: {
      enemyHpMultiplier: 1.0,
      enemyDamageMultiplier: 1.0,
      extraEnemiesPerRoom: 0,
      bossHpMultiplier: 1.0,
      bossDamageMultiplier: 1.0,
    },
    // Chapter 1: Standard enemy behavior (tutorial chapter)
    enemyModifiers: {
      melee: { spawnWeight: 1.5 }, // More melee in early chapter
      ranged: { spawnWeight: 1.0 },
      spreader: { spawnWeight: 0.8 }, // Slightly fewer spreaders
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
      backgroundKey: 'chapter2Bg',
      floorKey: 'floor_moss',
      primaryColor: 0x2d5a27,
      accentColor: 0x8bc34a,
      musicKey: 'music_forest',
    },
    enemyTypes: ['melee', 'ranged', 'spreader', 'bomber'],
    tacticComboNames: [
      'Ranged Support',
      'Sniper Nest',
      'Spread Formation',
      'Bomber Support',
      'Melee Rush',
      'Fire Support',
    ],
    bossType: 'treant',
    bossPool: ['treant', 'tree_guardian', 'wild_boar', 'forest_spirit'],
    miniBossType: 'bomber',
    scaling: {
      enemyHpMultiplier: 2.5, // Exponential scaling: ~2.5x per chapter
      enemyDamageMultiplier: 1.3,
      extraEnemiesPerRoom: 1,
      bossHpMultiplier: 3.0,
      bossDamageMultiplier: 1.3,
    },
    // Chapter 2: Forest theme - ranged focus, agile melee
    enemyModifiers: {
      melee: {
        speedMultiplier: 1.15, // Forest creatures are agile
        spawnWeight: 1.0,
      },
      ranged: {
        projectileSpeedMultiplier: 1.2, // Faster arrows
        spawnWeight: 1.5, // More ranged enemies
      },
      spreader: {
        attackCooldownMultiplier: 0.9, // Slightly faster attacks
        spawnWeight: 1.0,
      },
      bomber: {
        speedMultiplier: 0.85, // Slower movement
        abilityIntensityMultiplier: 1.2, // Larger/more dangerous explosions
        spawnWeight: 1.2,
      },
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
      backgroundKey: 'chapter3Bg',
      floorKey: 'floor_ice',
      primaryColor: 0x87ceeb,
      accentColor: 0x00bfff,
      musicKey: 'music_ice',
    },
    enemyTypes: ['melee', 'spreader', 'tank', 'charger'],
    tacticComboNames: [
      'Spread Formation',
      'Charge Assault',
      'Blitz Squad',
      'Double Trouble',
      'Heavy Hitters',
    ],
    bossType: 'frost_giant',
    bossPool: ['frost_giant', 'ice_golem', 'frost_wyrm', 'crystal_guardian'],
    miniBossType: 'tank',
    scaling: {
      enemyHpMultiplier: 7.0, // Exponential scaling continues
      enemyDamageMultiplier: 1.6,
      extraEnemiesPerRoom: 2,
      bossHpMultiplier: 8.0,
      bossDamageMultiplier: 1.6,
    },
    // Chapter 3: Ice theme - slow but powerful, chargers are deadly
    enemyModifiers: {
      melee: {
        speedMultiplier: 0.85, // Slowed by ice
        attackCooldownMultiplier: 1.1, // Slower attacks
        spawnWeight: 1.0,
      },
      spreader: {
        speedMultiplier: 0.8, // Very slow
        projectileSpeedMultiplier: 1.15, // But faster projectiles
        spawnWeight: 1.2,
      },
      tank: {
        speedMultiplier: 0.75, // Extra slow
        attackCooldownMultiplier: 1.3, // Much slower attacks but devastating
        spawnWeight: 1.5, // More tanks in frozen caves
      },
      charger: {
        speedMultiplier: 1.3, // Ice makes them slide faster when charging!
        attackCooldownMultiplier: 0.8, // Charge more often
        spawnWeight: 1.3,
      },
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
      backgroundKey: 'chapter4Bg',
      floorKey: 'floor_obsidian',
      primaryColor: 0x8b0000,
      accentColor: 0xff4500,
      musicKey: 'music_volcano',
    },
    enemyTypes: ['melee', 'ranged', 'bomber', 'healer', 'spawner'],
    tacticComboNames: [
      'Bomber Support',
      'Healer Tank',
      'Siege Warfare',
      'Spawner Den',
      'Full Support',
      'Fire Support',
      'Guardian Formation',
    ],
    bossType: 'inferno_demon', // Main boss for chapter 4
    bossPool: ['lava_golem', 'magma_wyrm', 'inferno_demon'], // All chapter 4 bosses
    miniBossType: 'healer',
    scaling: {
      enemyHpMultiplier: 18.0, // Exponential scaling ramps up
      enemyDamageMultiplier: 2.0,
      extraEnemiesPerRoom: 3,
      bossHpMultiplier: 20.0,
      bossDamageMultiplier: 2.0,
    },
    // Chapter 4: Fire theme - fast and aggressive, support enemies are key targets
    enemyModifiers: {
      melee: {
        speedMultiplier: 1.2, // Fire-powered speed
        attackCooldownMultiplier: 0.85, // Faster attacks
        spawnWeight: 1.0,
      },
      ranged: {
        attackCooldownMultiplier: 0.8, // Rapid fire
        projectileSpeedMultiplier: 1.25, // Fast fireballs
        spawnWeight: 1.0,
      },
      bomber: {
        speedMultiplier: 1.1,
        attackCooldownMultiplier: 0.75, // Throws bombs very often
        abilityIntensityMultiplier: 1.3, // Larger explosions
        spawnWeight: 1.4,
      },
      healer: {
        speedMultiplier: 1.1, // Harder to catch
        abilityIntensityMultiplier: 1.4, // Heals more
        spawnWeight: 1.3, // More healers to prioritize
      },
      spawner: {
        attackCooldownMultiplier: 0.7, // Spawns minions faster
        abilityIntensityMultiplier: 1.3, // More minions
        spawnWeight: 1.2,
      },
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
      backgroundKey: 'chapter5Bg',
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
      'tank',
      'charger',
      'healer',
      'spawner',
    ],
    tacticComboNames: [
      'Chaos Formation',
      'Full Support',
      'Infinite Army',
      'Heavy Hitters',
      'Elite Guard',
      'Fire Support',
      'Coordinated Strike',
      'Guardian Formation',
      'Artillery Line',
    ],
    bossType: 'final_boss', // Main boss for chapter 5 (final challenge)
    bossPool: ['void_lord', 'nightmare', 'final_boss'], // All chapter 5 bosses
    miniBossType: 'spawner',
    scaling: {
      enemyHpMultiplier: 50.0, // 50x harder than chapter 1
      enemyDamageMultiplier: 2.5,
      extraEnemiesPerRoom: 4,
      bossHpMultiplier: 60.0,
      bossDamageMultiplier: 2.5,
    },
    // Chapter 5: Shadow Realm - CHAOS! All enemies at maximum danger
    enemyModifiers: {
      melee: {
        speedMultiplier: 1.25, // Very fast
        attackCooldownMultiplier: 0.75, // Rapid attacks
        spawnWeight: 0.8, // Fewer basic melee
      },
      ranged: {
        attackCooldownMultiplier: 0.7, // Very rapid fire
        projectileSpeedMultiplier: 1.35, // Very fast projectiles
        spawnWeight: 1.0,
      },
      spreader: {
        attackCooldownMultiplier: 0.65, // Constant projectile spam
        projectileSpeedMultiplier: 1.2,
        spawnWeight: 1.2,
      },
      bomber: {
        speedMultiplier: 1.2,
        attackCooldownMultiplier: 0.6, // Bombs everywhere
        abilityIntensityMultiplier: 1.5, // Huge explosions
        spawnWeight: 1.3,
      },
      tank: {
        speedMultiplier: 0.9, // Still slow but not as slow
        attackCooldownMultiplier: 0.7, // Faster devastating attacks
        spawnWeight: 1.2,
      },
      charger: {
        speedMultiplier: 1.4, // Extremely fast charges
        attackCooldownMultiplier: 0.65, // Charge very often
        spawnWeight: 1.4,
      },
      healer: {
        speedMultiplier: 1.2,
        attackCooldownMultiplier: 0.6, // Heals very frequently
        abilityIntensityMultiplier: 1.6, // Massive heals
        spawnWeight: 1.5, // Priority targets
      },
      spawner: {
        attackCooldownMultiplier: 0.5, // Constant minion spawning
        abilityIntensityMultiplier: 1.5, // More minions per spawn
        spawnWeight: 1.4,
      },
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

/**
 * Get a random boss from the chapter's boss pool
 * @param chapterId The chapter to get a boss for
 * @param rng Optional seeded random generator (uses Math.random if not provided)
 * @returns A random BossType from the chapter's pool
 */
export function getRandomBossForChapter(chapterId: ChapterId, rng?: { random: () => number }): BossType {
  const chapter = CHAPTER_DEFINITIONS[chapterId]
  const pool = chapter.bossPool

  if (pool.length === 0) {
    return chapter.bossType // Fallback to main boss
  }

  const randomValue = rng ? rng.random() : Math.random()
  const randomIndex = Math.floor(randomValue * pool.length)
  return pool[randomIndex]
}

/**
 * Get the main boss type for a chapter
 * @param chapterId The chapter to get the boss for
 * @returns The main BossType for the chapter
 */
export function getMainBossForChapter(chapterId: ChapterId): BossType {
  return CHAPTER_DEFINITIONS[chapterId].bossType
}

/**
 * Get all boss types in a chapter's pool
 * @param chapterId The chapter to get bosses for
 * @returns Array of all BossTypes available in the chapter
 */
export function getBossPoolForChapter(chapterId: ChapterId): BossType[] {
  return [...CHAPTER_DEFINITIONS[chapterId].bossPool]
}

/**
 * Get enemy modifiers for a specific enemy type in a chapter
 * @param chapterId The chapter to get modifiers for
 * @param enemyType The enemy type to get modifiers for
 * @returns The modifiers for this enemy in this chapter, or default values
 */
export function getEnemyModifiers(
  chapterId: ChapterId,
  enemyType: EnemyType
): EnemyChapterModifiers {
  const chapter = CHAPTER_DEFINITIONS[chapterId]
  const modifiers = chapter.enemyModifiers[enemyType]

  // Return modifiers with defaults for any missing values
  return {
    speedMultiplier: modifiers?.speedMultiplier ?? 1.0,
    attackCooldownMultiplier: modifiers?.attackCooldownMultiplier ?? 1.0,
    projectileSpeedMultiplier: modifiers?.projectileSpeedMultiplier ?? 1.0,
    spawnWeight: modifiers?.spawnWeight ?? 1.0,
    abilityIntensityMultiplier: modifiers?.abilityIntensityMultiplier ?? 1.0,
  }
}

/**
 * Get all enemy modifiers for a chapter
 * @param chapterId The chapter to get all modifiers for
 * @returns All enemy modifiers defined for this chapter
 */
export function getChapterEnemyModifiers(chapterId: ChapterId): ChapterEnemyModifiers {
  return { ...CHAPTER_DEFINITIONS[chapterId].enemyModifiers }
}

/**
 * Get spawn weight for a specific enemy type in a chapter
 * Convenience function for room generation
 * @param chapterId The chapter
 * @param enemyType The enemy type
 * @returns The spawn weight (1.0 = normal)
 */
export function getEnemySpawnWeight(chapterId: ChapterId, enemyType: EnemyType): number {
  return getEnemyModifiers(chapterId, enemyType).spawnWeight ?? 1.0
}
