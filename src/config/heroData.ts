/**
 * Hero configuration data and definitions.
 * Contains all hero stats, abilities, and perk unlocks.
 */

// ============================================
// Type Definitions
// ============================================

/**
 * Valid hero identifiers
 */
export type HeroId = "atreus" | "helix" | "meowgik";

/**
 * Currency types for hero unlocks
 */
export type UnlockCurrency = "gold" | "gems" | "free";

/**
 * Base stats for a hero
 */
export interface HeroBaseStats {
  maxHealth: number;
  attack: number;
  attackSpeed: number;
}

/**
 * Hero ability type
 */
export type HeroAbilityType = "passive" | "active" | "summon";

/**
 * Hero ability definition
 */
export interface HeroAbility {
  id: string;
  name: string;
  description: string;
  type: HeroAbilityType;
}

/**
 * Perk unlock milestone
 */
export interface HeroPerk {
  level: number; // Level required to unlock
  name: string;
  description: string;
  effect: {
    type: "stat_boost" | "ability_enhance" | "special";
    stat?: "attack" | "health" | "attackSpeed" | "critChance" | "critDamage";
    value?: number; // Percentage boost (e.g., 0.05 = +5%)
    special?: string; // Special effect identifier
  };
}

/**
 * Complete hero definition
 */
export interface HeroDefinition {
  id: HeroId;
  name: string;
  description: string;
  unlockCost: number;
  unlockCurrency: UnlockCurrency;
  baseStats: HeroBaseStats;
  ability: HeroAbility;
  perks: HeroPerk[];
  icon: string; // Asset key for hero icon
}

// ============================================
// Hero Definitions
// ============================================

export const HERO_DEFINITIONS: Record<HeroId, HeroDefinition> = {
  atreus: {
    id: "atreus",
    name: "Atreus",
    description: "A balanced warrior with no weaknesses. Perfect for beginners.",
    unlockCost: 0,
    unlockCurrency: "free",
    baseStats: {
      maxHealth: 100,
      attack: 10,
      attackSpeed: 1.0,
    },
    ability: {
      id: "balanced",
      name: "Balanced Training",
      description: "No special ability, but no weaknesses either.",
      type: "passive",
    },
    perks: [
      {
        level: 10,
        name: "Steady Aim",
        description: "+5% attack damage",
        effect: { type: "stat_boost", stat: "attack", value: 0.05 },
      },
      {
        level: 20,
        name: "Endurance",
        description: "+10% max health",
        effect: { type: "stat_boost", stat: "health", value: 0.1 },
      },
      {
        level: 40,
        name: "Swift Strike",
        description: "+15% attack speed",
        effect: { type: "stat_boost", stat: "attackSpeed", value: 0.15 },
      },
      {
        level: 60,
        name: "Master Archer",
        description: "+10% crit chance, +20% crit damage",
        effect: { type: "special", special: "master_archer" },
      },
    ],
    icon: "hero_atreus",
  },
  helix: {
    id: "helix",
    name: "Helix",
    description: "A fierce warrior with deadly precision. Higher crit chance and damage.",
    unlockCost: 1500,
    unlockCurrency: "gold",
    baseStats: {
      maxHealth: 90,
      attack: 12,
      attackSpeed: 0.95,
    },
    ability: {
      id: "crit",
      name: "Critical Strike",
      description: "+10% crit chance, +20% crit damage",
      type: "passive",
    },
    perks: [
      {
        level: 10,
        name: "Fury",
        description: "+5% base attack damage",
        effect: { type: "stat_boost", stat: "attack", value: 0.05 },
      },
      {
        level: 20,
        name: "Deadly Precision",
        description: "+5% additional crit chance",
        effect: { type: "stat_boost", stat: "critChance", value: 0.05 },
      },
      {
        level: 40,
        name: "Executioner",
        description: "+25% crit damage",
        effect: { type: "stat_boost", stat: "critDamage", value: 0.25 },
      },
      {
        level: 60,
        name: "Undying Rage",
        description: "Survive lethal damage once per run with 1 HP",
        effect: { type: "special", special: "undying_rage" },
      },
    ],
    icon: "hero_helix",
  },
  meowgik: {
    id: "meowgik",
    name: "Meowgik",
    description: "A wizard who summons spirit cats to fight alongside.",
    unlockCost: 300,
    unlockCurrency: "gems",
    baseStats: {
      maxHealth: 100,
      attack: 8,
      attackSpeed: 1.1,
    },
    ability: {
      id: "spirit_cats",
      name: "Spirit Cats",
      description: "Summons 2 spirit cats that auto-attack enemies",
      type: "summon",
    },
    perks: [
      {
        level: 10,
        name: "Cat Familiar",
        description: "Spirit cats deal +10% damage",
        effect: { type: "ability_enhance", special: "cat_damage_boost" },
      },
      {
        level: 20,
        name: "Nine Lives",
        description: "+10% max health",
        effect: { type: "stat_boost", stat: "health", value: 0.1 },
      },
      {
        level: 40,
        name: "Cat Army",
        description: "Summon 1 additional spirit cat (3 total)",
        effect: { type: "ability_enhance", special: "extra_cat" },
      },
      {
        level: 60,
        name: "Cat Lord",
        description: "Spirit cats can critically hit for 200% damage",
        effect: { type: "special", special: "cat_crits" },
      },
    ],
    icon: "hero_meowgik",
  },
};

// ============================================
// Hero Level Configuration
// ============================================

/**
 * Maximum hero level
 */
export const HERO_MAX_LEVEL = 60;

/**
 * Stats gained per hero level
 */
export const HERO_LEVEL_STATS = {
  attackPercent: 0.02, // +2% attack per level
  healthPercent: 0.02, // +2% health per level
  attackSpeedPercent: 0.01, // +1% attack speed per level
};

/**
 * Calculate gold cost for leveling up a hero
 * Uses exponential scaling: base * level^1.5
 * @param currentLevel The hero's current level
 * @returns Gold cost for the next level
 */
export function getHeroLevelUpCost(currentLevel: number): number {
  if (currentLevel >= HERO_MAX_LEVEL) return Infinity;
  const baseCost = 100;
  const scalingFactor = 1.5;
  return Math.floor(baseCost * Math.pow(currentLevel, scalingFactor));
}

/**
 * Get all level-up costs up to max level
 * Useful for UI displaying total investment needed
 */
export function getAllLevelUpCosts(): number[] {
  const costs: number[] = [];
  for (let level = 1; level < HERO_MAX_LEVEL; level++) {
    costs.push(getHeroLevelUpCost(level));
  }
  return costs;
}

/**
 * Calculate total gold needed to reach a target level from current level
 */
export function getTotalCostToLevel(fromLevel: number, toLevel: number): number {
  if (fromLevel >= toLevel || toLevel > HERO_MAX_LEVEL) return 0;
  let total = 0;
  for (let level = fromLevel; level < toLevel; level++) {
    total += getHeroLevelUpCost(level);
  }
  return total;
}

/**
 * Calculate XP required to level up a hero
 * Uses exponential scaling: baseXP * level^1.8
 * @param currentLevel The hero's current level
 * @returns XP required for the next level
 */
export function getHeroXPThreshold(currentLevel: number): number {
  if (currentLevel >= HERO_MAX_LEVEL) return Infinity;
  const baseXP = 50;
  const scalingFactor = 1.8;
  return Math.floor(baseXP * Math.pow(currentLevel, scalingFactor));
}

// ============================================
// Hero Ability Helpers
// ============================================

/**
 * Spirit cat configuration for Meowgik
 */
export interface SpiritCatConfig {
  count: number; // Number of cats to spawn
  damage: number; // Damage per cat attack
  attackSpeed: number; // Attacks per second
  damageMultiplier: number; // Bonus from perks
  canCrit: boolean; // Whether cats can crit (level 60 perk)
}

/**
 * Get spirit cat configuration based on hero level and perks
 * @param heroLevel Meowgik's current level
 * @param unlockedPerks Set of unlocked perk level milestones
 * @param baseAttack Hero's base attack value
 * @returns Spirit cat spawn configuration
 */
export function getSpiritCatConfig(
  heroLevel: number,
  unlockedPerks: Set<number>,
  baseAttack: number,
): SpiritCatConfig {
  let count = 2; // Base 2 cats
  let damageMultiplier = 1.0;
  let canCrit = false;

  // Level 10 perk: +10% cat damage
  if (unlockedPerks.has(10)) {
    damageMultiplier *= 1.1;
  }

  // Level 40 perk: +1 cat
  if (unlockedPerks.has(40)) {
    count = 3;
  }

  // Level 60 perk: cats can crit
  if (unlockedPerks.has(60)) {
    canCrit = true;
  }

  // Cat damage scales with hero level (0.5% per level)
  const levelScaling = 1 + heroLevel * 0.005;

  return {
    count,
    damage: Math.floor(baseAttack * 0.3 * damageMultiplier * levelScaling),
    attackSpeed: 1.5, // 1.5 attacks per second
    damageMultiplier,
    canCrit,
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get all hero IDs
 */
export function getAllHeroIds(): HeroId[] {
  return Object.keys(HERO_DEFINITIONS) as HeroId[];
}

/**
 * Check if a hero ID is valid
 */
export function isValidHeroId(id: string): id is HeroId {
  return id in HERO_DEFINITIONS;
}

/**
 * Get hero definition by ID
 */
export function getHeroDefinition(id: HeroId): HeroDefinition {
  return HERO_DEFINITIONS[id];
}

/**
 * Get unlockable heroes (not free)
 */
export function getUnlockableHeroes(): HeroDefinition[] {
  return Object.values(HERO_DEFINITIONS).filter((h) => h.unlockCurrency !== "free");
}

/**
 * Get perks unlocked at or before a given level
 */
export function getUnlockedPerks(heroId: HeroId, level: number): HeroPerk[] {
  const hero = HERO_DEFINITIONS[heroId];
  return hero.perks.filter((perk) => perk.level <= level);
}

/**
 * Get next perk to unlock for a hero
 */
export function getNextPerk(heroId: HeroId, level: number): HeroPerk | null {
  const hero = HERO_DEFINITIONS[heroId];
  const nextPerk = hero.perks.find((perk) => perk.level > level);
  return nextPerk ?? null;
}
