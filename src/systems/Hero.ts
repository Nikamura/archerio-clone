/**
 * Hero data models and types.
 * Contains interfaces for hero progression and state management.
 */

import type { HeroId, HeroBaseStats, HeroPerk } from "../config/heroData";

// Re-export HeroId for convenience
export type { HeroId } from "../config/heroData";

// ============================================
// Hero Progress Types
// ============================================

/**
 * Persistent hero progress data
 * Stored in SaveManager
 */
export interface HeroProgress {
  level: number;
  xp: number;
  unlockedPerks: number[]; // Array of perk levels that have been unlocked
}

/**
 * Computed hero stats (after level bonuses and perks)
 */
export interface ComputedHeroStats {
  maxHealth: number;
  attack: number;
  attackSpeed: number;
  critChance: number;
  critDamage: number;
}

/**
 * Hero selection event data
 */
export interface HeroSelectEvent {
  previousHeroId: HeroId | null;
  newHeroId: HeroId;
}

/**
 * Hero unlock event data
 */
export interface HeroUnlockEvent {
  heroId: HeroId;
  cost: number;
  currency: "gold" | "gems";
}

/**
 * Hero level up event data
 */
export interface HeroLevelUpEvent {
  heroId: HeroId;
  previousLevel: number;
  newLevel: number;
  cost: number;
  newPerks: HeroPerk[];
}

// ============================================
// Hero Manager Events
// ============================================

/**
 * Event names for HeroManager
 */
export const HERO_EVENTS = {
  HERO_SELECTED: "hero_selected",
  HERO_UNLOCKED: "hero_unlocked",
  HERO_LEVELED_UP: "hero_leveled_up",
  HERO_STATS_CHANGED: "hero_stats_changed",
} as const;

// ============================================
// Hero State Types
// ============================================

/**
 * Complete hero state including definition and progress
 */
export interface HeroState {
  id: HeroId;
  name: string;
  level: number;
  xp: number;
  isUnlocked: boolean;
  baseStats: HeroBaseStats;
  computedStats: ComputedHeroStats;
  unlockedPerks: HeroPerk[];
  nextPerk: HeroPerk | null;
  progressToNextPerk: number; // 0-1 progress toward next perk level
}

/**
 * Save data format for hero progress
 * Used for serialization
 */
export interface HeroSaveData {
  unlockedHeroes: HeroId[];
  selectedHeroId: HeroId;
  heroProgress: Record<HeroId, HeroProgress>;
}

/**
 * Create default hero progress for a new hero
 */
export function createDefaultHeroProgress(): HeroProgress {
  return {
    level: 1,
    xp: 0,
    unlockedPerks: [],
  };
}

/**
 * Create default save data for heroes
 */
export function createDefaultHeroSaveData(): HeroSaveData {
  return {
    unlockedHeroes: ["atreus"], // Atreus is free
    selectedHeroId: "atreus",
    heroProgress: {
      atreus: createDefaultHeroProgress(),
      helix: createDefaultHeroProgress(),
      meowgik: createDefaultHeroProgress(),
    },
  };
}
