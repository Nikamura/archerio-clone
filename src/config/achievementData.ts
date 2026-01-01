/**
 * Achievement Data Configuration
 *
 * Defines all achievements with tiers and rewards.
 * Achievements are tracked based on player statistics from SaveManager.
 */

// ============================================
// Types and Interfaces
// ============================================

/** Reward structure for achievement tiers */
export interface AchievementReward {
  gold?: number
  gems?: number
}

/** Single tier within an achievement */
export interface AchievementTier {
  requirement: number
  reward: AchievementReward
}

/** Complete achievement definition */
export interface Achievement {
  id: string
  name: string
  description: string
  tiers: AchievementTier[]
  statKey: string // Key in PlayerStatistics to track
}

/** Achievement IDs as enum for type safety */
export enum AchievementId {
  FIRST_BLOOD = 'first_blood',
  SURVIVOR = 'survivor',
  BOSS_SLAYER = 'boss_slayer',
  DEDICATED = 'dedicated',
  HERO_COLLECTOR = 'hero_collector',
  GEAR_UP = 'gear_up',
  TALENT_SCOUT = 'talent_scout',
}

/** Tier names for display */
export const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum'] as const
export type TierName = (typeof TIER_NAMES)[number]

/** Tier colors for UI display */
export const TIER_COLORS: Record<TierName, string> = {
  Bronze: '#CD7F32',
  Silver: '#C0C0C0',
  Gold: '#FFD700',
  Platinum: '#E5E4E2',
}

// ============================================
// Achievement Definitions
// ============================================

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: AchievementId.FIRST_BLOOD,
    name: 'First Blood',
    description: 'Defeat enemies in battle',
    tiers: [
      { requirement: 1, reward: { gold: 10 } },
      { requirement: 10, reward: { gold: 50 } },
      { requirement: 100, reward: { gold: 200 } },
      { requirement: 1000, reward: { gold: 500 } },
    ],
    statKey: 'totalKills',
  },
  {
    id: AchievementId.SURVIVOR,
    name: 'Survivor',
    description: 'Complete dungeon runs',
    tiers: [
      { requirement: 1, reward: { gems: 5 } },
      { requirement: 5, reward: { gems: 20 } },
      { requirement: 25, reward: { gems: 50 } },
      { requirement: 100, reward: { gems: 100 } },
    ],
    statKey: 'totalRuns',
  },
  {
    id: AchievementId.BOSS_SLAYER,
    name: 'Boss Slayer',
    description: 'Defeat powerful bosses',
    tiers: [
      { requirement: 1, reward: { gold: 20 } },
      { requirement: 5, reward: { gold: 100 } },
      { requirement: 25, reward: { gold: 500 } },
      { requirement: 50, reward: { gold: 1000 } },
    ],
    statKey: 'bossesDefeated',
  },
  {
    id: AchievementId.DEDICATED,
    name: 'Dedicated',
    description: 'Play the game (minutes)',
    tiers: [
      { requirement: 10, reward: { gems: 10 } },
      { requirement: 50, reward: { gems: 50 } },
      { requirement: 100, reward: { gems: 100 } },
      { requirement: 500, reward: { gems: 200 } },
    ],
    statKey: 'totalPlayTimeMinutes', // Computed from totalPlayTimeMs
  },
  {
    id: AchievementId.HERO_COLLECTOR,
    name: 'Hero Collector',
    description: 'Unlock heroes',
    tiers: [
      { requirement: 1, reward: { gems: 50 } },
      { requirement: 2, reward: { gems: 100 } },
      { requirement: 3, reward: { gems: 200 } },
    ],
    statKey: 'unlockedHeroes', // Computed from heroes data
  },
  {
    id: AchievementId.GEAR_UP,
    name: 'Gear Up',
    description: 'Equip items in slots',
    tiers: [
      { requirement: 1, reward: { gold: 50 } },
      { requirement: 2, reward: { gold: 100 } },
      { requirement: 3, reward: { gold: 200 } },
      { requirement: 4, reward: { gold: 500 } },
    ],
    statKey: 'equippedSlots', // Computed from equipped data
  },
  {
    id: AchievementId.TALENT_SCOUT,
    name: 'Talent Scout',
    description: 'Unlock talents',
    tiers: [
      { requirement: 3, reward: { gems: 20 } },
      { requirement: 6, reward: { gems: 50 } },
      { requirement: 9, reward: { gems: 100 } },
    ],
    statKey: 'unlockedTalents', // Computed from talents data
  },
]

// ============================================
// Helper Functions
// ============================================

/**
 * Get achievement by ID
 */
export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id)
}

/**
 * Get tier name for a given tier index
 */
export function getTierName(tierIndex: number): TierName {
  return TIER_NAMES[Math.min(tierIndex, TIER_NAMES.length - 1)]
}

/**
 * Get tier color for a given tier index
 */
export function getTierColor(tierIndex: number): string {
  const tierName = getTierName(tierIndex)
  return TIER_COLORS[tierName]
}

/**
 * Calculate total rewards from achievement tiers
 */
export function calculateTotalRewards(
  achievement: Achievement,
  claimedTiers: number
): AchievementReward {
  let totalGold = 0
  let totalGems = 0

  for (let i = 0; i < claimedTiers && i < achievement.tiers.length; i++) {
    const tier = achievement.tiers[i]
    totalGold += tier.reward.gold ?? 0
    totalGems += tier.reward.gems ?? 0
  }

  return { gold: totalGold, gems: totalGems }
}
