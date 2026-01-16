/**
 * Chest Data - Defines chest types, drop rates, and reward tables
 *
 * Chest rewards are based on performance during a run.
 * Each chest type has different rarity drop rates for equipment.
 */

import { Rarity } from "../systems/Equipment";

// ============================================
// Chest Type Definitions
// ============================================

/**
 * Available chest types
 */
export type ChestType = "wooden" | "silver" | "golden";

/**
 * Chest configuration including display info and drop rates
 */
export interface ChestConfig {
  name: string;
  description: string;
  color: string; // Display color
  icon: string; // Unicode icon for display
  dropRates: Record<Rarity, number>; // Must sum to 100
}

/**
 * Configuration for each chest type
 */
export const CHEST_CONFIGS: Record<ChestType, ChestConfig> = {
  wooden: {
    name: "Wooden Chest",
    description: "A simple wooden chest with basic rewards",
    color: "#8B4513", // SaddleBrown
    icon: "chest_wooden",
    dropRates: {
      [Rarity.COMMON]: 70,
      [Rarity.GREAT]: 25,
      [Rarity.RARE]: 5,
      [Rarity.EPIC]: 0,
      [Rarity.LEGENDARY]: 0,
    },
  },
  silver: {
    name: "Silver Chest",
    description: "A reinforced chest with better rewards",
    color: "#C0C0C0", // Silver
    icon: "chest_silver",
    dropRates: {
      [Rarity.COMMON]: 40,
      [Rarity.GREAT]: 40,
      [Rarity.RARE]: 15,
      [Rarity.EPIC]: 5,
      [Rarity.LEGENDARY]: 0,
    },
  },
  golden: {
    name: "Golden Chest",
    description: "A legendary chest with premium rewards",
    color: "#FFD700", // Gold
    icon: "chest_golden",
    dropRates: {
      [Rarity.COMMON]: 0,
      [Rarity.GREAT]: 20,
      [Rarity.RARE]: 50,
      [Rarity.EPIC]: 25,
      [Rarity.LEGENDARY]: 5,
    },
  },
};

// ============================================
// Chest Order (for display purposes)
// ============================================

/**
 * Chest types ordered from least to most valuable
 */
export const CHEST_ORDER: ChestType[] = ["wooden", "silver", "golden"];

// ============================================
// Reward Calculation
// ============================================

/**
 * Calculated chest rewards based on run performance
 */
export interface ChestRewards {
  wooden: number;
  silver: number;
  golden: number;
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
};

/**
 * Chapter-based chest reward scaling
 * Higher chapters = better chest rewards
 */
export const CHAPTER_CHEST_SCALING: Record<
  number,
  {
    /** Base wooden chest count */
    baseWooden: number;
    /** Bonus silver chest chance (0-100) */
    bonusSilverChance: number;
    /** Golden chest chance multiplier (1.0 = normal) */
    goldenChanceMultiplier: number;
    /** Upgrade wooden to silver chance (0-100) */
    upgradeToSilverChance: number;
  }
> = {
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
};

/**
 * Difficulty-based chest reward scaling
 * Harder difficulties = better rewards
 */
export const DIFFICULTY_CHEST_SCALING: Record<
  string,
  {
    /** Extra wooden chests */
    extraWooden: number;
    /** Golden chance multiplier (stacks with chapter) */
    goldenChanceMultiplier: number;
    /** Chance to upgrade silver to golden (0-100) */
    upgradeToGoldenChance: number;
  }
> = {
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
};

/**
 * Calculate endless wave scaling for chest rewards
 * Rewards scale with wave number to compensate for increased difficulty.
 * Each wave completion grants bonus rewards.
 *
 * @param endlessWave - Current endless wave (1+)
 * @returns Scaling values for chest rewards
 */
export function getEndlessWaveScaling(endlessWave: number): {
  /** Extra wooden chests (stacks with base) */
  extraWooden: number;
  /** Extra silver chests */
  extraSilver: number;
  /** Golden chance multiplier */
  goldenChanceMultiplier: number;
  /** Chance to upgrade wooden to silver (0-100) */
  upgradeToSilverChance: number;
  /** Chance to upgrade silver to golden (0-100) */
  upgradeToGoldenChance: number;
  /** Extra max chests allowed */
  extraMaxChests: number;
} {
  // Wave 1 has no bonus
  if (endlessWave <= 1) {
    return {
      extraWooden: 0,
      extraSilver: 0,
      goldenChanceMultiplier: 1.0,
      upgradeToSilverChance: 0,
      upgradeToGoldenChance: 0,
      extraMaxChests: 0,
    };
  }

  // Waves completed (not counting current wave 1)
  const wavesCompleted = endlessWave - 1;

  // +1-2 wooden per wave (1 base + 1 extra every other wave)
  const extraWooden = wavesCompleted + Math.floor(wavesCompleted / 2);

  // +1 silver per wave completed
  const extraSilver = wavesCompleted;

  // 10% golden chance per wave, +30% bonus every 5 waves
  // Wave 2: 10%, Wave 3: 20%, Wave 5: 40%+30%=70%, Wave 6: 50%+30%=80%
  const bonusFromMilestones = Math.floor(endlessWave / 5) * 30;
  const baseGoldenChance = wavesCompleted * 10;
  // Convert to multiplier (base chance is 10%, so 10% extra = 2.0x multiplier)
  const goldenChanceMultiplier = 1 + (baseGoldenChance + bonusFromMilestones) / 10;

  return {
    extraWooden,
    extraSilver,
    goldenChanceMultiplier,
    // 10% upgrade chance per wave (capped at 60%)
    upgradeToSilverChance: Math.min(60, wavesCompleted * 10),
    // 5% silver->golden upgrade per wave (capped at 40%)
    upgradeToGoldenChance: Math.min(40, wavesCompleted * 5),
    // +1 max chest per wave to accommodate extra rewards
    extraMaxChests: wavesCompleted,
  };
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
 * @param endlessWave - Endless mode wave number (1+), defaults to 1
 * @param isEndlessMode - Whether this is an endless mode run, defaults to false
 * @returns Chest rewards earned
 */
export function calculateChestRewards(
  roomsCleared: number,
  enemiesKilled: number,
  bossDefeated: boolean,
  isVictory: boolean,
  chapterId: number = 1,
  difficulty: string = "normal",
  endlessWave: number = 1,
  isEndlessMode: boolean = false,
): ChestRewards {
  // Get scaling values for chapter and difficulty
  const chapterScaling = CHAPTER_CHEST_SCALING[chapterId] || CHAPTER_CHEST_SCALING[1];
  const difficultyScaling =
    DIFFICULTY_CHEST_SCALING[difficulty] || DIFFICULTY_CHEST_SCALING["normal"];
  const endlessScaling = isEndlessMode ? getEndlessWaveScaling(endlessWave) : null;

  const rewards: ChestRewards = {
    wooden:
      chapterScaling.baseWooden +
      difficultyScaling.extraWooden +
      (endlessScaling?.extraWooden ?? 0),
    silver: endlessScaling?.extraSilver ?? 0,
    golden: 0,
  };

  // Calculate max chests based on chapter (higher chapters can earn more) + endless bonus
  const maxChests =
    CHEST_THRESHOLDS.MAX_CHESTS_PER_RUN +
    Math.floor((chapterId - 1) / 2) +
    (endlessScaling?.extraMaxChests ?? 0);
  let totalChests = rewards.wooden + rewards.silver;

  // Bonus for clearing 5+ rooms
  if (roomsCleared >= CHEST_THRESHOLDS.ROOMS_FOR_BONUS_WOODEN && totalChests < maxChests) {
    rewards.wooden++;
    totalChests++;
  }

  // Bonus for killing 30+ enemies
  if (enemiesKilled >= CHEST_THRESHOLDS.KILLS_FOR_BONUS_WOODEN && totalChests < maxChests) {
    rewards.wooden++;
    totalChests++;
  }

  // Victory bonus (completing all rooms)
  if (isVictory && totalChests < maxChests) {
    rewards.silver++;
    totalChests++;

    // Golden chest chance scaled by chapter, difficulty, and endless wave
    const goldenChance =
      CHEST_THRESHOLDS.GOLDEN_CHEST_CHANCE *
      chapterScaling.goldenChanceMultiplier *
      difficultyScaling.goldenChanceMultiplier *
      (endlessScaling?.goldenChanceMultiplier ?? 1);

    if (Math.random() * 100 < goldenChance && totalChests < maxChests) {
      rewards.golden++;
      totalChests++;
    }
  }

  // Boss defeat bonus
  if (bossDefeated && totalChests < maxChests) {
    rewards.silver++;
    totalChests++;
  }

  // Chapter-based bonus silver chance
  if (
    chapterScaling.bonusSilverChance > 0 &&
    Math.random() * 100 < chapterScaling.bonusSilverChance
  ) {
    if (totalChests < maxChests) {
      rewards.silver++;
      totalChests++;
    }
  }

  // Upgrade wooden to silver based on chapter scaling + endless scaling
  const totalUpgradeToSilverChance =
    chapterScaling.upgradeToSilverChance + (endlessScaling?.upgradeToSilverChance ?? 0);
  if (rewards.wooden > 0 && totalUpgradeToSilverChance > 0) {
    const upgrades = Math.min(
      rewards.wooden,
      Math.floor((rewards.wooden * totalUpgradeToSilverChance) / 100) +
        (Math.random() * 100 < totalUpgradeToSilverChance % 100 ? 1 : 0),
    );
    if (upgrades > 0) {
      rewards.wooden -= upgrades;
      rewards.silver += upgrades;
    }
  }

  // Upgrade silver to golden based on difficulty scaling + endless scaling
  const totalUpgradeToGoldenChance =
    difficultyScaling.upgradeToGoldenChance + (endlessScaling?.upgradeToGoldenChance ?? 0);
  if (rewards.silver > 0 && totalUpgradeToGoldenChance > 0) {
    for (let i = 0; i < rewards.silver; i++) {
      if (Math.random() * 100 < totalUpgradeToGoldenChance) {
        rewards.silver--;
        rewards.golden++;
      }
    }
  }

  return rewards;
}

/**
 * Get total number of chests in a reward
 */
export function getTotalChests(rewards: ChestRewards): number {
  return rewards.wooden + rewards.silver + rewards.golden;
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
  const config = CHEST_CONFIGS[chestType];
  const roll = Math.random() * 100;

  let cumulative = 0;
  for (const rarity of [Rarity.LEGENDARY, Rarity.EPIC, Rarity.RARE, Rarity.GREAT, Rarity.COMMON]) {
    cumulative += config.dropRates[rarity];
    if (roll < cumulative) {
      return rarity;
    }
  }

  // Fallback to common (should never reach here)
  return Rarity.COMMON;
}

// ============================================
// Currency Rewards from Chests
// ============================================

interface CurrencyDropConfig {
  chance: number; // 0-1 (e.g., 0.6 = 60%)
  min: number;
  max: number;
}

/**
 * Currency reward configuration for each chest type
 */
export const CHEST_CURRENCY_REWARDS: Record<
  ChestType,
  {
    gold: CurrencyDropConfig;
    gems: CurrencyDropConfig;
  }
> = {
  wooden: {
    gold: { chance: 0.6, min: 20, max: 50 },
    gems: { chance: 0, min: 0, max: 0 }, // No gems from wooden
  },
  silver: {
    gold: { chance: 0.75, min: 50, max: 100 },
    gems: { chance: 0.001, min: 1, max: 2 }, // 0.1% chance
  },
  golden: {
    gold: { chance: 0.9, min: 100, max: 200 },
    gems: { chance: 0.01, min: 1, max: 2 }, // 1% chance
  },
};

/**
 * Currency rewards result
 */
export interface ChestCurrencyRewards {
  gold: number;
  gems: number;
}

/**
 * Roll for currency rewards when opening a chest
 *
 * @param chestType - Type of chest being opened
 * @returns Gold and gems awarded (can be 0 for either)
 */
export function rollChestCurrencyRewards(chestType: ChestType): ChestCurrencyRewards {
  const config = CHEST_CURRENCY_REWARDS[chestType];
  const rewards: ChestCurrencyRewards = { gold: 0, gems: 0 };

  // Roll for gold
  if (Math.random() < config.gold.chance) {
    rewards.gold = Math.floor(
      Math.random() * (config.gold.max - config.gold.min + 1) + config.gold.min,
    );
  }

  // Roll for gems (very rare)
  if (Math.random() < config.gems.chance) {
    rewards.gems = Math.floor(
      Math.random() * (config.gems.max - config.gems.min + 1) + config.gems.min,
    );
  }

  return rewards;
}
