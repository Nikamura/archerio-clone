/**
 * Equipment Data Configuration
 *
 * Defines base stats, upgrade costs, and perks for all equipment types.
 * This file serves as the central database for equipment definitions.
 */

import {
  WeaponType,
  ArmorType,
  RingType,
  SpiritType,
  EquipmentType,
  EquipmentSlotType,
  EquipmentStats,
  Rarity,
  PerkId,
  Perk,
  UpgradeCost,
  RARITY_CONFIGS,
} from "../systems/Equipment";

// ============================================
// Perk Definitions
// ============================================

/**
 * All available perks in the game
 */
export const PERKS: Record<PerkId, Perk> = {
  // Attack perks
  [PerkId.ATTACK_BOOST_SMALL]: {
    id: PerkId.ATTACK_BOOST_SMALL,
    name: "Attack +5%",
    description: "Increases attack damage by 5%",
    stats: { attackDamagePercent: 0.05 },
    rarity: Rarity.COMMON,
  },
  [PerkId.ATTACK_BOOST_MEDIUM]: {
    id: PerkId.ATTACK_BOOST_MEDIUM,
    name: "Attack +10%",
    description: "Increases attack damage by 10%",
    stats: { attackDamagePercent: 0.1 },
    rarity: Rarity.RARE,
  },
  [PerkId.ATTACK_BOOST_LARGE]: {
    id: PerkId.ATTACK_BOOST_LARGE,
    name: "Attack +15%",
    description: "Increases attack damage by 15%",
    stats: { attackDamagePercent: 0.15 },
    rarity: Rarity.EPIC,
  },
  [PerkId.ATTACK_SPEED_SMALL]: {
    id: PerkId.ATTACK_SPEED_SMALL,
    name: "Attack Speed +5%",
    description: "Increases attack speed by 5%",
    stats: { attackSpeedPercent: 0.05 },
    rarity: Rarity.GREAT,
  },
  [PerkId.ATTACK_SPEED_MEDIUM]: {
    id: PerkId.ATTACK_SPEED_MEDIUM,
    name: "Attack Speed +10%",
    description: "Increases attack speed by 10%",
    stats: { attackSpeedPercent: 0.1 },
    rarity: Rarity.EPIC,
  },

  // Crit perks
  [PerkId.CRIT_CHANCE_SMALL]: {
    id: PerkId.CRIT_CHANCE_SMALL,
    name: "Crit Chance +3%",
    description: "Increases critical hit chance by 3%",
    stats: { critChance: 0.03 },
    rarity: Rarity.GREAT,
  },
  [PerkId.CRIT_CHANCE_MEDIUM]: {
    id: PerkId.CRIT_CHANCE_MEDIUM,
    name: "Crit Chance +6%",
    description: "Increases critical hit chance by 6%",
    stats: { critChance: 0.06 },
    rarity: Rarity.EPIC,
  },
  [PerkId.CRIT_DAMAGE_SMALL]: {
    id: PerkId.CRIT_DAMAGE_SMALL,
    name: "Crit Damage +10%",
    description: "Increases critical damage by 10%",
    stats: { critDamage: 0.1 },
    rarity: Rarity.GREAT,
  },
  [PerkId.CRIT_DAMAGE_MEDIUM]: {
    id: PerkId.CRIT_DAMAGE_MEDIUM,
    name: "Crit Damage +20%",
    description: "Increases critical damage by 20%",
    stats: { critDamage: 0.2 },
    rarity: Rarity.EPIC,
  },

  // Defense perks
  [PerkId.HEALTH_BOOST_SMALL]: {
    id: PerkId.HEALTH_BOOST_SMALL,
    name: "Health +50",
    description: "Increases max health by 50",
    stats: { maxHealth: 50 },
    rarity: Rarity.COMMON,
  },
  [PerkId.HEALTH_BOOST_MEDIUM]: {
    id: PerkId.HEALTH_BOOST_MEDIUM,
    name: "Health +100",
    description: "Increases max health by 100",
    stats: { maxHealth: 100 },
    rarity: Rarity.RARE,
  },
  [PerkId.HEALTH_BOOST_LARGE]: {
    id: PerkId.HEALTH_BOOST_LARGE,
    name: "Health +200",
    description: "Increases max health by 200",
    stats: { maxHealth: 200 },
    rarity: Rarity.LEGENDARY,
  },
  [PerkId.DAMAGE_REDUCTION_SMALL]: {
    id: PerkId.DAMAGE_REDUCTION_SMALL,
    name: "Damage Reduction +5%",
    description: "Reduces incoming damage by 5%",
    stats: { damageReductionPercent: 0.05 },
    rarity: Rarity.RARE,
  },
  [PerkId.DODGE_SMALL]: {
    id: PerkId.DODGE_SMALL,
    name: "Dodge +1%",
    description: "Adds 1% chance to dodge attacks",
    stats: { dodgeChance: 0.01 },
    rarity: Rarity.GREAT,
  },
  [PerkId.DODGE_MEDIUM]: {
    id: PerkId.DODGE_MEDIUM,
    name: "Dodge +2%",
    description: "Adds 2% chance to dodge attacks",
    stats: { dodgeChance: 0.02 },
    rarity: Rarity.EPIC,
  },

  // Utility perks
  [PerkId.XP_BOOST_SMALL]: {
    id: PerkId.XP_BOOST_SMALL,
    name: "XP Bonus +5%",
    description: "Increases XP gained by 5%",
    stats: { bonusXPPercent: 0.05 },
    rarity: Rarity.COMMON,
  },
  [PerkId.GOLD_BOOST_SMALL]: {
    id: PerkId.GOLD_BOOST_SMALL,
    name: "Gold Bonus +5%",
    description: "Increases gold gained by 5%",
    stats: { goldBonusPercent: 0.05 },
    rarity: Rarity.COMMON,
  },
};

/**
 * Get perks available for a given rarity (includes perks from lower rarities)
 */
export function getAvailablePerks(rarity: Rarity): Perk[] {
  const rarityOrder = [Rarity.COMMON, Rarity.GREAT, Rarity.RARE, Rarity.EPIC, Rarity.LEGENDARY];
  const rarityIndex = rarityOrder.indexOf(rarity);

  return Object.values(PERKS).filter((perk) => {
    const perkRarityIndex = rarityOrder.indexOf(perk.rarity);
    return perkRarityIndex <= rarityIndex;
  });
}

/**
 * Get perks suitable for a specific equipment slot
 */
export function getPerksForSlot(slot: EquipmentSlotType, rarity: Rarity): Perk[] {
  const available = getAvailablePerks(rarity);

  // Filter perks by slot appropriateness
  return available.filter((perk) => {
    const stats = perk.stats;
    switch (slot) {
      case "weapon":
        return (
          stats.attackDamage !== undefined ||
          stats.attackDamagePercent !== undefined ||
          stats.attackSpeed !== undefined ||
          stats.attackSpeedPercent !== undefined ||
          stats.critChance !== undefined ||
          stats.critDamage !== undefined ||
          stats.projectileSpeed !== undefined ||
          stats.projectileSpeedPercent !== undefined
        );
      case "armor":
        return (
          stats.maxHealth !== undefined ||
          stats.maxHealthPercent !== undefined ||
          stats.damageReduction !== undefined ||
          stats.damageReductionPercent !== undefined ||
          stats.dodgeChance !== undefined
        );
      case "ring":
        return (
          stats.critChance !== undefined ||
          stats.critDamage !== undefined ||
          stats.dodgeChance !== undefined ||
          stats.attackDamagePercent !== undefined
        );
      case "spirit":
        return stats.bonusXPPercent !== undefined || stats.goldBonusPercent !== undefined;
      default:
        return true;
    }
  });
}

// ============================================
// Base Equipment Stats
// ============================================

/**
 * Base stats for each equipment type (before rarity scaling)
 */
export interface BaseEquipmentData {
  name: string;
  description: string;
  slot: EquipmentSlotType;
  baseStats: EquipmentStats;
}

/**
 * Weapon base stats
 */
export const WEAPON_DATA: Record<WeaponType, BaseEquipmentData> = {
  [WeaponType.BRAVE_BOW]: {
    name: "Brave Bow",
    description: "A balanced bow with reliable accuracy",
    slot: "weapon",
    baseStats: {
      attackDamage: 50,
      critChance: 0.03,
    },
  },
  [WeaponType.SAW_BLADE]: {
    name: "Saw Blade",
    description: "Fast attack speed with smaller projectiles",
    slot: "weapon",
    baseStats: {
      attackDamage: 40, // -20% base
      attackSpeedPercent: 0.2, // Bonus attack speed
      projectileSpeed: 50,
    },
  },
  [WeaponType.STAFF]: {
    name: "Staff",
    description: "Magical staff with homing projectiles",
    slot: "weapon",
    baseStats: {
      attackDamage: 45,
      attackSpeedPercent: -0.15, // Slower
      projectileSpeed: -30,
    },
  },
  [WeaponType.DEATH_SCYTHE]: {
    name: "Death Scythe",
    description: "Powerful but slow weapon with devastating crits",
    slot: "weapon",
    baseStats: {
      attackDamage: 75, // +45% damage
      attackSpeedPercent: -0.25, // Much slower
      critDamage: 0.15, // Rewards timing with big hits
    },
  },
};

/**
 * Armor base stats
 */
export const ARMOR_DATA: Record<ArmorType, BaseEquipmentData> = {
  [ArmorType.VEST]: {
    name: "Vest",
    description: "Light armor providing basic protection",
    slot: "armor",
    baseStats: {
      maxHealth: 100,
      damageReductionPercent: 0.03,
    },
  },
  [ArmorType.ROBE]: {
    name: "Robe",
    description: "Magical robe with dodge chance",
    slot: "armor",
    baseStats: {
      maxHealth: 75,
      dodgeChance: 0.02,
    },
  },
  [ArmorType.PHANTOM_CLOAK]: {
    name: "Phantom Cloak",
    description: "Ethereal cloak with high dodge chance",
    slot: "armor",
    baseStats: {
      maxHealth: 50,
      dodgeChance: 0.03,
    },
  },
  [ArmorType.GOLDEN_CHESTPLATE]: {
    name: "Golden Chestplate",
    description: "Heavy armor with maximum protection",
    slot: "armor",
    baseStats: {
      maxHealth: 200,
      damageReductionPercent: 0.1,
    },
  },
};

/**
 * Ring base stats
 */
export const RING_DATA: Record<RingType, BaseEquipmentData> = {
  [RingType.BEAR_RING]: {
    name: "Bear Ring",
    description: "Increases maximum health",
    slot: "ring",
    baseStats: {
      maxHealthPercent: 0.1,
    },
  },
  [RingType.WOLF_RING]: {
    name: "Wolf Ring",
    description: "Increases critical hit chance",
    slot: "ring",
    baseStats: {
      critChance: 0.05,
    },
  },
  [RingType.SERPENT_RING]: {
    name: "Serpent Ring",
    description: "Increases critical damage",
    slot: "ring",
    baseStats: {
      critDamage: 0.15,
    },
  },
  [RingType.FALCON_RING]: {
    name: "Falcon Ring",
    description: "Increases dodge chance",
    slot: "ring",
    baseStats: {
      dodgeChance: 0.02,
    },
  },
  [RingType.LION_RING]: {
    name: "Lion Ring",
    description: "Increases attack damage",
    slot: "ring",
    baseStats: {
      attackDamagePercent: 0.05,
    },
  },
};

/**
 * Spirit base stats
 */
export const SPIRIT_DATA: Record<SpiritType, BaseEquipmentData> = {
  [SpiritType.BAT]: {
    name: "Bat",
    description: "A helpful bat that increases XP gain",
    slot: "spirit",
    baseStats: {
      bonusXPPercent: 0.1,
    },
  },
  [SpiritType.LASER_BAT]: {
    name: "Laser Bat",
    description: "An aggressive bat that attacks enemies",
    slot: "spirit",
    baseStats: {
      attackDamagePercent: 0.05,
      bonusXPPercent: 0.05,
    },
  },
  [SpiritType.ELF]: {
    name: "Elf",
    description: "A treasure-hunting elf that increases gold gain",
    slot: "spirit",
    baseStats: {
      goldBonusPercent: 0.15,
    },
  },
  [SpiritType.LIVING_BOMB]: {
    name: "Living Bomb",
    description: "Explosive companion that deals area damage",
    slot: "spirit",
    baseStats: {
      attackDamagePercent: 0.08,
    },
  },
};

/**
 * Get base data for any equipment type
 */
export function getEquipmentBaseData(type: EquipmentType): BaseEquipmentData | undefined {
  // Check each category
  if (type in WEAPON_DATA) return WEAPON_DATA[type as WeaponType];
  if (type in ARMOR_DATA) return ARMOR_DATA[type as ArmorType];
  if (type in RING_DATA) return RING_DATA[type as RingType];
  if (type in SPIRIT_DATA) return SPIRIT_DATA[type as SpiritType];
  return undefined;
}

// ============================================
// Upgrade Costs
// ============================================

/**
 * Base upgrade costs (level 1 to 2)
 * Costs scale with level
 */
const BASE_UPGRADE_COSTS: Record<Rarity, UpgradeCost> = {
  [Rarity.COMMON]: { gold: 100, scrolls: 1 },
  [Rarity.GREAT]: { gold: 200, scrolls: 2 },
  [Rarity.RARE]: { gold: 400, scrolls: 4 },
  [Rarity.EPIC]: { gold: 800, scrolls: 8 },
  [Rarity.LEGENDARY]: { gold: 1500, scrolls: 15 },
};

/**
 * Base sell prices by rarity
 * Items sell for this base price + level bonus
 */
const BASE_SELL_PRICES: Record<Rarity, number> = {
  [Rarity.COMMON]: 25,
  [Rarity.GREAT]: 75,
  [Rarity.RARE]: 200,
  [Rarity.EPIC]: 500,
  [Rarity.LEGENDARY]: 1200,
};

/**
 * Calculate upgrade cost for a specific level
 * Cost increases with level using a power curve
 */
export function calculateUpgradeCost(rarity: Rarity, currentLevel: number): UpgradeCost {
  const base = BASE_UPGRADE_COSTS[rarity];
  const levelMultiplier = Math.pow(1.15, currentLevel - 1); // 15% increase per level

  return {
    gold: Math.floor(base.gold * levelMultiplier),
    scrolls: Math.ceil(base.scrolls * levelMultiplier),
  };
}

/**
 * Calculate total cost to upgrade from current level to target level
 */
export function calculateTotalUpgradeCost(
  rarity: Rarity,
  currentLevel: number,
  targetLevel: number,
): UpgradeCost {
  let totalGold = 0;
  let totalScrolls = 0;

  for (let level = currentLevel; level < targetLevel; level++) {
    const cost = calculateUpgradeCost(rarity, level);
    totalGold += cost.gold;
    totalScrolls += cost.scrolls;
  }

  return { gold: totalGold, scrolls: totalScrolls };
}

/**
 * Calculate sell price for an item
 * Returns approximately 30% of the total gold invested in upgrades
 * This makes selling feel rewarding while still encouraging keeping upgraded items
 */
export function calculateSellPrice(rarity: Rarity, level: number): number {
  const basePrice = BASE_SELL_PRICES[rarity];

  // If level 1, just return base price
  if (level <= 1) {
    return basePrice;
  }

  // Calculate total upgrade cost to reach this level
  const totalUpgradeCost = calculateTotalUpgradeCost(rarity, 1, level);

  // Return base price + 30% of invested upgrade gold
  const sellbackPercent = 0.3;
  return Math.floor(basePrice + totalUpgradeCost.gold * sellbackPercent);
}

// ============================================
// Stat Scaling
// ============================================

/**
 * Calculate stat value at a specific level
 * Stats increase by 2% per level
 */
export function calculateStatAtLevel(baseStat: number, level: number): number {
  const levelMultiplier = 1 + (level - 1) * 0.02; // 2% per level
  return Math.floor(baseStat * levelMultiplier);
}

/**
 * Apply rarity multiplier to base stats
 */
export function applyRarityMultiplier(stats: EquipmentStats, rarity: Rarity): EquipmentStats {
  const config = RARITY_CONFIGS[rarity];
  const result: EquipmentStats = {};

  // Apply multiplier to flat stats
  if (stats.attackDamage !== undefined) {
    result.attackDamage = Math.floor(stats.attackDamage * config.statMultiplier);
  }
  if (stats.maxHealth !== undefined) {
    result.maxHealth = Math.floor(stats.maxHealth * config.statMultiplier);
  }
  if (stats.damageReduction !== undefined) {
    result.damageReduction = Math.floor(stats.damageReduction * config.statMultiplier);
  }
  if (stats.projectileSpeed !== undefined) {
    result.projectileSpeed = Math.floor(stats.projectileSpeed * config.statMultiplier);
  }

  // Percentage stats scale slightly (half rate)
  // IMPORTANT: Negative stats (penalties) don't scale - they define weapon characteristics
  const percentMultiplier = 1 + (config.statMultiplier - 1) * 0.5;
  if (stats.attackDamagePercent !== undefined) {
    result.attackDamagePercent =
      stats.attackDamagePercent > 0
        ? stats.attackDamagePercent * percentMultiplier
        : stats.attackDamagePercent;
  }
  if (stats.attackSpeedPercent !== undefined) {
    // Negative attack speed (slow weapons) stays constant as a defining trait
    result.attackSpeedPercent =
      stats.attackSpeedPercent > 0
        ? stats.attackSpeedPercent * percentMultiplier
        : stats.attackSpeedPercent;
  }
  if (stats.maxHealthPercent !== undefined) {
    result.maxHealthPercent = stats.maxHealthPercent * percentMultiplier;
  }
  if (stats.damageReductionPercent !== undefined) {
    result.damageReductionPercent = stats.damageReductionPercent * percentMultiplier;
  }
  if (stats.critChance !== undefined) {
    result.critChance = stats.critChance * percentMultiplier;
  }
  if (stats.critDamage !== undefined) {
    result.critDamage = stats.critDamage * percentMultiplier;
  }
  if (stats.dodgeChance !== undefined) {
    result.dodgeChance = stats.dodgeChance * percentMultiplier;
  }
  if (stats.bonusXPPercent !== undefined) {
    result.bonusXPPercent = stats.bonusXPPercent * percentMultiplier;
  }
  if (stats.goldBonusPercent !== undefined) {
    result.goldBonusPercent = stats.goldBonusPercent * percentMultiplier;
  }
  if (stats.projectileSpeedPercent !== undefined) {
    result.projectileSpeedPercent = stats.projectileSpeedPercent * percentMultiplier;
  }
  if (stats.attackSpeed !== undefined) {
    result.attackSpeed = stats.attackSpeed * percentMultiplier;
  }

  return result;
}

/**
 * Calculate final equipment stats at a given level with rarity
 */
export function calculateEquipmentStats(
  baseStats: EquipmentStats,
  rarity: Rarity,
  level: number,
): EquipmentStats {
  // First apply rarity multiplier
  const rarityScaled = applyRarityMultiplier(baseStats, rarity);

  // Then apply level scaling
  const result: EquipmentStats = {};
  const levelMultiplier = 1 + (level - 1) * 0.02; // 2% per level

  // Percentage stat keys that should NOT be floored (they're meant to be decimals like 0.15 = 15%)
  const percentageStats = new Set([
    "attackSpeedPercent",
    "attackDamagePercent",
    "maxHealthPercent",
    "damageReductionPercent",
    "critChance",
    "critDamage",
    "dodgeChance",
    "bonusXPPercent",
    "goldBonusPercent",
    "projectileSpeedPercent",
  ]);

  for (const [key, value] of Object.entries(rarityScaled)) {
    if (value !== undefined) {
      const statKey = key as keyof EquipmentStats;
      const isPercentageStat = percentageStats.has(key);
      // Negative percentage stats (penalties) don't scale with level - they're defining traits
      const shouldScale = !isPercentageStat || value > 0;
      const scaledValue = shouldScale ? value * levelMultiplier : value;
      // Only floor flat stats, keep percentage stats as decimals
      result[statKey] = isPercentageStat ? scaledValue : Math.floor(scaledValue);
    }
  }

  return result;
}

// ============================================
// Random Equipment Generation
// ============================================

/**
 * Get all equipment types for a slot
 */
export function getEquipmentTypesForSlot(slot: EquipmentSlotType): EquipmentType[] {
  switch (slot) {
    case "weapon":
      return Object.values(WeaponType);
    case "armor":
      return Object.values(ArmorType);
    case "ring":
      return Object.values(RingType);
    case "spirit":
      return Object.values(SpiritType);
    default:
      return [];
  }
}

/**
 * Get a random rarity based on drop weights
 */
export function getRandomRarity(): Rarity {
  const totalWeight = Object.values(RARITY_CONFIGS).reduce(
    (sum, config) => sum + config.dropWeight,
    0,
  );
  let random = Math.random() * totalWeight;

  for (const [rarity, config] of Object.entries(RARITY_CONFIGS)) {
    random -= config.dropWeight;
    if (random <= 0) {
      return rarity as Rarity;
    }
  }

  return Rarity.COMMON; // Fallback
}

/**
 * Select random perks for equipment based on rarity
 */
export function selectRandomPerks(slot: EquipmentSlotType, rarity: Rarity): PerkId[] {
  const perkSlots = RARITY_CONFIGS[rarity].perkSlots;
  if (perkSlots === 0) return [];

  const availablePerks = getPerksForSlot(slot, rarity);
  const selected: PerkId[] = [];

  // Randomly select perks without duplicates
  const shuffled = [...availablePerks].sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(perkSlots, shuffled.length); i++) {
    selected.push(shuffled[i].id);
  }

  return selected;
}
