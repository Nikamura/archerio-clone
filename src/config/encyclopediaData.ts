/**
 * Encyclopedia Data Configuration
 *
 * Provides unified data for the in-game encyclopedia/guide feature.
 * Aggregates information from equipment, enemies, abilities, talents, heroes,
 * perks, achievements, and chests for documentation display.
 */

import { ChapterId, EnemyType } from './chapterData'
import { BossId, BOSS_DEFINITIONS } from './bossData'
import { TALENTS, TalentId, TalentTier, TIER_COLORS as TALENT_TIER_COLORS } from './talentData'
import { HERO_DEFINITIONS, HeroId } from './heroData'
import { ACHIEVEMENTS } from './achievementData'
import { CHEST_CONFIGS, ChestType, CHEST_ORDER } from '../data/chestData'
import { ABILITIES } from '../scenes/LevelUpScene'
import {
  WEAPON_DATA,
  ARMOR_DATA,
  RING_DATA,
  SPIRIT_DATA,
  PERKS,
  BaseEquipmentData,
} from './equipmentData'
import {
  EquipmentSlotType,
  PerkId,
  Rarity,
  RARITY_CONFIGS,
} from '../systems/Equipment'
import { PlayerStats } from '../systems/PlayerStats'

// ============================================
// Encyclopedia Category Types
// ============================================

export type EncyclopediaCategory =
  | 'equipment'
  | 'enemies'
  | 'bosses'
  | 'abilities'
  | 'talents'
  | 'heroes'
  | 'perks'
  | 'achievements'
  | 'chests'

// ============================================
// Tab Configuration
// ============================================

export interface CategoryTabConfig {
  id: EncyclopediaCategory
  label: string
  color: number
}

export const CATEGORY_TABS: CategoryTabConfig[] = [
  { id: 'equipment', label: 'Equip', color: 0x4a9eff },
  { id: 'enemies', label: 'Enemies', color: 0xff4444 },
  { id: 'bosses', label: 'Bosses', color: 0x990000 },
  { id: 'abilities', label: 'Skills', color: 0xffdd00 },
  { id: 'talents', label: 'Talents', color: 0x9932cc },
  { id: 'heroes', label: 'Heroes', color: 0x22cc66 },
  { id: 'perks', label: 'Perks', color: 0xa855f7 },
  { id: 'achievements', label: 'Achieve', color: 0xffd700 },
  { id: 'chests', label: 'Chests', color: 0x8b4513 },
]

// ============================================
// Enemy Encyclopedia Data
// ============================================

export interface EnemyEncyclopediaEntry {
  id: EnemyType
  name: string
  description: string
  behavior: string
  introducedChapter: ChapterId
  spriteKey: string
}

/**
 * Enemy descriptions for the encyclopedia
 * Maps enemy types to their lore and behavior descriptions
 */
export const ENEMY_ENCYCLOPEDIA: Record<EnemyType, EnemyEncyclopediaEntry> = {
  melee: {
    id: 'melee',
    name: 'Slime',
    description: 'A basic dungeon creature that mindlessly charges at intruders.',
    behavior: 'Moves directly toward player, deals contact damage.',
    introducedChapter: 1,
    spriteKey: 'enemyMelee',
  },
  ranged: {
    id: 'ranged',
    name: 'Skeleton Archer',
    description: 'Undead marksman that fires aimed shots from a distance.',
    behavior: 'Stops to aim (shows telegraph line), then fires a single projectile.',
    introducedChapter: 1,
    spriteKey: 'enemyRanged',
  },
  spreader: {
    id: 'spreader',
    name: 'Spreader',
    description: 'Stationary enemy that creates dangerous zones with projectile patterns.',
    behavior: 'Fires 4 projectiles in cardinal directions (up, down, left, right).',
    introducedChapter: 1,
    spriteKey: 'enemySpreader',
  },
  bomber: {
    id: 'bomber',
    name: 'Bomber',
    description: 'Explosive expert that throws bombs at the player\'s position.',
    behavior: 'Maintains distance, winds up before throwing explosive bombs.',
    introducedChapter: 2,
    spriteKey: 'enemyBomber',
  },
  tank: {
    id: 'tank',
    name: 'Tank',
    description: 'Heavily armored brute with devastating area attacks.',
    behavior: 'Slow movement, high HP. Charges up an 8-way spread attack.',
    introducedChapter: 3,
    spriteKey: 'enemyTank',
  },
  charger: {
    id: 'charger',
    name: 'Charger',
    description: 'Fast predator that dashes at high speed toward its prey.',
    behavior: 'Shows direction telegraph, then charges. Stunned briefly after charging.',
    introducedChapter: 3,
    spriteKey: 'enemyCharger',
  },
  healer: {
    id: 'healer',
    name: 'Healer',
    description: 'Support enemy that restores health to nearby allies.',
    behavior: 'Weak and evasive. Heals all enemies within range. Priority target!',
    introducedChapter: 4,
    spriteKey: 'enemyHealer',
  },
  spawner: {
    id: 'spawner',
    name: 'Spawner',
    description: 'Stationary hive that continuously produces minion enemies.',
    behavior: 'Creates weak but fast minions. Destroy quickly to stop reinforcements.',
    introducedChapter: 4,
    spriteKey: 'enemySpawner',
  },
}

/**
 * Get which chapter introduces an enemy type
 */
export function getEnemyIntroChapter(enemyType: EnemyType): ChapterId {
  return ENEMY_ENCYCLOPEDIA[enemyType].introducedChapter
}

/**
 * Get all enemy entries for the encyclopedia
 */
export function getAllEnemyEntries(): EnemyEncyclopediaEntry[] {
  return Object.values(ENEMY_ENCYCLOPEDIA).sort(
    (a, b) => a.introducedChapter - b.introducedChapter
  )
}

// ============================================
// Boss Encyclopedia Data
// ============================================

export interface BossEncyclopediaEntry {
  id: BossId
  name: string
  description: string
  chapter: ChapterId
  attackPatterns: string[]
  spriteKey: string
  isMainBoss: boolean
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
      if (a.chapter !== b.chapter) return a.chapter - b.chapter
      return a.isMainBoss ? -1 : 1
    })
}

// ============================================
// Equipment Encyclopedia Data
// ============================================

export interface EquipmentEncyclopediaEntry {
  id: string
  name: string
  description: string
  slot: EquipmentSlotType
  statSummary: string
  spriteKey: string
}

/**
 * Format equipment stats into a readable summary
 */
function formatEquipmentStats(data: BaseEquipmentData): string {
  const parts: string[] = []
  const stats = data.baseStats

  if (stats.attackDamage) parts.push(`${stats.attackDamage} ATK`)
  if (stats.attackSpeedPercent) {
    const sign = stats.attackSpeedPercent > 0 ? '+' : ''
    parts.push(`${sign}${Math.round(stats.attackSpeedPercent * 100)}% Speed`)
  }
  if (stats.critChance) parts.push(`${Math.round(stats.critChance * 100)}% Crit`)
  if (stats.critDamage) parts.push(`+${Math.round(stats.critDamage * 100)}% Crit DMG`)
  if (stats.maxHealth) parts.push(`${stats.maxHealth} HP`)
  if (stats.maxHealthPercent) parts.push(`+${Math.round(stats.maxHealthPercent * 100)}% HP`)
  if (stats.damageReductionPercent) parts.push(`${Math.round(stats.damageReductionPercent * 100)}% DR`)
  if (stats.dodgeChance) {
    const cappedDodge = Math.min(stats.dodgeChance, PlayerStats.MAX_DODGE_CHANCE)
    const isCapped = stats.dodgeChance > PlayerStats.MAX_DODGE_CHANCE
    parts.push(`${Math.round(cappedDodge * 100)}% Dodge${isCapped ? ' (max)' : ''}`)
  }
  if (stats.bonusXPPercent) parts.push(`+${Math.round(stats.bonusXPPercent * 100)}% XP`)
  if (stats.goldBonusPercent) parts.push(`+${Math.round(stats.goldBonusPercent * 100)}% Gold`)
  if (stats.attackDamagePercent) parts.push(`+${Math.round(stats.attackDamagePercent * 100)}% ATK`)

  return parts.join(', ') || 'No stats'
}

/**
 * Get all equipment entries for the encyclopedia
 */
export function getAllEquipmentEntries(): EquipmentEncyclopediaEntry[] {
  const entries: EquipmentEncyclopediaEntry[] = []

  // Weapons
  for (const [type, data] of Object.entries(WEAPON_DATA)) {
    entries.push({
      id: type,
      name: data.name,
      description: data.description,
      slot: 'weapon',
      statSummary: formatEquipmentStats(data),
      spriteKey: `equip_${type}`,
    })
  }

  // Armor
  for (const [type, data] of Object.entries(ARMOR_DATA)) {
    entries.push({
      id: type,
      name: data.name,
      description: data.description,
      slot: 'armor',
      statSummary: formatEquipmentStats(data),
      spriteKey: `equip_${type}`,
    })
  }

  // Rings
  for (const [type, data] of Object.entries(RING_DATA)) {
    entries.push({
      id: type,
      name: data.name,
      description: data.description,
      slot: 'ring',
      statSummary: formatEquipmentStats(data),
      spriteKey: `equip_${type}`,
    })
  }

  // Spirits
  for (const [type, data] of Object.entries(SPIRIT_DATA)) {
    entries.push({
      id: type,
      name: data.name,
      description: data.description,
      slot: 'spirit',
      statSummary: formatEquipmentStats(data),
      spriteKey: `equip_${type}`,
    })
  }

  return entries
}

// ============================================
// Ability Encyclopedia Data
// ============================================

export interface AbilityEncyclopediaEntry {
  id: string
  name: string
  description: string
  color: number
  spriteKey: string
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
  }))
}

// ============================================
// Talent Encyclopedia Data
// ============================================

export interface TalentEncyclopediaEntry {
  id: TalentId
  name: string
  description: string
  tier: TalentTier
  tierColor: string
  maxLevel: number
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
  }))
}

// ============================================
// Hero Encyclopedia Data
// ============================================

export interface HeroEncyclopediaEntry {
  id: HeroId
  name: string
  description: string
  abilityName: string
  abilityDescription: string
  unlockCost: number
  unlockCurrency: string
  perkCount: number
  spriteKey: string
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
  }))
}

// ============================================
// Perk Encyclopedia Data
// ============================================

export interface PerkEncyclopediaEntry {
  id: PerkId
  name: string
  description: string
  rarity: Rarity
  rarityColor: string
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
  }))
}

// ============================================
// Achievement Encyclopedia Data
// ============================================

export interface AchievementEncyclopediaEntry {
  id: string
  name: string
  description: string
  tierCount: number
  tierRequirements: number[]
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
  }))
}

// ============================================
// Chest Encyclopedia Data
// ============================================

export interface ChestEncyclopediaEntry {
  id: ChestType
  name: string
  description: string
  color: string
  dropRates: Record<Rarity, number>
}

/**
 * Get all chest entries for the encyclopedia
 */
export function getAllChestEntries(): ChestEncyclopediaEntry[] {
  return CHEST_ORDER.map((chestType) => {
    const config = CHEST_CONFIGS[chestType]
    return {
      id: chestType,
      name: config.name,
      description: config.description,
      color: config.color,
      dropRates: config.dropRates,
    }
  })
}

// ============================================
// Count Helpers
// ============================================

export const ENCYCLOPEDIA_COUNTS = {
  equipment: Object.keys(WEAPON_DATA).length +
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
}
