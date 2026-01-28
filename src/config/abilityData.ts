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
  weight?: number; // Selection weight (default 100). Higher = more common, lower = rarer
}

/** Default weight for abilities (used when weight is not specified) */
export const DEFAULT_ABILITY_WEIGHT = 100;

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
    description: "-10% attack speed",
    color: 0xff6644,
    iconKey: "abilityMultishot",
    weight: 75, // Uncommon
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
    weight: 75, // Uncommon
  },
  {
    id: "ricochet",
    name: "Ricochet",
    description: "Bounce 3x",
    color: 0x88ff88,
    iconKey: "abilityRicochet",
    weight: 75, // Uncommon
  },
  {
    id: "fire_damage",
    name: "Fire",
    description: "18% DOT, spreads on death",
    color: 0xff6600,
    iconKey: "abilityFireDamage",
    weight: 75, // Uncommon
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
    weight: 75, // Uncommon
  },
  {
    id: "poison_shot",
    name: "Poison",
    description: "10% DOT, stacks 5x",
    color: 0x66ff66,
    iconKey: "abilityPoisonShot",
    weight: 75, // Uncommon
  },
  {
    id: "lightning_chain",
    name: "Lightning",
    description: "Chain +2, -20% dmg/chain",
    color: 0x9966ff,
    iconKey: "abilityLightningChain",
    weight: 50, // Rare
  },
  {
    id: "diagonal_arrows",
    name: "Diagonal Arrows",
    description: "+2 arrows at 30°",
    color: 0xff9966,
    iconKey: "abilityDiagonalArrows",
    weight: 50, // Rare
  },
  {
    id: "bloodthirst",
    name: "Bloodthirst",
    description: "+1% max HP per kill",
    color: 0xff3333,
    iconKey: "abilityBloodthirst",
    maxLevel: 5,
    weight: 50, // Rare
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
    weight: 50, // Rare
  },
  // Devil abilities (powerful but with HP cost or risk)
  {
    id: "extra_life",
    name: "Extra Life",
    description: "Revive once at 30% HP",
    color: 0xff3366,
    iconKey: "abilityExtraLife",
    maxLevel: 1, // Can only have 1 extra life at a time
    weight: 10, // Legendary
  },
  {
    id: "through_wall",
    name: "Through Wall",
    description: "Arrows pass through walls",
    color: 0x9933ff,
    iconKey: "abilityThroughWall",
    maxLevel: 1, // Non-stacking ability
    weight: 10, // Legendary
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
    weight: 50, // Rare
  },
  // New orbital and effect abilities
  {
    id: "rotating_orbs",
    name: "Rotating Orbs",
    description: "+1 orb orbits player",
    color: 0xff8800,
    iconKey: "abilityRotatingOrbs",
    maxLevel: 5,
    weight: 25, // Epic
  },
  {
    id: "orbital_shields",
    name: "Orbital Shields",
    description: "+1 shield blocks bullets",
    color: 0x00aaff,
    iconKey: "abilityOrbitalShields",
    maxLevel: 3,
    weight: 25, // Epic
  },
  {
    id: "spirit_pets",
    name: "Spirit Pets",
    description: "+1 homing wisp",
    color: 0xaa66ff,
    iconKey: "abilitySpiritPets",
    maxLevel: 5,
    weight: 25, // Epic
  },
  {
    id: "death_nova",
    name: "Death Nova",
    description: "AOE on enemy kill",
    color: 0x660066,
    iconKey: "abilityDeathNova",
    maxLevel: 3,
    weight: 25, // Epic
  },
  {
    id: "homing_arrows",
    name: "Homing Arrows",
    description: "Bullets track enemies",
    color: 0x00ff88,
    iconKey: "abilityHomingArrows",
    maxLevel: 3,
    weight: 25, // Epic
  },
  {
    id: "explosive_arrows",
    name: "Explosive Arrows",
    description: "AOE on bullet impact",
    color: 0xff4400,
    iconKey: "abilityExplosiveArrows",
    maxLevel: 3,
    weight: 25, // Epic
  },
  {
    id: "shield_barrier",
    name: "Shield Barrier",
    description: "Absorbs damage",
    color: 0x4488ff,
    iconKey: "abilityShieldBarrier",
    maxLevel: 3,
    weight: 25, // Epic
  },
  {
    id: "knockback",
    name: "Knockback",
    description: "Push enemies on hit",
    color: 0x888888,
    iconKey: "abilityKnockback",
    maxLevel: 3,
    weight: 50, // Rare
  },
  // Game Modifier Abilities (Risk/Reward)
  {
    id: "ascetic",
    name: "Ascetic",
    description: "No healing, +200% XP gain",
    color: 0xff0066,
    iconKey: "abilityAscetic",
    maxLevel: 1,
    weight: 10, // Legendary
  },
  {
    id: "horde_magnet",
    name: "Horde Magnet",
    description: "+50% enemies, +100% XP gain",
    color: 0xcc3300,
    iconKey: "abilityHordeMagnet",
    // No maxLevel - can stack infinitely for extreme challenge
    weight: 10, // Legendary
  },
  // Movement Abilities
  {
    id: "mobile_fire",
    name: "Mobile Fire",
    description: "Shoot while moving",
    color: 0x33ccff,
    iconKey: "abilityMobileFire",
    maxLevel: 3, // L1: 33%, L2: 67%, L3: 100% attack speed while moving
    weight: 10, // Legendary
  },
];

/**
 * Get ability data by ID
 */
export function getAbilityById(abilityId: string): AbilityData | undefined {
  return ABILITIES.find((a) => a.id === abilityId);
}

/**
 * Get the weight of an ability (uses default if not specified)
 */
export function getAbilityWeight(ability: AbilityData): number {
  return ability.weight ?? DEFAULT_ABILITY_WEIGHT;
}

/**
 * Select random abilities using weighted selection
 * Higher weight = more likely to be selected
 *
 * @param abilities - Array of abilities to select from
 * @param count - Number of abilities to select
 * @param randomFn - Random function (0-1), defaults to Math.random
 * @returns Array of selected abilities (no duplicates)
 */
export function selectWeightedAbilities(
  abilities: AbilityData[],
  count: number,
  randomFn: () => number = Math.random,
): AbilityData[] {
  if (abilities.length === 0) return [];
  if (abilities.length <= count) return [...abilities];

  const selected: AbilityData[] = [];
  const remaining = [...abilities];

  while (selected.length < count && remaining.length > 0) {
    // Calculate total weight of remaining abilities
    const totalWeight = remaining.reduce((sum, a) => sum + getAbilityWeight(a), 0);

    // Pick a random point in the total weight
    let randomPoint = randomFn() * totalWeight;

    // Find the ability at that point
    let selectedIndex = 0;
    for (let i = 0; i < remaining.length; i++) {
      randomPoint -= getAbilityWeight(remaining[i]);
      if (randomPoint <= 0) {
        selectedIndex = i;
        break;
      }
    }

    // Add to selected and remove from remaining
    selected.push(remaining[selectedIndex]);
    remaining.splice(selectedIndex, 1);
  }

  return selected;
}
