/**
 * Equipment System - Type definitions and data models
 *
 * Defines equipment slots, rarities, weapon types, and stat interfaces.
 * Pure type definitions - no dependencies on Phaser or other game systems.
 */

// ============================================
// Equipment Slot Types
// ============================================

/**
 * Equipment slot identifiers
 */
export type EquipmentSlotType = 'weapon' | 'armor' | 'ring' | 'spirit'

/**
 * All available equipment slots
 */
export const EQUIPMENT_SLOTS: EquipmentSlotType[] = ['weapon', 'armor', 'ring', 'spirit']

// ============================================
// Rarity System
// ============================================

/**
 * Equipment rarity tiers with associated properties
 */
export enum Rarity {
  COMMON = 'common',
  GREAT = 'great',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
}

/**
 * Rarity tier order for comparisons
 */
export const RARITY_ORDER: Rarity[] = [
  Rarity.COMMON,
  Rarity.GREAT,
  Rarity.RARE,
  Rarity.EPIC,
  Rarity.LEGENDARY,
]

/**
 * Rarity configuration including visual and gameplay properties
 */
export interface RarityConfig {
  name: string
  color: string // Border/highlight color
  maxLevel: number
  perkSlots: number // Number of perks this rarity can have
  statMultiplier: number // Multiplier for base stats
  dropWeight: number // Relative drop chance (higher = more common)
}

/**
 * Configuration for each rarity tier
 */
export const RARITY_CONFIGS: Record<Rarity, RarityConfig> = {
  [Rarity.COMMON]: {
    name: 'Common',
    color: '#888888', // Gray
    maxLevel: 20,
    perkSlots: 0,
    statMultiplier: 1.0,
    dropWeight: 100,
  },
  [Rarity.GREAT]: {
    name: 'Great',
    color: '#22c55e', // Green
    maxLevel: 30,
    perkSlots: 1,
    statMultiplier: 1.2,
    dropWeight: 40,
  },
  [Rarity.RARE]: {
    name: 'Rare',
    color: '#3b82f6', // Blue
    maxLevel: 40,
    perkSlots: 2,
    statMultiplier: 1.5,
    dropWeight: 15,
  },
  [Rarity.EPIC]: {
    name: 'Epic',
    color: '#a855f7', // Purple
    maxLevel: 50,
    perkSlots: 3,
    statMultiplier: 2.0,
    dropWeight: 4,
  },
  [Rarity.LEGENDARY]: {
    name: 'Legendary',
    color: '#eab308', // Gold
    maxLevel: 70,
    perkSlots: 4,
    statMultiplier: 3.0,
    dropWeight: 1,
  },
}

// ============================================
// Weapon Types
// ============================================

/**
 * Available weapon types with distinct behaviors
 */
export enum WeaponType {
  BRAVE_BOW = 'brave_bow', // Balanced, standard projectiles
  SAW_BLADE = 'saw_blade', // Fast attack speed, -20% damage, small projectiles
  STAFF = 'staff', // Homing projectiles, slower fire rate
  DEATH_SCYTHE = 'death_scythe', // Slow, +45% damage, knockback
}

/**
 * Weapon type configuration defining behavior
 */
export interface WeaponTypeConfig {
  name: string
  description: string
  attackDamageMultiplier: number
  attackSpeedMultiplier: number
  projectileSpeedMultiplier: number
  projectileSizeMultiplier: number
  hasHoming: boolean
  hasKnockback: boolean
}

/**
 * Configuration for each weapon type
 */
export const WEAPON_TYPE_CONFIGS: Record<WeaponType, WeaponTypeConfig> = {
  [WeaponType.BRAVE_BOW]: {
    name: 'Brave Bow',
    description: 'Balanced bow with standard projectiles',
    attackDamageMultiplier: 1.0,
    attackSpeedMultiplier: 1.0,
    projectileSpeedMultiplier: 1.0,
    projectileSizeMultiplier: 1.0,
    hasHoming: false,
    hasKnockback: false,
  },
  [WeaponType.SAW_BLADE]: {
    name: 'Saw Blade',
    description: 'Fast attack speed with smaller, weaker projectiles',
    attackDamageMultiplier: 0.8, // -20% damage
    attackSpeedMultiplier: 1.4, // +40% attack speed
    projectileSpeedMultiplier: 1.2,
    projectileSizeMultiplier: 0.7, // Smaller projectiles
    hasHoming: false,
    hasKnockback: false,
  },
  [WeaponType.STAFF]: {
    name: 'Staff',
    description: 'Magical staff with homing projectiles',
    attackDamageMultiplier: 0.9,
    attackSpeedMultiplier: 0.7, // Slower fire rate
    projectileSpeedMultiplier: 0.8,
    projectileSizeMultiplier: 1.2,
    hasHoming: true,
    hasKnockback: false,
  },
  [WeaponType.DEATH_SCYTHE]: {
    name: 'Death Scythe',
    description: 'Powerful but slow weapon with knockback',
    attackDamageMultiplier: 1.45, // +45% damage
    attackSpeedMultiplier: 0.6, // Very slow
    projectileSpeedMultiplier: 0.9,
    projectileSizeMultiplier: 1.5, // Larger projectiles
    hasHoming: false,
    hasKnockback: true,
  },
}

// ============================================
// Equipment Type Definitions (per slot)
// ============================================

/**
 * Armor types
 */
export enum ArmorType {
  VEST = 'vest',
  ROBE = 'robe',
  PHANTOM_CLOAK = 'phantom_cloak',
  GOLDEN_CHESTPLATE = 'golden_chestplate',
}

/**
 * Ring types
 */
export enum RingType {
  BEAR_RING = 'bear_ring', // HP bonus
  WOLF_RING = 'wolf_ring', // Crit chance
  SERPENT_RING = 'serpent_ring', // Crit damage
  FALCON_RING = 'falcon_ring', // Dodge chance
  LION_RING = 'lion_ring', // Damage bonus
}

/**
 * Spirit (pet) types
 */
export enum SpiritType {
  BAT = 'bat', // XP bonus
  LASER_BAT = 'laser_bat', // Attacks enemies
  ELF = 'elf', // Gold bonus
  LIVING_BOMB = 'living_bomb', // AOE damage
  SCYTHE_MAGE = 'scythe_mage', // Cooldown reduction
}

/**
 * Union type for all equipment subtypes
 */
export type EquipmentType = WeaponType | ArmorType | RingType | SpiritType

// ============================================
// Stat Interfaces
// ============================================

/**
 * Stats that equipment can provide
 */
export interface EquipmentStats {
  // Weapon stats
  attackDamage?: number
  attackDamagePercent?: number // Percentage bonus
  attackSpeed?: number // Flat bonus
  attackSpeedPercent?: number // Percentage bonus
  projectileSpeed?: number
  projectileSpeedPercent?: number

  // Armor stats
  maxHealth?: number
  maxHealthPercent?: number
  damageReduction?: number // Flat damage reduction
  damageReductionPercent?: number // Percentage reduction

  // Ring stats
  critChance?: number // Absolute (e.g., 0.05 = 5%)
  critDamage?: number // Multiplier (e.g., 0.2 = +20%)
  dodgeChance?: number // Absolute (e.g., 0.1 = 10%)

  // Spirit stats
  bonusXPPercent?: number
  goldBonusPercent?: number
  abilityCooldownReduction?: number // Percentage
}

/**
 * Combined stats from all equipped items
 */
export interface CombinedEquipmentStats extends EquipmentStats {
  // Weapon behavior flags
  hasHoming?: boolean
  hasKnockback?: boolean
  weaponType?: WeaponType
}

// ============================================
// Perk System
// ============================================

/**
 * Available perk identifiers
 */
export enum PerkId {
  // Attack perks
  ATTACK_BOOST_SMALL = 'attack_boost_small',
  ATTACK_BOOST_MEDIUM = 'attack_boost_medium',
  ATTACK_BOOST_LARGE = 'attack_boost_large',
  ATTACK_SPEED_SMALL = 'attack_speed_small',
  ATTACK_SPEED_MEDIUM = 'attack_speed_medium',

  // Crit perks
  CRIT_CHANCE_SMALL = 'crit_chance_small',
  CRIT_CHANCE_MEDIUM = 'crit_chance_medium',
  CRIT_DAMAGE_SMALL = 'crit_damage_small',
  CRIT_DAMAGE_MEDIUM = 'crit_damage_medium',

  // Defense perks
  HEALTH_BOOST_SMALL = 'health_boost_small',
  HEALTH_BOOST_MEDIUM = 'health_boost_medium',
  HEALTH_BOOST_LARGE = 'health_boost_large',
  DAMAGE_REDUCTION_SMALL = 'damage_reduction_small',
  DODGE_SMALL = 'dodge_small',
  DODGE_MEDIUM = 'dodge_medium',

  // Utility perks
  XP_BOOST_SMALL = 'xp_boost_small',
  GOLD_BOOST_SMALL = 'gold_boost_small',
  COOLDOWN_REDUCTION_SMALL = 'cooldown_reduction_small',
}

/**
 * Perk definition
 */
export interface Perk {
  id: PerkId
  name: string
  description: string
  stats: EquipmentStats
  rarity: Rarity // Minimum rarity required for this perk
}

// ============================================
// Equipment Item Interface
// ============================================

/**
 * Full equipment item definition
 */
export interface Equipment {
  id: string // Unique identifier
  type: EquipmentType // Specific equipment type
  slot: EquipmentSlotType // Which slot this goes in
  rarity: Rarity
  level: number
  baseStats: EquipmentStats // Base stats before level scaling
  perks: PerkId[] // Unlocked perks
  name: string // Display name
  description: string
}

/**
 * Equipment creation options
 */
export interface CreateEquipmentOptions {
  type: EquipmentType
  slot: EquipmentSlotType
  rarity?: Rarity // Defaults to COMMON
  level?: number // Defaults to 1
  perks?: PerkId[] // Defaults to random based on rarity
}

// ============================================
// Upgrade System
// ============================================

/**
 * Upgrade cost structure
 */
export interface UpgradeCost {
  gold: number
  scrolls: number
}

/**
 * Upgrade result
 */
export interface UpgradeResult {
  success: boolean
  newLevel: number
  error?: string
}

// ============================================
// Fusion System
// ============================================

/**
 * Fusion requirements and results
 */
export interface FusionResult {
  success: boolean
  resultingItem?: Equipment
  error?: string
}

/**
 * Required items for fusion
 */
export const FUSION_REQUIREMENTS = {
  itemsRequired: 3, // 3 identical items = 1 higher tier
}

// ============================================
// Utility Functions
// ============================================

/**
 * Compare two rarities
 * Returns: negative if a < b, 0 if equal, positive if a > b
 */
export function compareRarity(a: Rarity, b: Rarity): number {
  return RARITY_ORDER.indexOf(a) - RARITY_ORDER.indexOf(b)
}

/**
 * Check if rarity a is at least rarity b
 */
export function isRarityAtLeast(a: Rarity, minimum: Rarity): boolean {
  return compareRarity(a, minimum) >= 0
}

/**
 * Get the next higher rarity tier
 * Returns null if already at max
 */
export function getNextRarity(current: Rarity): Rarity | null {
  const index = RARITY_ORDER.indexOf(current)
  if (index >= RARITY_ORDER.length - 1) return null
  return RARITY_ORDER[index + 1]
}

/**
 * Get slot type from equipment type
 */
export function getSlotForType(type: EquipmentType): EquipmentSlotType {
  if (Object.values(WeaponType).includes(type as WeaponType)) {
    return 'weapon'
  }
  if (Object.values(ArmorType).includes(type as ArmorType)) {
    return 'armor'
  }
  if (Object.values(RingType).includes(type as RingType)) {
    return 'ring'
  }
  if (Object.values(SpiritType).includes(type as SpiritType)) {
    return 'spirit'
  }
  throw new Error(`Unknown equipment type: ${type}`)
}

/**
 * Check if an equipment type matches a slot
 */
export function isTypeForSlot(type: EquipmentType, slot: EquipmentSlotType): boolean {
  return getSlotForType(type) === slot
}

/**
 * Generate a unique equipment ID
 */
export function generateEquipmentId(): string {
  return `eq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}
