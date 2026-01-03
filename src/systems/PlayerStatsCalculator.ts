import type { TalentBonuses } from '../config/talentData'
import type { DifficultyConfig } from '../config/difficulty'
import { WEAPON_TYPE_CONFIGS, type WeaponType } from './Equipment'
import type { FinalPlayerStats, HeroStats, EquipStats, WeaponProjectileConfig } from '../types/GameTypes'

export interface PlayerStatsResult {
  stats: FinalPlayerStats
  weaponProjectileConfig: WeaponProjectileConfig
}

/**
 * Calculate final player stats from hero, equipment, talents, and difficulty.
 * Extracted from GameScene to centralize stat calculation logic.
 */
export function calculatePlayerStats(
  heroStats: HeroStats,
  equipStats: EquipStats,
  talentBonuses: TalentBonuses,
  difficultyConfig: DifficultyConfig
): PlayerStatsResult {
  // Calculate weapon type multipliers (default to 1.0 if no weapon equipped)
  let weaponDamageMult = 1.0
  let weaponSpeedMult = 1.0
  let weaponProjectileConfig: WeaponProjectileConfig = {
    sprite: 'bulletSprite',
    sizeMultiplier: 1.0,
  }

  if (equipStats.weaponType && WEAPON_TYPE_CONFIGS[equipStats.weaponType as WeaponType]) {
    const weaponConfig = WEAPON_TYPE_CONFIGS[equipStats.weaponType as WeaponType]
    weaponDamageMult = weaponConfig.attackDamageMultiplier
    weaponSpeedMult = weaponConfig.attackSpeedMultiplier
    weaponProjectileConfig = {
      sprite: weaponConfig.projectileSprite,
      sizeMultiplier: weaponConfig.projectileSizeMultiplier,
    }
  }

  // Calculate equipment stat multiplier from talents (Equipment Bonus talent)
  const equipmentStatMultiplier = 1 + (talentBonuses.percentEquipmentStats / 100)

  // Calculate final stats with equipment bonuses and talent bonuses
  // Formula: (baseHeroStat + flatBonus + talentFlat) * (1 + percentBonus) * weaponMult * difficultyMult
  const baseMaxHealth = heroStats.maxHealth + (equipStats.maxHealth ?? 0) * equipmentStatMultiplier + talentBonuses.flatHp
  const finalMaxHealth = baseMaxHealth * (1 + (equipStats.maxHealthPercent ?? 0)) * (difficultyConfig.playerMaxHealth / 100)

  const baseDamage = heroStats.attack + (equipStats.attackDamage ?? 0) * equipmentStatMultiplier + talentBonuses.flatAttack
  const finalDamage = baseDamage * (1 + (equipStats.attackDamagePercent ?? 0)) * weaponDamageMult * (difficultyConfig.playerDamage / 10)

  const baseAttackSpeed = heroStats.attackSpeed + (equipStats.attackSpeed ?? 0) * equipmentStatMultiplier
  const finalAttackSpeed = baseAttackSpeed * (1 + (equipStats.attackSpeedPercent ?? 0) + talentBonuses.percentAttackSpeed / 100) * weaponSpeedMult * (difficultyConfig.playerAttackSpeed / 1.0)

  const finalCritChance = heroStats.critChance + (equipStats.critChance ?? 0) * equipmentStatMultiplier + talentBonuses.percentCritChance / 100
  const finalCritDamage = heroStats.critDamage + (equipStats.critDamage ?? 0) * equipmentStatMultiplier

  // Calculate dodge chance from equipment
  const totalDodgeChance = (equipStats.dodgeChance ?? 0) * equipmentStatMultiplier

  return {
    stats: {
      maxHealth: finalMaxHealth,
      baseDamage: finalDamage,
      baseAttackSpeed: finalAttackSpeed,
      critChance: finalCritChance,
      critDamage: finalCritDamage,
      dodgeChance: totalDodgeChance,
    },
    weaponProjectileConfig,
  }
}
