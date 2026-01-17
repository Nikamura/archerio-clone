import type { DifficultyConfig } from "../config/difficulty";
import type { TalentBonuses } from "../config/talentData";
import { WEAPON_TYPE_CONFIGS, WeaponType } from "./Equipment";

/**
 * Weapon multipliers for damage and attack speed
 */
export interface WeaponMultipliers {
  damageMultiplier: number;
  speedMultiplier: number;
}

/**
 * Projectile configuration based on equipped weapon
 */
export interface ProjectileConfig {
  sprite: string;
  sizeMultiplier: number;
}

/**
 * Hero base stats
 */
export interface HeroStats {
  maxHealth: number;
  attack: number;
  attackSpeed: number;
  critChance: number;
  critDamage: number;
}

/**
 * Equipment stats with all possible bonuses
 */
export interface EquipmentStats {
  maxHealth?: number;
  maxHealthPercent?: number;
  attackDamage?: number;
  attackDamagePercent?: number;
  attackSpeed?: number;
  attackSpeedPercent?: number;
  critChance?: number;
  critDamage?: number;
  dodgeChance?: number;
  bonusXPPercent?: number;
  goldBonusPercent?: number;
  weaponType?: string;
}

/**
 * Final calculated player stats for use in Player creation
 */
export interface CalculatedPlayerStats {
  maxHealth: number;
  baseDamage: number;
  baseAttackSpeed: number;
  critChance: number;
  critDamage: number;
  dodgeChance: number;
  bonusXPMultiplier: number;
  goldBonusMultiplier: number;
}

/**
 * Check if a string is a valid WeaponType
 */
function isWeaponType(value: string): value is WeaponType {
  return Object.values(WeaponType).includes(value as WeaponType);
}

/**
 * Get weapon multipliers for damage and attack speed
 * Returns default 1.0 multipliers if no weapon equipped
 */
export function getWeaponMultipliers(weaponType: string | undefined): WeaponMultipliers {
  if (weaponType && isWeaponType(weaponType)) {
    const weaponConfig = WEAPON_TYPE_CONFIGS[weaponType];
    return {
      damageMultiplier: weaponConfig.attackDamageMultiplier,
      speedMultiplier: weaponConfig.attackSpeedMultiplier,
    };
  }
  return {
    damageMultiplier: 1.0,
    speedMultiplier: 1.0,
  };
}

/**
 * Get projectile configuration based on equipped weapon
 * Returns default bullet sprite if no weapon equipped
 */
export function getWeaponProjectileConfig(weaponType: string | undefined): ProjectileConfig {
  if (weaponType && isWeaponType(weaponType)) {
    const weaponConfig = WEAPON_TYPE_CONFIGS[weaponType];
    return {
      sprite: weaponConfig.projectileSprite,
      sizeMultiplier: weaponConfig.projectileSizeMultiplier,
    };
  }
  return {
    sprite: "bulletSprite",
    sizeMultiplier: 1.0,
  };
}

/**
 * Calculate final player stats from hero base stats, equipment, talents, and difficulty
 *
 * Formula: (baseHeroStat + flatBonus + talentFlat) * (1 + percentBonus) * weaponMult * difficultyMult
 */
export function calculatePlayerStats(
  heroStats: HeroStats,
  equipStats: EquipmentStats,
  talentBonuses: TalentBonuses,
  weaponMultipliers: WeaponMultipliers,
  difficultyConfig: DifficultyConfig,
): CalculatedPlayerStats {
  // Calculate equipment stat multiplier from talents (Equipment Bonus talent)
  const equipmentStatMultiplier = 1 + talentBonuses.percentEquipmentStats / 100;

  // Calculate max health
  const baseMaxHealth =
    heroStats.maxHealth +
    (equipStats.maxHealth ?? 0) * equipmentStatMultiplier +
    talentBonuses.flatHp;
  const finalMaxHealth =
    baseMaxHealth *
    (1 + (equipStats.maxHealthPercent ?? 0)) *
    (difficultyConfig.playerMaxHealth / 100);

  // Calculate damage
  const baseDamage =
    heroStats.attack +
    (equipStats.attackDamage ?? 0) * equipmentStatMultiplier +
    talentBonuses.flatAttack;
  const finalDamage =
    baseDamage *
    (1 + (equipStats.attackDamagePercent ?? 0)) *
    weaponMultipliers.damageMultiplier *
    (difficultyConfig.playerDamage / 10);

  // Calculate attack speed
  const baseAttackSpeed =
    heroStats.attackSpeed + (equipStats.attackSpeed ?? 0) * equipmentStatMultiplier;
  const finalAttackSpeed =
    baseAttackSpeed *
    (1 + (equipStats.attackSpeedPercent ?? 0) + talentBonuses.percentAttackSpeed / 100) *
    weaponMultipliers.speedMultiplier *
    (difficultyConfig.playerAttackSpeed / 1.0);

  // Calculate crit stats
  const finalCritChance =
    heroStats.critChance +
    (equipStats.critChance ?? 0) * equipmentStatMultiplier +
    talentBonuses.percentCritChance / 100;
  const finalCritDamage =
    heroStats.critDamage + (equipStats.critDamage ?? 0) * equipmentStatMultiplier;

  // Calculate dodge chance
  const totalDodgeChance = (equipStats.dodgeChance ?? 0) * equipmentStatMultiplier;

  // Calculate equipment bonus multipliers for XP and gold
  const bonusXPMultiplier = 1 + (equipStats.bonusXPPercent ?? 0);
  const goldBonusMultiplier = 1 + (equipStats.goldBonusPercent ?? 0);

  return {
    maxHealth: finalMaxHealth,
    baseDamage: finalDamage,
    baseAttackSpeed: finalAttackSpeed,
    critChance: finalCritChance,
    critDamage: finalCritDamage,
    dodgeChance: totalDodgeChance,
    bonusXPMultiplier,
    goldBonusMultiplier,
  };
}
