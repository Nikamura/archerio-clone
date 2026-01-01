/**
 * Talent Data Configuration
 *
 * Defines all talents available in the game's talent lottery system.
 * Talents provide permanent stat bonuses that persist across runs.
 */

// ============================================
// Type Definitions
// ============================================

/**
 * Talent tier determines rarity and drop rate
 */
export enum TalentTier {
  COMMON = 'common', // 50% drop rate
  RARE = 'rare', // 35% drop rate
  EPIC = 'epic', // 15% drop rate
}

/**
 * Unique identifiers for all talents
 */
export enum TalentId {
  // Common talents (50% drop rate)
  HP_BOOST = 'hp_boost',
  ATTACK_BOOST = 'attack_boost',
  DEFENSE = 'defense',

  // Rare talents (35% drop rate)
  ATTACK_SPEED = 'attack_speed',
  HEAL_ON_LEVEL_UP = 'heal_on_level_up',
  CRITICAL_MASTER = 'critical_master',

  // Epic talents (15% drop rate)
  EQUIPMENT_BONUS = 'equipment_bonus',
  GLORY = 'glory',
  IRON_WILL = 'iron_will',
}

/**
 * Talent effect types for applying bonuses
 */
export type TalentEffectType =
  | 'flat_hp' // +X HP
  | 'flat_attack' // +X Attack
  | 'percent_damage_reduction' // X% damage reduction
  | 'percent_attack_speed' // X% attack speed
  | 'flat_heal_on_level' // +X HP when leveling
  | 'percent_crit_chance' // X% crit chance
  | 'percent_equipment_stats' // X% equipment stats
  | 'starting_abilities' // Start with X abilities
  | 'percent_hp_when_low' // X% HP when below threshold

/**
 * Talent definition structure
 */
export interface Talent {
  id: TalentId
  name: string
  description: string
  tier: TalentTier
  maxLevel: number
  effectType: TalentEffectType
  effectPerLevel: number
  /** For threshold-based effects like Iron Will */
  threshold?: number
  /** Icon key for UI display */
  icon?: string
}

/**
 * Calculated bonus stats from all unlocked talents
 */
export interface TalentBonuses {
  flatHp: number
  flatAttack: number
  percentDamageReduction: number
  percentAttackSpeed: number
  flatHealOnLevel: number
  percentCritChance: number
  percentEquipmentStats: number
  startingAbilities: number
  percentHpWhenLow: number
  lowHpThreshold: number
}

// ============================================
// Talent Definitions
// ============================================

/**
 * All talent definitions
 */
export const TALENTS: Record<TalentId, Talent> = {
  // ----------------------------------------
  // Common Talents (50% drop rate)
  // ----------------------------------------
  [TalentId.HP_BOOST]: {
    id: TalentId.HP_BOOST,
    name: 'HP Boost',
    description: '+100 max HP per level',
    tier: TalentTier.COMMON,
    maxLevel: 10,
    effectType: 'flat_hp',
    effectPerLevel: 100,
  },
  [TalentId.ATTACK_BOOST]: {
    id: TalentId.ATTACK_BOOST,
    name: 'Attack Boost',
    description: '+25 attack per level',
    tier: TalentTier.COMMON,
    maxLevel: 10,
    effectType: 'flat_attack',
    effectPerLevel: 25,
  },
  [TalentId.DEFENSE]: {
    id: TalentId.DEFENSE,
    name: 'Defense',
    description: '+5% damage reduction per level',
    tier: TalentTier.COMMON,
    maxLevel: 5,
    effectType: 'percent_damage_reduction',
    effectPerLevel: 5,
  },

  // ----------------------------------------
  // Rare Talents (35% drop rate)
  // ----------------------------------------
  [TalentId.ATTACK_SPEED]: {
    id: TalentId.ATTACK_SPEED,
    name: 'Attack Speed',
    description: '+1% attack speed per level',
    tier: TalentTier.RARE,
    maxLevel: 10,
    effectType: 'percent_attack_speed',
    effectPerLevel: 1,
  },
  [TalentId.HEAL_ON_LEVEL_UP]: {
    id: TalentId.HEAL_ON_LEVEL_UP,
    name: 'Heal on Level-Up',
    description: '+50 HP when leveling during run per level',
    tier: TalentTier.RARE,
    maxLevel: 5,
    effectType: 'flat_heal_on_level',
    effectPerLevel: 50,
  },
  [TalentId.CRITICAL_MASTER]: {
    id: TalentId.CRITICAL_MASTER,
    name: 'Critical Master',
    description: '+2% crit chance per level',
    tier: TalentTier.RARE,
    maxLevel: 5,
    effectType: 'percent_crit_chance',
    effectPerLevel: 2,
  },

  // ----------------------------------------
  // Epic Talents (15% drop rate)
  // ----------------------------------------
  [TalentId.EQUIPMENT_BONUS]: {
    id: TalentId.EQUIPMENT_BONUS,
    name: 'Equipment Bonus',
    description: '+3% equipment stats per level',
    tier: TalentTier.EPIC,
    maxLevel: 5,
    effectType: 'percent_equipment_stats',
    effectPerLevel: 3,
  },
  [TalentId.GLORY]: {
    id: TalentId.GLORY,
    name: 'Glory',
    description: 'Start runs with 1 random ability per level',
    tier: TalentTier.EPIC,
    maxLevel: 3,
    effectType: 'starting_abilities',
    effectPerLevel: 1,
  },
  [TalentId.IRON_WILL]: {
    id: TalentId.IRON_WILL,
    name: 'Iron Will',
    description: '+30% HP when below 30% HP per level',
    tier: TalentTier.EPIC,
    maxLevel: 3,
    effectType: 'percent_hp_when_low',
    effectPerLevel: 30,
    threshold: 30, // Activates when below 30% HP
  },
}

// ============================================
// Tier Configuration
// ============================================

/**
 * Drop rates for each tier (must sum to 100)
 */
export const TIER_DROP_RATES: Record<TalentTier, number> = {
  [TalentTier.COMMON]: 50,
  [TalentTier.RARE]: 35,
  [TalentTier.EPIC]: 15,
}

/**
 * Get all talents by tier
 */
export function getTalentsByTier(tier: TalentTier): Talent[] {
  return Object.values(TALENTS).filter((talent) => talent.tier === tier)
}

/**
 * Get a talent by ID
 */
export function getTalent(id: TalentId): Talent {
  return TALENTS[id]
}

/**
 * Get all talent IDs
 */
export function getAllTalentIds(): TalentId[] {
  return Object.values(TalentId)
}

/**
 * Create default empty bonuses object
 */
export function createDefaultBonuses(): TalentBonuses {
  return {
    flatHp: 0,
    flatAttack: 0,
    percentDamageReduction: 0,
    percentAttackSpeed: 0,
    flatHealOnLevel: 0,
    percentCritChance: 0,
    percentEquipmentStats: 0,
    startingAbilities: 0,
    percentHpWhenLow: 0,
    lowHpThreshold: 30, // Default threshold
  }
}

/**
 * Display colors for each tier
 */
export const TIER_COLORS: Record<TalentTier, string> = {
  [TalentTier.COMMON]: '#808080', // Gray
  [TalentTier.RARE]: '#4169E1', // Royal Blue
  [TalentTier.EPIC]: '#9932CC', // Purple
}

/**
 * Display names for each tier
 */
export const TIER_NAMES: Record<TalentTier, string> = {
  [TalentTier.COMMON]: 'Common',
  [TalentTier.RARE]: 'Rare',
  [TalentTier.EPIC]: 'Epic',
}
