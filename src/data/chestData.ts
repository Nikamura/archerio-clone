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
 * Calculate chest rewards based on run performance
 *
 * @param roomsCleared - Number of rooms cleared (0-10)
 * @param enemiesKilled - Total enemies killed
 * @param bossDefeated - Whether the boss was defeated
 * @param isVictory - Whether the run was completed successfully
 * @returns Chest rewards earned
 */
export function calculateChestRewards(
  roomsCleared: number,
  enemiesKilled: number,
  bossDefeated: boolean,
  isVictory: boolean
): ChestRewards {
  const rewards: ChestRewards = {
    wooden: 1, // Base: 1 wooden chest per run
    silver: 0,
    golden: 0,
  }

  let totalChests = 1

  // Bonus for clearing 5+ rooms
  if (roomsCleared >= CHEST_THRESHOLDS.ROOMS_FOR_BONUS_WOODEN && totalChests < CHEST_THRESHOLDS.MAX_CHESTS_PER_RUN) {
    rewards.wooden++
    totalChests++
  }

  // Bonus for killing 30+ enemies
  if (enemiesKilled >= CHEST_THRESHOLDS.KILLS_FOR_BONUS_WOODEN && totalChests < CHEST_THRESHOLDS.MAX_CHESTS_PER_RUN) {
    rewards.wooden++
    totalChests++
  }

  // Victory bonus (completing all rooms)
  if (isVictory && totalChests < CHEST_THRESHOLDS.MAX_CHESTS_PER_RUN) {
    rewards.silver++
    totalChests++

    // Small chance for golden chest on victory
    if (Math.random() * 100 < CHEST_THRESHOLDS.GOLDEN_CHEST_CHANCE) {
      rewards.golden++
      totalChests++
    }
  }

  // Boss defeat bonus
  if (bossDefeated && totalChests < CHEST_THRESHOLDS.MAX_CHESTS_PER_RUN) {
    rewards.silver++
    totalChests++
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
