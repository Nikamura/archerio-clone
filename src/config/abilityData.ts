/**
 * Ability data definitions for the game.
 * Extracted to a separate config file to avoid circular dependencies.
 */

export interface AbilityData {
  id: string
  name: string
  description: string
  color: number
  iconKey: string
  maxLevel?: number // Maximum level for this ability (undefined = unlimited stacking)
}

export const ABILITIES: AbilityData[] = [
  // Original 8 abilities
  {
    id: 'front_arrow',
    name: 'Front Arrow +1',
    description: '-25% damage',
    color: 0x44aaff,
    iconKey: 'abilityFrontArrow',
  },
  {
    id: 'multishot',
    name: 'Multishot',
    description: '-15% attack speed',
    color: 0xff6644,
    iconKey: 'abilityMultishot',
  },
  {
    id: 'attack_speed',
    name: 'Attack Speed',
    description: '+25% speed',
    color: 0xffdd00,
    iconKey: 'abilityAttackSpeed',
  },
  {
    id: 'attack_boost',
    name: 'Attack Boost',
    description: '+30% damage',
    color: 0xff4488,
    iconKey: 'abilityAttackBoost',
  },
  {
    id: 'piercing',
    name: 'Piercing',
    description: 'Pass through enemies',
    color: 0x00ffaa,
    iconKey: 'abilityPiercing',
  },
  {
    id: 'ricochet',
    name: 'Ricochet',
    description: 'Bounce 3x',
    color: 0x88ff88,
    iconKey: 'abilityRicochet',
  },
  {
    id: 'fire_damage',
    name: 'Fire',
    description: '18% DOT, spreads on death',
    color: 0xff6600,
    iconKey: 'abilityFireDamage',
  },
  {
    id: 'crit_boost',
    name: 'Critical',
    description: '+10% crit, +40% dmg',
    color: 0xffff00,
    iconKey: 'abilityCrit',
  },
  // New 8 abilities for V1
  {
    id: 'ice_shot',
    name: 'Ice Shot',
    description: '15% freeze, +50% dmg frozen',
    color: 0x66ccff,
    iconKey: 'abilityIceShot',
  },
  {
    id: 'poison_shot',
    name: 'Poison',
    description: '5% DOT, stacks 5x',
    color: 0x66ff66,
    iconKey: 'abilityPoisonShot',
  },
  {
    id: 'lightning_chain',
    name: 'Lightning',
    description: 'Chain to 2 enemies',
    color: 0x9966ff,
    iconKey: 'abilityLightningChain',
  },
  {
    id: 'diagonal_arrows',
    name: 'Diagonal Arrows',
    description: '+2 arrows at 30°',
    color: 0xff9966,
    iconKey: 'abilityDiagonalArrows',
  },
  {
    id: 'rear_arrow',
    name: 'Rear Arrow',
    description: '+1 backwards',
    color: 0x6699ff,
    iconKey: 'abilityRearArrow',
  },
  {
    id: 'damage_aura',
    name: 'Damage Aura',
    description: '10 DPS in 80px radius',
    color: 0xff6666,
    iconKey: 'abilityDamageAura',
  },
  {
    id: 'bloodthirst',
    name: 'Bloodthirst',
    description: '+1% max HP per kill',
    color: 0xff3333,
    iconKey: 'abilityBloodthirst',
    maxLevel: 5, // Caps at 5% max HP per kill
  },
  {
    id: 'rage',
    name: 'Rage',
    description: '+5% dmg per 10% HP lost',
    color: 0xcc0000,
    iconKey: 'abilityRage',
  },
  {
    id: 'speed_boost',
    name: 'Speed Boost',
    description: '+15% movement speed',
    color: 0x00ffff,
    iconKey: 'abilitySpeedBoost',
  },
  {
    id: 'max_health',
    name: 'Vitality',
    description: '+10% max HP',
    color: 0x22cc66,
    iconKey: 'abilityMaxHealth',
  },
  {
    id: 'bouncy_wall',
    name: 'Bouncy Wall',
    description: '+2 wall bounces',
    color: 0x88ccff,
    iconKey: 'abilityBouncyWall',
  },
  {
    id: 'dodge_master',
    name: 'Dodge Master',
    description: '+1% dodge chance',
    color: 0xaaaaff,
    iconKey: 'abilityDodgeMaster',
  },
  // Devil abilities (powerful but with HP cost or risk)
  {
    id: 'extra_life',
    name: 'Extra Life',
    description: 'Revive once at 30% HP',
    color: 0xff3366,
    iconKey: 'abilityExtraLife',
    maxLevel: 1, // Can only have 1 extra life at a time
  },
  {
    id: 'through_wall',
    name: 'Through Wall',
    description: 'Arrows pass through walls',
    color: 0x9933ff,
    iconKey: 'abilityThroughWall',
    maxLevel: 1, // Non-stacking ability
  },
  {
    id: 'giant',
    name: 'Giant',
    description: '+40% damage, larger hitbox',
    color: 0xcc3300,
    iconKey: 'abilityGiant',
  },
  // Orbital abilities
  {
    id: 'chainsaw_orbit',
    name: 'Chainsaw Orbit',
    description: 'Spinning saw deals damage',
    color: 0xcc4400,
    iconKey: 'abilityChainsawOrbit',
  },
  // Note: Shatter and Fire Spread are now passive effects:
  // - Ice Shot: Frozen enemies take +50% damage (shatter is built-in)
  // - Fire Damage: Burning enemies spread fire on death (fire spread is built-in)
  {
    id: 'bleed',
    name: 'Bleed',
    description: '10% DOT, 2x if moving',
    color: 0xcc0000,
    iconKey: 'abilityBleed',
  },
]

/**
 * Get ability data by ID
 */
export function getAbilityById(abilityId: string): AbilityData | undefined {
  return ABILITIES.find((a) => a.id === abilityId)
}
