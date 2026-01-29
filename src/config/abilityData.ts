/**
 * Ability data definitions for the game.
 * Extracted to a separate config file to avoid circular dependencies.
 */

export interface AbilityData {
  id: string;
  name: string;
  description: string;
  color: number;
  iconKey: string;
  maxLevel?: number; // Maximum level for this ability (undefined = unlimited stacking)
}

export const ABILITIES: AbilityData[] = [
  // Original 8 abilities
  {
    id: "front_arrow",
    name: "Front Arrow +1",
    description: "+1 arrow",
    color: 0x44aaff,
    iconKey: "abilityFrontArrow",
  },
  {
    id: "multishot",
    name: "Multishot",
    description: "+2 side arrows",
    color: 0xff6644,
    iconKey: "abilityMultishot",
  },
  {
    id: "attack_speed",
    name: "Attack Speed",
    description: "+25% speed",
    color: 0xffdd00,
    iconKey: "abilityAttackSpeed",
  },
  {
    id: "attack_boost",
    name: "Attack Boost",
    description: "+30% damage",
    color: 0xff4488,
    iconKey: "abilityAttackBoost",
  },
  {
    id: "piercing",
    name: "Piercing",
    description: "Pass through enemies",
    color: 0x00ffaa,
    iconKey: "abilityPiercing",
  },
  {
    id: "ricochet",
    name: "Ricochet",
    description: "Bounce 3x",
    color: 0x88ff88,
    iconKey: "abilityRicochet",
  },
  {
    id: "fire_damage",
    name: "Fire",
    description: "18% DOT, spreads on death",
    color: 0xff6600,
    iconKey: "abilityFireDamage",
  },
  {
    id: "crit_boost",
    name: "Critical",
    description: "+10% crit, +40% dmg",
    color: 0xffff00,
    iconKey: "abilityCrit",
  },
  // New 8 abilities for V1
  {
    id: "ice_shot",
    name: "Ice Shot",
    description: "15% freeze, +50% dmg frozen",
    color: 0x66ccff,
    iconKey: "abilityIceShot",
  },
  {
    id: "poison_shot",
    name: "Poison",
    description: "10% DOT, stacks 5x",
    color: 0x66ff66,
    iconKey: "abilityPoisonShot",
  },
  {
    id: "lightning_chain",
    name: "Lightning",
    description: "Chain +2, -20% dmg/chain",
    color: 0x9966ff,
    iconKey: "abilityLightningChain",
  },
  {
    id: "diagonal_arrows",
    name: "Diagonal Arrows",
    description: "+2 arrows at 30°",
    color: 0xff9966,
    iconKey: "abilityDiagonalArrows",
  },
  {
    id: "bloodthirst",
    name: "Bloodthirst",
    description: "+1% max HP per kill",
    color: 0xff3333,
    iconKey: "abilityBloodthirst",
    maxLevel: 5,
  },
  {
    id: "speed_boost",
    name: "Speed Boost",
    description: "+15% move, +5% attack speed",
    color: 0x00ffff,
    iconKey: "abilitySpeedBoost",
  },
  {
    id: "max_health",
    name: "Vitality",
    description: "+15% max HP",
    color: 0x22cc66,
    iconKey: "abilityMaxHealth",
  },
  {
    id: "dodge_master",
    name: "Dodge Master",
    description: "+3% dodge chance",
    color: 0xaaaaff,
    iconKey: "abilityDodgeMaster",
    maxLevel: 5, // 3% × 5 = 15% cap
  },
  // Devil abilities (powerful but with HP cost or risk)
  {
    id: "extra_life",
    name: "Extra Life",
    description: "Revive once at 30% HP",
    color: 0xff3366,
    iconKey: "abilityExtraLife",
    maxLevel: 1, // Can only have 1 extra life at a time
  },
  {
    id: "through_wall",
    name: "Through Wall",
    description: "Arrows pass through walls",
    color: 0x9933ff,
    iconKey: "abilityThroughWall",
    maxLevel: 1, // Non-stacking ability
  },
  // Note: Shatter and Fire Spread are now passive effects:
  // - Ice Shot: Frozen enemies take +50% damage (shatter is built-in)
  // - Fire Damage: Burning enemies spread fire on death (fire spread is built-in)
  {
    id: "bleed",
    name: "Bleed",
    description: "10% DOT, 2x if moving",
    color: 0xcc0000,
    iconKey: "abilityBleed",
  },
  // New orbital and effect abilities
  {
    id: "rotating_orbs",
    name: "Rotating Orbs",
    description: "+1 orb orbits player",
    color: 0xff8800,
    iconKey: "abilityRotatingOrbs",
    maxLevel: 5,
  },
  {
    id: "orbital_shields",
    name: "Orbital Shields",
    description: "+1 shield blocks bullets",
    color: 0x00aaff,
    iconKey: "abilityOrbitalShields",
    maxLevel: 3,
  },
  {
    id: "spirit_pets",
    name: "Spirit Pets",
    description: "+1 homing wisp",
    color: 0xaa66ff,
    iconKey: "abilitySpiritPets",
    maxLevel: 5,
  },
  {
    id: "death_nova",
    name: "Death Nova",
    description: "AOE on enemy kill",
    color: 0x660066,
    iconKey: "abilityDeathNova",
    maxLevel: 3,
  },
  {
    id: "homing_arrows",
    name: "Homing Arrows",
    description: "Bullets track enemies",
    color: 0x00ff88,
    iconKey: "abilityHomingArrows",
    maxLevel: 3,
  },
  {
    id: "explosive_arrows",
    name: "Explosive Arrows",
    description: "AOE on bullet impact",
    color: 0xff4400,
    iconKey: "abilityExplosiveArrows",
    maxLevel: 3,
  },
  {
    id: "shield_barrier",
    name: "Shield Barrier",
    description: "Absorbs damage",
    color: 0x4488ff,
    iconKey: "abilityShieldBarrier",
    maxLevel: 3,
  },
  {
    id: "knockback",
    name: "Knockback",
    description: "Push enemies on hit",
    color: 0x888888,
    iconKey: "abilityKnockback",
    maxLevel: 3,
  },
  // Game Modifier Abilities (Risk/Reward)
  {
    id: "ascetic",
    name: "Ascetic",
    description: "No healing, +200% XP gain",
    color: 0xff0066,
    iconKey: "abilityAscetic",
    maxLevel: 1,
  },
  {
    id: "horde_magnet",
    name: "Horde Magnet",
    description: "+50% enemies, +100% XP gain",
    color: 0xcc3300,
    iconKey: "abilityHordeMagnet",
    // No maxLevel - can stack infinitely for extreme challenge
  },
  // Movement Abilities
  {
    id: "mobile_fire",
    name: "Mobile Fire",
    description: "Shoot while moving",
    color: 0x33ccff,
    iconKey: "abilityMobileFire",
    maxLevel: 3, // L1: 33%, L2: 67%, L3: 100% attack speed while moving
  },
  // Glass Cannon Ability (Risk/Reward)
  {
    id: "glass_cannon",
    name: "Glass Cannon",
    description: "Cap base HP at 100, +100% dmg/speed, +10% crit",
    color: 0xff00ff,
    iconKey: "abilityGlassCannon",
    maxLevel: 1, // Non-stacking ability
  },
];

/**
 * Get ability data by ID
 */
export function getAbilityById(abilityId: string): AbilityData | undefined {
  return ABILITIES.find((a) => a.id === abilityId);
}
