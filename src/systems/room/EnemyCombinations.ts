/**
 * Enemy Combination Patterns
 *
 * Contains predefined enemy composition patterns for tactical gameplay.
 * Each combination has synergy descriptions and room progression requirements.
 */

import { EnemyType } from "../../config/chapterData";

/**
 * Enemy combination pattern for tactical scenarios
 */
export interface EnemyCombination {
  name: string;
  description: string;
  enemies: EnemyType[];
  minRoom: number; // Minimum room number to appear
  weight: number; // Selection weight
  synergy: string; // Description of tactical synergy
}

/**
 * Predefined enemy combination patterns for tactical scenarios
 */
export const ENEMY_COMBINATIONS: EnemyCombination[] = [
  // ============================================
  // Basic combinations (Rooms 1-4)
  // ============================================
  {
    name: "Melee Rush",
    description: "Pure melee swarm - test kiting skills",
    enemies: ["melee", "melee", "melee", "melee"],
    minRoom: 1,
    weight: 1,
    synergy: "Overwhelming numbers",
  },
  {
    name: "Ranged Support",
    description: "Ranged enemies with melee protection",
    enemies: ["melee", "melee", "ranged", "ranged"],
    minRoom: 1,
    weight: 1.2,
    synergy: "Ranged pressure while melee closes distance",
  },
  {
    name: "Sniper Nest",
    description: "Multiple ranged enemies",
    enemies: ["ranged", "ranged", "ranged"],
    minRoom: 2,
    weight: 0.8,
    synergy: "Constant projectile dodging",
  },

  // ============================================
  // Mid-early combinations (Rooms 3-5)
  // ============================================
  {
    name: "Spread Formation",
    description: "Spreader with melee escorts",
    enemies: ["spreader", "melee", "melee", "ranged"],
    minRoom: 3,
    weight: 1.2,
    synergy: "Spreader forces movement, melee punishes standing still",
  },
  {
    name: "Charge Assault",
    description: "Chargers with ranged backup",
    enemies: ["charger", "charger", "ranged", "ranged"],
    minRoom: 3,
    weight: 1,
    synergy: "Must dodge charges while avoiding projectiles",
  },
  {
    name: "Blitz Squad",
    description: "Fast aggressive composition",
    enemies: ["charger", "melee", "melee", "melee"],
    minRoom: 4,
    weight: 0.9,
    synergy: "Constant pressure from all directions",
  },

  // ============================================
  // Mid-late combinations (Rooms 6-8)
  // ============================================
  {
    name: "Bomber Support",
    description: "Bombers with protection",
    enemies: ["bomber", "bomber", "melee", "melee", "ranged"],
    minRoom: 5,
    weight: 1.1,
    synergy: "AOE denial while melee closes in",
  },
  {
    name: "Healer Tank",
    description: "Tank protected by healer",
    enemies: ["tank", "healer", "melee", "melee"],
    minRoom: 6,
    weight: 1.3,
    synergy: "Kill healer first or tank becomes unkillable",
  },
  {
    name: "Double Trouble",
    description: "Two tanks with healer support",
    enemies: ["tank", "tank", "healer"],
    minRoom: 7,
    weight: 0.8,
    synergy: "Heavy pressure - must focus fire",
  },

  // ============================================
  // Late game combinations (Rooms 9+)
  // ============================================
  {
    name: "Spawner Den",
    description: "Spawner with charger protection",
    enemies: ["spawner", "charger", "charger", "ranged"],
    minRoom: 8,
    weight: 1,
    synergy: "Kill spawner fast or get overwhelmed by minions",
  },
  {
    name: "Full Support",
    description: "Healer + Spawner combo",
    enemies: ["healer", "spawner", "tank", "bomber"],
    minRoom: 9,
    weight: 0.9,
    synergy: "Priority targeting is critical",
  },
  {
    name: "Chaos Formation",
    description: "All elite enemies",
    enemies: ["tank", "charger", "bomber", "healer", "spreader"],
    minRoom: 9,
    weight: 0.7,
    synergy: "Pure chaos - every enemy type demands attention",
  },
  {
    name: "Siege Warfare",
    description: "Ranged heavy with tank",
    enemies: ["tank", "bomber", "bomber", "ranged", "ranged"],
    minRoom: 8,
    weight: 0.9,
    synergy: "Constant AOE and projectiles with tanky frontline",
  },
  {
    name: "Infinite Army",
    description: "Double spawner chaos",
    enemies: ["spawner", "spawner", "healer", "tank"],
    minRoom: 9,
    weight: 0.6,
    synergy: "Kill spawners immediately or face endless minions",
  },

  // ============================================
  // Mid-game variety combinations (Rooms 4-6)
  // ============================================
  {
    name: "Fire Support",
    description: "Bombers with ranged protection",
    enemies: ["bomber", "ranged", "ranged", "melee", "melee"],
    minRoom: 4,
    weight: 1,
    synergy: "AOE zone denial with ranged pressure",
  },
  {
    name: "Coordinated Strike",
    description: "Chargers and spreaders create chaos",
    enemies: ["charger", "charger", "spreader", "ranged"],
    minRoom: 5,
    weight: 0.9,
    synergy: "Forced movement into spread patterns",
  },
  {
    name: "Guardian Formation",
    description: "Healer with protected escorts",
    enemies: ["healer", "melee", "melee", "melee", "ranged"],
    minRoom: 6,
    weight: 1.1,
    synergy: "Focus the healer while melee swarms",
  },

  // ============================================
  // Heavy and elite combinations (Rooms 7+)
  // ============================================
  {
    name: "Heavy Hitters",
    description: "Tank duo with charger support",
    enemies: ["tank", "tank", "charger", "charger"],
    minRoom: 7,
    weight: 0.9,
    synergy: "Slow but deadly frontline with fast flankers",
  },
  {
    name: "Artillery Line",
    description: "Multiple bombers with tank frontline",
    enemies: ["tank", "bomber", "bomber", "bomber"],
    minRoom: 7,
    weight: 0.8,
    synergy: "Constant AOE bombardment behind tank shield",
  },
  {
    name: "Elite Guard",
    description: "Ultimate enemy formation",
    enemies: ["tank", "healer", "spawner", "bomber", "charger", "spreader"],
    minRoom: 10,
    weight: 0.5,
    synergy: "Every enemy type that demands priority - extreme danger",
  },
];
