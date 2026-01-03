/**
 * Chest Data - Defines chest types, drop rates, and reward tables
 *
 * Chest rewards are based on performance during a run.
 * Each chest type has different rarity drop rates for equipment.
 */

import { Rarity } from '../systems/Equipment'

// ============================================
// Chest Type Definitions
// ============================================

/**
 * Available chest types
 */
export type ChestType = 'wooden' | 'silver' | 'golden'

/**
 * Chest configuration including display info and drop rates
 */
export interface ChestConfig {
  name: string
  description: string
  color: string // Display color
  icon: string // Unicode icon for display
  dropRates: Record<Rarity, number> // Must sum to 100
}

/**
 * Configuration for each chest type
 */
export const CHEST_CONFIGS: Record<ChestType, ChestConfig> = {
  wooden: {
    name: 'Wooden Chest',
    description: 'A simple wooden chest with basic rewards',
    color: '#8B4513', // SaddleBrown
    icon: 'chest_wooden',
    dropRates: {
      [Rarity.COMMON]: 70,
      [Rarity.GREAT]: 25,
      [Rarity.RARE]: 5,
      [Rarity.EPIC]: 0,
      [Rarity.LEGENDARY]: 0,
    },
  },
  silver: {
    name: 'Silver Chest',
    description: 'A reinforced chest with better rewards',
    color: '#C0C0C0', // Silver
    icon: 'chest_silver',
    dropRates: {
      [Rarity.COMMON]: 40,
      [Rarity.GREAT]: 40,
      [Rarity.RARE]: 15,
      [Rarity.EPIC]: 5,
      [Rarity.LEGENDARY]: 0,
    },
  },
  golden: {
    name: 'Golden Chest',
    description: 'A legendary chest with premium rewards',
    color: '#FFD700', // Gold
    icon: 'chest_golden',
    dropRates: {
      [Rarity.COMMON]: 0,
      [Rarity.GREAT]: 20,
      [Rarity.RARE]: 50,
      [Rarity.EPIC]: 25,
      [Rarity.LEGENDARY]: 5,
    },
  },
}

// ============================================
// Chest Order (for display purposes)
// ============================================

/**
 * Chest types ordered from least to most valuable
 */
export const CHEST_ORDER: ChestType[] = ['wooden', 'silver', 'golden']

// ============================================
// Reward Calculation
// ============================================

/**
 * Calculated chest rewards based on run performance
 */
export interface ChestRewards {
  wooden: number
  silver: number
  golden: number
}

/**
 * Performance thresholds for earning bonus chests
 */
export const CHEST_THRESHOLDS = {
  // Rooms cleared thresholds
  ROOMS_FOR_BONUS_WOODEN: 5, // Clear 5+ rooms = +1 wooden
  ROOMS_FOR_VICTORY: 10, // Clear all 10 rooms (victory) = +1 silver

  // Enemy kill thresholds
  KILLS_FOR_BONUS_WOODEN: 30, // Kill 30+ enemies = +1 wooden

  // Boss thresholds
  BOSS_SILVER: true, // Kill boss = +1 silver

  // Golden chest chance (percentage, 0-100)
  GOLDEN_CHEST_CHANCE: 10, // 10% chance on victory

  // Maximum total chests per run
  MAX_CHESTS_PER_RUN: 4,
}

/**
 * Chapter-based chest reward scaling
 * Higher chapters = better chest rewards
 */
export const CHAPTER_CHEST_SCALING: Record<number, {
  /** Base wooden chest count */
  baseWooden: number
  /** Bonus silver chest chance (0-100) */
  bonusSilverChance: number
  /** Golden chest chance multiplier (1.0 = normal) */
  goldenChanceMultiplier: number
  /** Upgrade wooden to silver chance (0-100) */
  upgradeToSilverChance: number
}> = {
  1: {
    baseWooden: 1,
    bonusSilverChance: 0,
    goldenChanceMultiplier: 1.0,
    upgradeToSilverChance: 0,
  },
  2: {
    baseWooden: 1,
    bonusSilverChance: 10,
    goldenChanceMultiplier: 1.2,
    upgradeToSilverChance: 10,
  },
  3: {
    baseWooden: 1,
    bonusSilverChance: 20,
    goldenChanceMultiplier: 1.5,
    upgradeToSilverChance: 20,
  },
  4: {
    baseWooden: 2,
    bonusSilverChance: 30,
    goldenChanceMultiplier: 2.0,
    upgradeToSilverChance: 30,
  },
  5: {
    baseWooden: 2,
    bonusSilverChance: 50,
    goldenChanceMultiplier: 3.0,
    upgradeToSilverChance: 50,
  },
}

/**
 * Difficulty-based chest reward scaling
 * Harder difficulties = better rewards
 */
export const DIFFICULTY_CHEST_SCALING: Record<string, {
  /** Extra wooden chests */
  extraWooden: number
  /** Golden chance multiplier (stacks with chapter) */
  goldenChanceMultiplier: number
  /** Chance to upgrade silver to golden (0-100) */
  upgradeToGoldenChance: number
}> = {
  easy: {
    extraWooden: 0,
    goldenChanceMultiplier: 0.5, // Half golden chance on easy
    upgradeToGoldenChance: 0,
  },
  normal: {
    extraWooden: 0,
    goldenChanceMultiplier: 1.0,
    upgradeToGoldenChance: 0,
  },
  hard: {
    extraWooden: 1,
    goldenChanceMultiplier: 1.5,
    upgradeToGoldenChance: 10,
  },
  insanity: {
    extraWooden: 2,
    goldenChanceMultiplier: 2.5,
    upgradeToGoldenChance: 25,
  },
}

/**
 * Calculate chest rewards based on run performance
 *
 * @param roomsCleared - Number of rooms cleared (0-10)
 * @param enemiesKilled - Total enemies killed
 * @param bossDefeated - Whether the boss was defeated
 * @param isVictory - Whether the run was completed successfully
 * @param chapterId - Chapter being played (1-5), defaults to 1
 * @param difficulty - Difficulty level ('easy', 'normal', 'hard', 'insanity'), defaults to 'normal'
 * @returns Chest rewards earned
 */
export function calculateChestRewards(
  roomsCleared: number,
  enemiesKilled: number,
  bossDefeated: boolean,
  isVictory: boolean,
  chapterId: number = 1,
  difficulty: string = 'normal'
): ChestRewards {
  // Get scaling values for chapter and difficulty
  const chapterScaling = CHAPTER_CHEST_SCALING[chapterId] || CHAPTER_CHEST_SCALING[1]
  const difficultyScaling = DIFFICULTY_CHEST_SCALING[difficulty] || DIFFICULTY_CHEST_SCALING['normal']

  const rewards: ChestRewards = {
    wooden: chapterScaling.baseWooden + difficultyScaling.extraWooden,
    silver: 0,
    golden: 0,
  }

  // Calculate max chests based on chapter (higher chapters can earn more)
  const maxChests = CHEST_THRESHOLDS.MAX_CHESTS_PER_RUN + Math.floor((chapterId - 1) / 2)
  let totalChests = rewards.wooden

  // Bonus for clearing 5+ rooms
  if (roomsCleared >= CHEST_THRESHOLDS.ROOMS_FOR_BONUS_WOODEN && totalChests < maxChests) {
    rewards.wooden++
    totalChests++
  }

  // Bonus for killing 30+ enemies
  if (enemiesKilled >= CHEST_THRESHOLDS.KILLS_FOR_BONUS_WOODEN && totalChests < maxChests) {
    rewards.wooden++
    totalChests++
  }

  // Victory bonus (completing all rooms)
  if (isVictory && totalChests < maxChests) {
    rewards.silver++
    totalChests++

    // Golden chest chance scaled by chapter and difficulty
    const goldenChance = CHEST_THRESHOLDS.GOLDEN_CHEST_CHANCE *
      chapterScaling.goldenChanceMultiplier *
      difficultyScaling.goldenChanceMultiplier

    if (Math.random() * 100 < goldenChance && totalChests < maxChests) {
      rewards.golden++
      totalChests++
    }
  }

  // Boss defeat bonus
  if (bossDefeated && totalChests < maxChests) {
    rewards.silver++
    totalChests++
  }

  // Chapter-based bonus silver chance
  if (chapterScaling.bonusSilverChance > 0 && Math.random() * 100 < chapterScaling.bonusSilverChance) {
    if (totalChests < maxChests) {
      rewards.silver++
      totalChests++
    }
  }

  // Upgrade wooden to silver based on chapter scaling
  if (rewards.wooden > 0 && chapterScaling.upgradeToSilverChance > 0) {
    const upgrades = Math.min(
      rewards.wooden,
      Math.floor(rewards.wooden * chapterScaling.upgradeToSilverChance / 100) +
        (Math.random() * 100 < (chapterScaling.upgradeToSilverChance % 100) ? 1 : 0)
    )
    if (upgrades > 0) {
      rewards.wooden -= upgrades
      rewards.silver += upgrades
    }
  }

  // Upgrade silver to golden based on difficulty scaling (for insanity/hard)
  if (rewards.silver > 0 && difficultyScaling.upgradeToGoldenChance > 0) {
    for (let i = 0; i < rewards.silver; i++) {
      if (Math.random() * 100 < difficultyScaling.upgradeToGoldenChance) {
        rewards.silver--
        rewards.golden++
      }
    }
  }

  return rewards
}

/**
 * Get total number of chests in a reward
 */
export function getTotalChests(rewards: ChestRewards): number {
  return rewards.wooden + rewards.silver + rewards.golden
}

// ============================================
// Rarity Selection
// ============================================

/**
 * Roll for a random rarity based on chest drop rates
 *
 * @param chestType - Type of chest being opened
 * @returns The rolled rarity
 */
export function rollChestRarity(chestType: ChestType): Rarity {
  const config = CHEST_CONFIGS[chestType]
  const roll = Math.random() * 100

  let cumulative = 0
  for (const rarity of [Rarity.LEGENDARY, Rarity.EPIC, Rarity.RARE, Rarity.GREAT, Rarity.COMMON]) {
    cumulative += config.dropRates[rarity]
    if (roll < cumulative) {
      return rarity
    }
  }

  // Fallback to common (should never reach here)
  return Rarity.COMMON
}
