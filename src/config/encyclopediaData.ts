/**
 * Encyclopedia Data Configuration
 *
 * Provides unified data for the in-game encyclopedia/guide feature.
 * Aggregates information from equipment, enemies, abilities, talents, heroes,
 * perks, achievements, and chests for documentation display.
 */

import { ChapterId, EnemyType } from "./chapterData";
import { BossId, BOSS_DEFINITIONS } from "./bossData";
import { TALENTS, TalentId, TalentTier, TIER_COLORS as TALENT_TIER_COLORS } from "./talentData";
import { HERO_DEFINITIONS, HeroId } from "./heroData";
import { ACHIEVEMENTS } from "./achievementData";
import { CHEST_CONFIGS, ChestType, CHEST_ORDER } from "../data/chestData";
import { ABILITIES } from "../scenes/LevelUpScene";
import {
  WEAPON_DATA,
  ARMOR_DATA,
  RING_DATA,
  SPIRIT_DATA,
  PERKS,
  BaseEquipmentData,
} from "./equipmentData";
import { EquipmentSlotType, PerkId, Rarity, RARITY_CONFIGS } from "../systems/Equipment";
import { PlayerStats } from "../systems/PlayerStats";

// ============================================
// Encyclopedia Category Types
// ============================================

export type EncyclopediaCategory =
  | "equipment"
  | "enemies"
  | "bosses"
  | "abilities"
  | "talents"
  | "heroes"
  | "perks"
  | "achievements"
  | "chests"
  | "guides";

// ============================================
// Tab Configuration
// ============================================

export interface CategoryTabConfig {
  id: EncyclopediaCategory;
  label: string;
  color: number;
}

export const CATEGORY_TABS: CategoryTabConfig[] = [
  { id: "guides", label: "Guides", color: 0x00bfff },
  { id: "equipment", label: "Equip", color: 0x4a9eff },
  { id: "enemies", label: "Enemies", color: 0xff4444 },
  { id: "bosses", label: "Bosses", color: 0x990000 },
  { id: "abilities", label: "Skills", color: 0xffdd00 },
  { id: "talents", label: "Talents", color: 0x9932cc },
  { id: "heroes", label: "Heroes", color: 0x22cc66 },
  { id: "perks", label: "Perks", color: 0xa855f7 },
  { id: "achievements", label: "Achieve", color: 0xffd700 },
  { id: "chests", label: "Chests", color: 0x8b4513 },
];

// ============================================
// Enemy Encyclopedia Data
// ============================================

export interface EnemyEncyclopediaEntry {
  id: EnemyType;
  name: string;
  description: string;
  behavior: string;
  introducedChapter: ChapterId;
  spriteKey: string;
}

/**
 * Enemy descriptions for the encyclopedia
 * Maps enemy types to their lore and behavior descriptions
 */
export const ENEMY_ENCYCLOPEDIA: Record<EnemyType, EnemyEncyclopediaEntry> = {
  melee: {
    id: "melee",
    name: "Slime",
    description: "A basic dungeon creature that mindlessly charges at intruders.",
    behavior: "Moves directly toward player, deals contact damage.",
    introducedChapter: 1,
    spriteKey: "enemyMelee",
  },
  ranged: {
    id: "ranged",
    name: "Skeleton Archer",
    description: "Undead marksman that fires aimed shots from a distance.",
    behavior: "Stops to aim (shows telegraph line), then fires a single projectile.",
    introducedChapter: 1,
    spriteKey: "enemyRanged",
  },
  spreader: {
    id: "spreader",
    name: "Spreader",
    description: "Stationary enemy that creates dangerous zones with projectile patterns.",
    behavior: "Fires 4 projectiles in cardinal directions (up, down, left, right).",
    introducedChapter: 1,
    spriteKey: "enemySpreader",
  },
  bomber: {
    id: "bomber",
    name: "Bomber",
    description: "Explosive expert that throws bombs at the player's position.",
    behavior: "Maintains distance, winds up before throwing explosive bombs.",
    introducedChapter: 2,
    spriteKey: "enemyBomber",
  },
  tank: {
    id: "tank",
    name: "Tank",
    description: "Heavily armored brute with devastating area attacks.",
    behavior: "Slow movement, high HP. Charges up an 8-way spread attack.",
    introducedChapter: 3,
    spriteKey: "enemyTank",
  },
  charger: {
    id: "charger",
    name: "Charger",
    description: "Fast predator that dashes at high speed toward its prey.",
    behavior: "Shows direction telegraph, then charges. Stunned briefly after charging.",
    introducedChapter: 3,
    spriteKey: "enemyCharger",
  },
  healer: {
    id: "healer",
    name: "Healer",
    description: "Support enemy that restores health to nearby allies.",
    behavior: "Weak and evasive. Heals all enemies within range. Priority target!",
    introducedChapter: 4,
    spriteKey: "enemyHealer",
  },
  spawner: {
    id: "spawner",
    name: "Spawner",
    description: "Stationary hive that continuously produces minion enemies.",
    behavior: "Creates weak but fast minions. Destroy quickly to stop reinforcements.",
    introducedChapter: 4,
    spriteKey: "enemySpawner",
  },
};

/**
 * Get which chapter introduces an enemy type
 */
export function getEnemyIntroChapter(enemyType: EnemyType): ChapterId {
  return ENEMY_ENCYCLOPEDIA[enemyType].introducedChapter;
}

/**
 * Get all enemy entries for the encyclopedia
 */
export function getAllEnemyEntries(): EnemyEncyclopediaEntry[] {
  return Object.values(ENEMY_ENCYCLOPEDIA).sort(
    (a, b) => a.introducedChapter - b.introducedChapter,
  );
}

// ============================================
// Boss Encyclopedia Data
// ============================================

export interface BossEncyclopediaEntry {
  id: BossId;
  name: string;
  description: string;
  chapter: ChapterId;
  attackPatterns: string[];
  spriteKey: string;
  isMainBoss: boolean;
}

/**
 * Get all boss entries for the encyclopedia
 */
export function getAllBossEntries(): BossEncyclopediaEntry[] {
  return Object.values(BOSS_DEFINITIONS)
    .map((boss) => ({
      id: boss.id,
      name: boss.name,
      description: boss.description,
      chapter: boss.chapter,
      attackPatterns: boss.attackPatterns,
      spriteKey: boss.visuals.textureKey,
      isMainBoss: boss.isMainBoss,
    }))
    .sort((a, b) => {
      if (a.chapter !== b.chapter) return a.chapter - b.chapter;
      return a.isMainBoss ? -1 : 1;
    });
}

// ============================================
// Equipment Encyclopedia Data
// ============================================

export interface EquipmentEncyclopediaEntry {
  id: string;
  name: string;
  description: string;
  slot: EquipmentSlotType;
  statSummary: string;
  spriteKey: string;
}

/**
 * Format equipment stats into a readable summary
 */
function formatEquipmentStats(data: BaseEquipmentData): string {
  const parts: string[] = [];
  const stats = data.baseStats;

  if (stats.attackDamage) parts.push(`${stats.attackDamage} ATK`);
  if (stats.attackSpeedPercent) {
    const sign = stats.attackSpeedPercent > 0 ? "+" : "";
    parts.push(`${sign}${Math.round(stats.attackSpeedPercent * 100)}% Speed`);
  }
  if (stats.critChance) parts.push(`${Math.round(stats.critChance * 100)}% Crit`);
  if (stats.critDamage) parts.push(`+${Math.round(stats.critDamage * 100)}% Crit DMG`);
  if (stats.maxHealth) parts.push(`${stats.maxHealth} HP`);
  if (stats.maxHealthPercent) parts.push(`+${Math.round(stats.maxHealthPercent * 100)}% HP`);
  if (stats.damageReductionPercent)
    parts.push(`${Math.round(stats.damageReductionPercent * 100)}% DR`);
  if (stats.dodgeChance) {
    const cappedDodge = Math.min(stats.dodgeChance, PlayerStats.MAX_DODGE_CHANCE);
    const isCapped = stats.dodgeChance > PlayerStats.MAX_DODGE_CHANCE;
    parts.push(`${Math.round(cappedDodge * 100)}% Dodge${isCapped ? " (max)" : ""}`);
  }
  if (stats.bonusXPPercent) parts.push(`+${Math.round(stats.bonusXPPercent * 100)}% XP`);
  if (stats.goldBonusPercent) parts.push(`+${Math.round(stats.goldBonusPercent * 100)}% Gold`);
  if (stats.attackDamagePercent) parts.push(`+${Math.round(stats.attackDamagePercent * 100)}% ATK`);

  return parts.join(", ") || "No stats";
}

/**
 * Get all equipment entries for the encyclopedia
 */
export function getAllEquipmentEntries(): EquipmentEncyclopediaEntry[] {
  const entries: EquipmentEncyclopediaEntry[] = [];

  // Weapons
  for (const [type, data] of Object.entries(WEAPON_DATA)) {
    entries.push({
      id: type,
      name: data.name,
      description: data.description,
      slot: "weapon",
      statSummary: formatEquipmentStats(data),
      spriteKey: `equip_${type}`,
    });
  }

  // Armor
  for (const [type, data] of Object.entries(ARMOR_DATA)) {
    entries.push({
      id: type,
      name: data.name,
      description: data.description,
      slot: "armor",
      statSummary: formatEquipmentStats(data),
      spriteKey: `equip_${type}`,
    });
  }

  // Rings
  for (const [type, data] of Object.entries(RING_DATA)) {
    entries.push({
      id: type,
      name: data.name,
      description: data.description,
      slot: "ring",
      statSummary: formatEquipmentStats(data),
      spriteKey: `equip_${type}`,
    });
  }

  // Spirits
  for (const [type, data] of Object.entries(SPIRIT_DATA)) {
    entries.push({
      id: type,
      name: data.name,
      description: data.description,
      slot: "spirit",
      statSummary: formatEquipmentStats(data),
      spriteKey: `equip_${type}`,
    });
  }

  return entries;
}

// ============================================
// Ability Encyclopedia Data
// ============================================

export interface AbilityEncyclopediaEntry {
  id: string;
  name: string;
  description: string;
  color: number;
  spriteKey: string;
}

/**
 * Get all ability entries for the encyclopedia
 */
export function getAllAbilityEntries(): AbilityEncyclopediaEntry[] {
  return ABILITIES.map((ability) => ({
    id: ability.id,
    name: ability.name,
    description: ability.description,
    color: ability.color,
    spriteKey: ability.iconKey,
  }));
}

// ============================================
// Talent Encyclopedia Data
// ============================================

export interface TalentEncyclopediaEntry {
  id: TalentId;
  name: string;
  description: string;
  tier: TalentTier;
  tierColor: string;
  maxLevel: number;
}

/**
 * Get all talent entries for the encyclopedia
 */
export function getAllTalentEntries(): TalentEncyclopediaEntry[] {
  return Object.values(TALENTS).map((talent) => ({
    id: talent.id,
    name: talent.name,
    description: talent.description,
    tier: talent.tier,
    tierColor: TALENT_TIER_COLORS[talent.tier],
    maxLevel: talent.maxLevel,
  }));
}

// ============================================
// Hero Encyclopedia Data
// ============================================

export interface HeroEncyclopediaEntry {
  id: HeroId;
  name: string;
  description: string;
  abilityName: string;
  abilityDescription: string;
  unlockCost: number;
  unlockCurrency: string;
  perkCount: number;
  spriteKey: string;
}

/**
 * Get all hero entries for the encyclopedia
 */
export function getAllHeroEntries(): HeroEncyclopediaEntry[] {
  return Object.values(HERO_DEFINITIONS).map((hero) => ({
    id: hero.id,
    name: hero.name,
    description: hero.description,
    abilityName: hero.ability.name,
    abilityDescription: hero.ability.description,
    unlockCost: hero.unlockCost,
    unlockCurrency: hero.unlockCurrency,
    perkCount: hero.perks.length,
    spriteKey: hero.icon,
  }));
}

// ============================================
// Perk Encyclopedia Data
// ============================================

export interface PerkEncyclopediaEntry {
  id: PerkId;
  name: string;
  description: string;
  rarity: Rarity;
  rarityColor: string;
}

/**
 * Get all perk entries for the encyclopedia
 */
export function getAllPerkEntries(): PerkEncyclopediaEntry[] {
  return Object.values(PERKS).map((perk) => ({
    id: perk.id,
    name: perk.name,
    description: perk.description,
    rarity: perk.rarity,
    rarityColor: RARITY_CONFIGS[perk.rarity].color,
  }));
}

// ============================================
// Achievement Encyclopedia Data
// ============================================

export interface AchievementEncyclopediaEntry {
  id: string;
  name: string;
  description: string;
  tierCount: number;
  tierRequirements: number[];
}

/**
 * Get all achievement entries for the encyclopedia
 */
export function getAllAchievementEntries(): AchievementEncyclopediaEntry[] {
  return ACHIEVEMENTS.map((achievement) => ({
    id: achievement.id,
    name: achievement.name,
    description: achievement.description,
    tierCount: achievement.tiers.length,
    tierRequirements: achievement.tiers.map((t) => t.requirement),
  }));
}

// ============================================
// Chest Encyclopedia Data
// ============================================

export interface ChestEncyclopediaEntry {
  id: ChestType;
  name: string;
  description: string;
  color: string;
  dropRates: Record<Rarity, number>;
}

/**
 * Get all chest entries for the encyclopedia
 */
export function getAllChestEntries(): ChestEncyclopediaEntry[] {
  return CHEST_ORDER.map((chestType) => {
    const config = CHEST_CONFIGS[chestType];
    return {
      id: chestType,
      name: config.name,
      description: config.description,
      color: config.color,
      dropRates: config.dropRates,
    };
  });
}

// ============================================
// Guide Encyclopedia Data
// ============================================

export interface GuideEncyclopediaEntry {
  id: string;
  name: string;
  description: string;
  details: string[];
  icon: string;
  color: number;
}

/**
 * Game mechanic guides for the encyclopedia
 * Explains core systems and how they work
 */
export const GUIDE_ENCYCLOPEDIA: GuideEncyclopediaEntry[] = [
  {
    id: "core_gameplay",
    name: "Core Gameplay",
    description: "Stop to shoot, move to dodge!",
    details: [
      "Your archer auto-fires when you stand still.",
      "Moving stops your attacks but lets you dodge.",
      "Balance offense and defense by timing your movements.",
      "Clear all enemies in a room to proceed.",
      "Defeat the boss at the end of each chapter.",
    ],
    icon: "🎯",
    color: 0x00bfff,
  },
  {
    id: "equipment_fusion",
    name: "Equipment Fusion",
    description: "Combine items to increase rarity",
    details: [
      "Fusion combines 3 identical items into 1 higher rarity.",
      "Items must be the same TYPE and RARITY to fuse.",
      "The new item's level = average of consumed items (rounded up).",
      "Legendary items cannot be fused (already max rarity).",
      '"Fuse All" chains fusions automatically until no more matches.',
      "Rarity order: Common → Great → Rare → Epic → Legendary",
    ],
    icon: "✨",
    color: 0xffd700,
  },
  {
    id: "rarity_system",
    name: "Rarity System",
    description: "Equipment quality tiers and their benefits",
    details: [
      "Common (Gray): Max Lv.20, 0 perks, 1.0x stats",
      "Great (Green): Max Lv.30, 1 perk, 1.2x stats",
      "Rare (Blue): Max Lv.40, 2 perks, 1.5x stats",
      "Epic (Purple): Max Lv.50, 3 perks, 2.0x stats",
      "Legendary (Gold): Max Lv.70, 4 perks, 3.0x stats",
      "Higher rarity = more perks, higher max level, better stats.",
    ],
    icon: "💎",
    color: 0xa855f7,
  },
  {
    id: "equipment_upgrades",
    name: "Equipment Upgrades",
    description: "Level up your gear with gold and scrolls",
    details: [
      "Upgrade costs increase with level and rarity.",
      "Each level increases the item's base stats.",
      "Max level is determined by the item's rarity.",
      "Upgrading equipped items improves your stats immediately.",
      "Gold and scrolls are required for each upgrade.",
    ],
    icon: "⬆️",
    color: 0x22cc66,
  },
  {
    id: "equipment_perks",
    name: "Equipment Perks",
    description: "Bonus stats on higher rarity gear",
    details: [
      "Perks provide additional stat bonuses.",
      "Number of perk slots depends on rarity.",
      "Perks are randomly assigned when equipment is created.",
      "Common items have 0 perks, Legendary items have 4.",
      "Attack, defense, crit, and utility perks are available.",
    ],
    icon: "🔮",
    color: 0xff6644,
  },
  {
    id: "ability_priority",
    name: "Ability Priority",
    description: "Set which abilities to auto-learn first",
    details: [
      "Access via the gear icon on the main menu.",
      "Drag abilities to reorder your priority list.",
      "Top abilities are chosen first during auto-select.",
      "Auto-select triggers on timeout or auto-level-up mode.",
      "New abilities are added to the bottom of the list.",
      "Reset button restores default priority order.",
    ],
    icon: "📋",
    color: 0xffdd00,
  },
  {
    id: "abilities_levelup",
    name: "Abilities & Level-Up",
    description: "In-run upgrades when you gain levels",
    details: [
      "Gain XP by defeating enemies.",
      "Each level-up offers 3 random abilities to choose.",
      "Abilities stack - picking the same one increases its power.",
      "Some abilities can only be obtained once (no stacking).",
      "Build synergies by combining complementary abilities.",
    ],
    icon: "⚡",
    color: 0x4a9eff,
  },
  {
    id: "talent_lottery",
    name: "Talent System",
    description: "Permanent upgrades via the talent lottery",
    details: [
      "Spend gold to spin the talent wheel.",
      "Talents are permanent bonuses across all runs.",
      "Common (50%), Rare (35%), Epic (15%) drop rates.",
      "Each talent can be upgraded multiple times.",
      "Effects apply automatically to every run.",
    ],
    icon: "🎰",
    color: 0x9932cc,
  },
  {
    id: "chapters_endless",
    name: "Chapters & Endless",
    description: "Game progression modes",
    details: [
      "Story mode has multiple chapters with unique enemies.",
      "Each chapter ends with a boss fight.",
      "Complete chapters to unlock new content.",
      "Endless mode unlocks after completing chapters.",
      "Endless mode has infinite waves with scaling difficulty.",
      "Difficulty increases 1.5x per wave in endless mode.",
    ],
    icon: "📖",
    color: 0xff4444,
  },
  {
    id: "boss_mechanics",
    name: "Boss Mechanics",
    description: "How to fight bosses effectively",
    details: [
      "Bosses appear at the end of each chapter.",
      "Watch for telegraph indicators (red lines/circles).",
      "Red warnings show where attacks will land.",
      "Bosses cycle through multiple attack patterns.",
      "Move during attacks, stop during recovery phases.",
      "Some bosses have mini-bosses that spawn mid-chapter.",
      "Boss HP and damage scale with chapter difficulty.",
    ],
    icon: "👹",
    color: 0x990000,
  },
  {
    id: "heroes_system",
    name: "Heroes",
    description: "Unlock heroes with unique abilities",
    details: [
      "Each hero has a unique active ability.",
      "Heroes have different stat bonuses (perks).",
      "Unlock heroes with gold or gems.",
      "Hero abilities are on cooldown and activated manually.",
      "Choose your hero before starting a run.",
    ],
    icon: "🦸",
    color: 0x22cc66,
  },
  {
    id: "equipment_slots",
    name: "Equipment Slots",
    description: "Four slots for different gear types",
    details: [
      "Weapon: Determines attack damage and projectile type.",
      "Armor: Provides HP, damage reduction, and defense.",
      "Ring: Grants crit chance, crit damage, or dodge.",
      "Spirit: Gives XP bonus, gold bonus, or combat help.",
      "Each slot can hold one item at a time.",
      "Equip the best gear for your playstyle!",
    ],
    icon: "🎒",
    color: 0x4a9eff,
  },
  {
    id: "daily_rewards",
    name: "Daily Rewards",
    description: "Log in daily for bonus rewards",
    details: [
      "7-day login reward cycle.",
      "Rewards increase each consecutive day.",
      "Includes gold, gems, scrolls, and chests.",
      "Missing a day resets your streak.",
      "Day 7 gives the best rewards!",
    ],
    icon: "📅",
    color: 0xffd700,
  },
];

/**
 * Get all guide entries for the encyclopedia
 */
export function getAllGuideEntries(): GuideEncyclopediaEntry[] {
  return GUIDE_ENCYCLOPEDIA;
}

// ============================================
// Count Helpers
// ============================================

export const ENCYCLOPEDIA_COUNTS = {
  guides: GUIDE_ENCYCLOPEDIA.length,
  equipment:
    Object.keys(WEAPON_DATA).length +
    Object.keys(ARMOR_DATA).length +
    Object.keys(RING_DATA).length +
    Object.keys(SPIRIT_DATA).length,
  enemies: Object.keys(ENEMY_ENCYCLOPEDIA).length,
  bosses: Object.keys(BOSS_DEFINITIONS).length,
  abilities: ABILITIES.length,
  talents: Object.keys(TALENTS).length,
  heroes: Object.keys(HERO_DEFINITIONS).length,
  perks: Object.keys(PERKS).length,
  achievements: ACHIEVEMENTS.length,
  chests: CHEST_ORDER.length,
};
