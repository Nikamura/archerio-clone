/**
 * Boss configuration data and definitions.
 * Defines all boss types with their attack patterns, stats, and visual properties.
 */

import { ChapterId } from './chapterData'

// ============================================
// Type Definitions
// ============================================

/**
 * All boss identifiers in the game
 */
export type BossId =
  // Chapter 1 - Dark Dungeon
  | 'demon'
  // Chapter 2 - Forest Ruins
  | 'tree_guardian'
  | 'wild_boar'
  | 'forest_spirit'
  // Chapter 3 - Frozen Caves
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
 * Attack pattern types
 */
export type AttackPatternType =
  // Universal patterns
  | 'idle'
  // Chapter 1 - Demon
  | 'spread'
  | 'barrage'
  | 'charge'
  // Chapter 2 - Forest
  | 'vine_whip'
  | 'root_trap'
  | 'leaf_storm'
  | 'fast_charge'
  | 'ground_stomp'
  | 'summon_minions'
  | 'teleport'
  | 'homing_orbs'
  | 'mirror_images'
  // Chapter 3 - Ice
  | 'ice_breath'
  | 'ice_spikes'
  | 'shield_reflect'
  | 'dive_attack'
  | 'ice_barrage'
  | 'freezing_roar'
  | 'laser_beam'
  | 'spawn_turrets'
  | 'crystal_shatter'

/**
 * Boss base stats
 */
export interface BossBaseStats {
  /** Base health (before chapter/difficulty multipliers) */
  baseHealth: number
  /** Base contact damage */
  baseDamage: number
  /** Base movement speed */
  baseSpeed: number
  /** Attack cooldown in ms */
  attackCooldown: number
  /** XP reward */
  xpReward: number
  /** Gold reward range [min, max] */
  goldReward: [number, number]
}

/**
 * Boss visual configuration
 */
export interface BossVisuals {
  /** Sprite texture key (or 'generated' for placeholder) */
  textureKey: string
  /** Display size in pixels */
  displaySize: number
  /** Hitbox radius */
  hitboxRadius: number
  /** Tint color for placeholder (when no sprite exists) */
  placeholderColor: number
}

/**
 * Complete boss definition
 */
export interface BossDefinition {
  /** Unique boss ID */
  id: BossId
  /** Display name */
  name: string
  /** Short description */
  description: string
  /** Which chapter this boss appears in */
  chapter: ChapterId
  /** Whether this is a main boss (vs mini-boss or alternative) */
  isMainBoss: boolean
  /** Order within chapter (1 = first boss, 2 = second, etc.) */
  orderInChapter: number
  /** Base stats */
  stats: BossBaseStats
  /** Visual configuration */
  visuals: BossVisuals
  /** Attack pattern sequence */
  attackPatterns: AttackPatternType[]
}

// ============================================
// Boss Definitions
// ============================================

export const BOSS_DEFINITIONS: Record<BossId, BossDefinition> = {
  // ==========================================
  // Chapter 1 - Dark Dungeon
  // ==========================================
  demon: {
    id: 'demon',
    name: 'Demon Lord',
    description: 'Ancient demon awakened from its slumber.',
    chapter: 1,
    isMainBoss: true,
    orderInChapter: 1,
    stats: {
      baseHealth: 200,
      baseDamage: 15,
      baseSpeed: 40,
      attackCooldown: 2000,
      xpReward: 10,
      goldReward: [100, 200],
    },
    visuals: {
      textureKey: 'bossSprite',
      displaySize: 64,
      hitboxRadius: 25,
      placeholderColor: 0x990000,
    },
    attackPatterns: ['spread', 'barrage', 'charge'],
  },

  // ==========================================
  // Chapter 2 - Forest Ruins
  // ==========================================
  tree_guardian: {
    id: 'tree_guardian',
    name: 'Tree Guardian',
    description: 'Ancient plant spirit protecting the forest ruins.',
    chapter: 2,
    isMainBoss: true,
    orderInChapter: 1,
    stats: {
      baseHealth: 250,
      baseDamage: 12,
      baseSpeed: 30,
      attackCooldown: 2200,
      xpReward: 12,
      goldReward: [120, 220],
    },
    visuals: {
      textureKey: 'boss_tree_guardian',
      displaySize: 72,
      hitboxRadius: 30,
      placeholderColor: 0x228b22,
    },
    attackPatterns: ['vine_whip', 'root_trap', 'leaf_storm'],
  },

  wild_boar: {
    id: 'wild_boar',
    name: 'Wild Boar King',
    description: 'Massive boar that rules the forest beasts.',
    chapter: 2,
    isMainBoss: false,
    orderInChapter: 2,
    stats: {
      baseHealth: 220,
      baseDamage: 18,
      baseSpeed: 60,
      attackCooldown: 1800,
      xpReward: 11,
      goldReward: [110, 200],
    },
    visuals: {
      textureKey: 'boss_wild_boar',
      displaySize: 64,
      hitboxRadius: 26,
      placeholderColor: 0x8b4513,
    },
    attackPatterns: ['fast_charge', 'ground_stomp', 'summon_minions'],
  },

  forest_spirit: {
    id: 'forest_spirit',
    name: 'Forest Spirit',
    description: 'Ethereal being of pure nature magic.',
    chapter: 2,
    isMainBoss: false,
    orderInChapter: 3,
    stats: {
      baseHealth: 180,
      baseDamage: 14,
      baseSpeed: 0, // Teleports instead of moving
      attackCooldown: 2000,
      xpReward: 12,
      goldReward: [130, 230],
    },
    visuals: {
      textureKey: 'boss_forest_spirit',
      displaySize: 56,
      hitboxRadius: 22,
      placeholderColor: 0x98fb98,
    },
    attackPatterns: ['teleport', 'homing_orbs', 'mirror_images'],
  },

  // ==========================================
  // Chapter 3 - Frozen Caves
  // ==========================================
  ice_golem: {
    id: 'ice_golem',
    name: 'Ice Golem',
    description: 'Massive construct of living ice.',
    chapter: 3,
    isMainBoss: true,
    orderInChapter: 1,
    stats: {
      baseHealth: 350,
      baseDamage: 20,
      baseSpeed: 25,
      attackCooldown: 2500,
      xpReward: 15,
      goldReward: [150, 280],
    },
    visuals: {
      textureKey: 'boss_ice_golem',
      displaySize: 80,
      hitboxRadius: 35,
      placeholderColor: 0x87ceeb,
    },
    attackPatterns: ['ice_breath', 'ice_spikes', 'shield_reflect'],
  },

  frost_wyrm: {
    id: 'frost_wyrm',
    name: 'Frost Wyrm',
    description: 'Dragon-like creature of the frozen depths.',
    chapter: 3,
    isMainBoss: false,
    orderInChapter: 2,
    stats: {
      baseHealth: 280,
      baseDamage: 22,
      baseSpeed: 80,
      attackCooldown: 2200,
      xpReward: 14,
      goldReward: [140, 260],
    },
    visuals: {
      textureKey: 'boss_frost_wyrm',
      displaySize: 72,
      hitboxRadius: 28,
      placeholderColor: 0x4169e1,
    },
    attackPatterns: ['dive_attack', 'ice_barrage', 'freezing_roar'],
  },

  crystal_guardian: {
    id: 'crystal_guardian',
    name: 'Crystal Guardian',
    description: 'Ancient guardian made of magical crystals.',
    chapter: 3,
    isMainBoss: false,
    orderInChapter: 3,
    stats: {
      baseHealth: 300,
      baseDamage: 16,
      baseSpeed: 35,
      attackCooldown: 2400,
      xpReward: 15,
      goldReward: [160, 300],
    },
    visuals: {
      textureKey: 'boss_crystal_guardian',
      displaySize: 68,
      hitboxRadius: 28,
      placeholderColor: 0xe0ffff,
    },
    attackPatterns: ['laser_beam', 'spawn_turrets', 'crystal_shatter'],
  },

  // ==========================================
  // Chapter 4 - Volcanic Depths (Placeholder)
  // ==========================================
  magma_wyrm: {
    id: 'magma_wyrm',
    name: 'Magma Wyrm',
    description: 'Serpentine beast born from lava flows.',
    chapter: 4,
    isMainBoss: true,
    orderInChapter: 1,
    stats: {
      baseHealth: 400,
      baseDamage: 25,
      baseSpeed: 50,
      attackCooldown: 2000,
      xpReward: 18,
      goldReward: [200, 350],
    },
    visuals: {
      textureKey: 'boss_magma_wyrm',
      displaySize: 80,
      hitboxRadius: 32,
      placeholderColor: 0xff4500,
    },
    attackPatterns: ['spread', 'charge', 'barrage'],
  },

  inferno_demon: {
    id: 'inferno_demon',
    name: 'Inferno Demon',
    description: 'Demon lord born of pure volcanic fury.',
    chapter: 4,
    isMainBoss: false,
    orderInChapter: 2,
    stats: {
      baseHealth: 350,
      baseDamage: 28,
      baseSpeed: 45,
      attackCooldown: 1800,
      xpReward: 17,
      goldReward: [180, 320],
    },
    visuals: {
      textureKey: 'boss_inferno_demon',
      displaySize: 80,
      hitboxRadius: 32,
      placeholderColor: 0xff6600,
    },
    attackPatterns: ['spread', 'barrage', 'charge'],
  },

  lava_golem: {
    id: 'lava_golem',
    name: 'Lava Golem',
    description: 'Molten rock given terrible life.',
    chapter: 4,
    isMainBoss: false,
    orderInChapter: 3,
    stats: {
      baseHealth: 450,
      baseDamage: 22,
      baseSpeed: 25,
      attackCooldown: 2600,
      xpReward: 18,
      goldReward: [200, 380],
    },
    visuals: {
      textureKey: 'boss_lava_golem',
      displaySize: 84,
      hitboxRadius: 36,
      placeholderColor: 0xcc3300,
    },
    attackPatterns: ['spread', 'charge', 'barrage'],
  },

  // ==========================================
  // Chapter 5 - Shadow Realm (Placeholder)
  // ==========================================
  void_lord: {
    id: 'void_lord',
    name: 'Void Lord',
    description: 'Master of the shadow realm.',
    chapter: 5,
    isMainBoss: true,
    orderInChapter: 1,
    stats: {
      baseHealth: 500,
      baseDamage: 30,
      baseSpeed: 40,
      attackCooldown: 1800,
      xpReward: 25,
      goldReward: [300, 500],
    },
    visuals: {
      textureKey: 'boss_void_lord',
      displaySize: 88,
      hitboxRadius: 38,
      placeholderColor: 0x4b0082,
    },
    attackPatterns: ['spread', 'barrage', 'charge'],
  },

  final_boss: {
    id: 'final_boss',
    name: 'The Void Incarnate',
    description: 'Ultimate manifestation of shadow and chaos.',
    chapter: 5,
    isMainBoss: false,
    orderInChapter: 2,
    stats: {
      baseHealth: 600,
      baseDamage: 35,
      baseSpeed: 50,
      attackCooldown: 1500,
      xpReward: 30,
      goldReward: [400, 600],
    },
    visuals: {
      textureKey: 'boss_final_boss',
      displaySize: 96,
      hitboxRadius: 40,
      placeholderColor: 0x1a0033,
    },
    attackPatterns: ['spread', 'charge', 'barrage'],
  },

  nightmare: {
    id: 'nightmare',
    name: 'Nightmare',
    description: 'Living manifestation of fear itself.',
    chapter: 5,
    isMainBoss: false,
    orderInChapter: 3,
    stats: {
      baseHealth: 380,
      baseDamage: 32,
      baseSpeed: 55,
      attackCooldown: 2000,
      xpReward: 24,
      goldReward: [280, 480],
    },
    visuals: {
      textureKey: 'boss_nightmare',
      displaySize: 72,
      hitboxRadius: 28,
      placeholderColor: 0x2d0047,
    },
    attackPatterns: ['spread', 'barrage', 'charge'],
  },
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get boss definition by ID
 */
export function getBossDefinition(bossId: BossId): BossDefinition {
  return BOSS_DEFINITIONS[bossId]
}

/**
 * Get all bosses for a specific chapter
 */
export function getBossesForChapter(chapterId: ChapterId): BossDefinition[] {
  return Object.values(BOSS_DEFINITIONS)
    .filter((boss) => boss.chapter === chapterId)
    .sort((a, b) => a.orderInChapter - b.orderInChapter)
}

/**
 * Get main boss for a chapter
 */
export function getMainBossForChapter(chapterId: ChapterId): BossDefinition | undefined {
  return Object.values(BOSS_DEFINITIONS).find(
    (boss) => boss.chapter === chapterId && boss.isMainBoss
  )
}

/**
 * Get a random boss for a chapter (for variety)
 */
export function getRandomBossForChapter(chapterId: ChapterId): BossDefinition {
  const chapterBosses = getBossesForChapter(chapterId)
  if (chapterBosses.length === 0) {
    // Fallback to demon if no bosses defined for chapter
    return BOSS_DEFINITIONS.demon
  }
  const randomIndex = Math.floor(Math.random() * chapterBosses.length)
  return chapterBosses[randomIndex]
}

/**
 * Get all boss IDs
 */
export function getAllBossIds(): BossId[] {
  return Object.keys(BOSS_DEFINITIONS) as BossId[]
}

/**
 * Check if a boss ID is valid
 */
export function isValidBossId(id: string): id is BossId {
  return id in BOSS_DEFINITIONS
}
