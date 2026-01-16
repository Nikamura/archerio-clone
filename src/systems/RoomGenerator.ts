/**
 * RoomGenerator - Procedural room generation system
 *
 * Features:
 * - 15+ room layout templates per chapter
 * - Enemy combination patterns for tactical scenarios
 * - Dynamic spawn positioning based on player location
 * - Room variation types (open arenas, narrow corridors, maze sections)
 * - Safe zones and obstacle awareness
 */

import {
  ChapterId,
  EnemyType,
  getChapterDefinition,
  getRoomTypeForNumber,
  RoomType,
  getEnemySpawnWeight,
} from "../config/chapterData";
import { SeededRandom } from "./SeededRandom";

// Re-export types and layouts from extracted modules
export {
  type RoomLayoutType,
  type SpawnZone,
  type SafeZone,
  type WallConfig,
  type RoomLayout,
  ROOM_LAYOUTS,
  CHOKEPOINT_LAYOUTS,
  BOSS_LAYOUTS,
  MINI_BOSS_LAYOUTS,
} from "./room/RoomLayouts";

export { type EnemyCombination, ENEMY_COMBINATIONS } from "./room/EnemyCombinations";

// Import for local use
import {
  type RoomLayout,
  type RoomLayoutType,
  type SpawnZone,
  ROOM_LAYOUTS,
  CHOKEPOINT_LAYOUTS,
  BOSS_LAYOUTS,
  MINI_BOSS_LAYOUTS,
} from "./room/RoomLayouts";

import { type EnemyCombination, ENEMY_COMBINATIONS } from "./room/EnemyCombinations";

/**
 * Spawn position result
 */
export interface SpawnPosition {
  x: number;
  y: number;
  enemyType: EnemyType;
}

/**
 * Room generation result
 */
export interface GeneratedRoom {
  layout: RoomLayout;
  enemySpawns: SpawnPosition[];
  combination: EnemyCombination | null;
}

// ============================================
// RoomGenerator Class
// ============================================

export class RoomGenerator {
  private screenWidth: number;
  private screenHeight: number;
  private margin: number = 50; // Margin from screen edges
  private rng: SeededRandom = new SeededRandom(); // Default random seed

  constructor(screenWidth: number, screenHeight: number) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
  }

  /**
   * Set the random number generator for deterministic room generation
   * Call this before generateRoom() to use a specific seed
   */
  setRng(rng: SeededRandom): void {
    this.rng = rng;
  }

  /**
   * Get the current RNG seed string (for display)
   */
  getSeedString(): string {
    return this.rng.getSeedString();
  }

  /**
   * Update screen dimensions (if they change)
   */
  setDimensions(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
  }

  /**
   * Generate a room for the given chapter and room number
   */
  generateRoom(
    chapterId: ChapterId,
    roomNumber: number,
    playerX: number,
    playerY: number,
    baseEnemyCount: number,
    extraEnemiesPerRoom: number = 0,
  ): GeneratedRoom {
    const roomType = getRoomTypeForNumber(roomNumber);

    // Select layout based on room type
    const layout = this.selectLayout(roomType);

    // Calculate total enemies (doubled for higher difficulty)
    const roomScaling = Math.floor(roomNumber / 5);
    const totalEnemies = (baseEnemyCount + extraEnemiesPerRoom + roomScaling) * 2;

    // Get chapter enemy pool
    const chapterDef = getChapterDefinition(chapterId);
    const enemyPool = chapterDef.enemyTypes;

    // Select enemy combination or generate random composition
    const combination = this.selectCombination(chapterId, roomNumber, enemyPool);

    // Generate enemy types based on combination or random selection
    const enemyTypes = this.generateEnemyTypes(
      totalEnemies,
      roomNumber,
      enemyPool,
      combination,
      chapterId,
    );

    // Generate spawn positions
    const enemySpawns = this.generateSpawnPositions(layout, enemyTypes, playerX, playerY);

    return {
      layout,
      enemySpawns,
      combination,
    };
  }

  /**
   * Select appropriate layout for room type
   * Combat rooms have 70% chance to use chokepoint layouts with walls
   */
  private selectLayout(roomType: RoomType): RoomLayout {
    switch (roomType) {
      case "boss":
        return BOSS_LAYOUTS[0];
      case "miniboss":
        return MINI_BOSS_LAYOUTS[0];
      case "angel":
        // Angel rooms don't need enemies, return empty layout
        return ROOM_LAYOUTS[0];
      case "combat":
      default: {
        // 70% chance to use chokepoint layouts (wall-heavy)
        // 30% chance to use standard layouts (mixed open/wall)
        if (this.rng.random() < 0.7) {
          const index = Math.floor(this.rng.random() * CHOKEPOINT_LAYOUTS.length);
          return CHOKEPOINT_LAYOUTS[index];
        } else {
          const index = Math.floor(this.rng.random() * ROOM_LAYOUTS.length);
          return ROOM_LAYOUTS[index];
        }
      }
    }
  }

  /**
   * Get available combinations for a specific chapter
   * Filters by chapter-specific combo names and room requirements
   */
  private getAvailableCombinationsForChapter(
    roomNumber: number,
    allowedComboNames: string[],
  ): EnemyCombination[] {
    return ENEMY_COMBINATIONS.filter((combo) => {
      // Must be in the allowed list for this chapter
      if (!allowedComboNames.includes(combo.name)) return false;
      // Must meet room progression requirement
      if (combo.minRoom > roomNumber) return false;
      return true;
    });
  }

  /**
   * Select an enemy combination based on room number and chapter
   */
  private selectCombination(
    chapterId: ChapterId,
    roomNumber: number,
    enemyPool: EnemyType[],
  ): EnemyCombination | null {
    // 60% chance to use a predefined combination (seeded)
    if (this.rng.random() > 0.6) {
      return null;
    }

    // Get chapter definition and allowed combo names
    const chapterDef = getChapterDefinition(chapterId);
    const allowedComboNames = chapterDef.tacticComboNames;

    // Get chapter-specific available combos
    const availableCombos = this.getAvailableCombinationsForChapter(roomNumber, allowedComboNames);

    // Also verify all enemies in combo are available in chapter pool
    const validCombos = availableCombos.filter((combo) =>
      combo.enemies.every((enemy) => enemyPool.includes(enemy)),
    );

    if (validCombos.length === 0) {
      return null;
    }

    // Weighted random selection (seeded)
    const totalWeight = validCombos.reduce((sum, c) => sum + c.weight, 0);
    let random = this.rng.random() * totalWeight;

    for (const combo of validCombos) {
      random -= combo.weight;
      if (random <= 0) {
        return combo;
      }
    }

    return validCombos[validCombos.length - 1];
  }

  /**
   * Generate enemy types based on combination or random selection
   */
  private generateEnemyTypes(
    count: number,
    roomNumber: number,
    enemyPool: EnemyType[],
    combination: EnemyCombination | null,
    chapterId: ChapterId,
  ): EnemyType[] {
    const enemies: EnemyType[] = [];

    // If using a combination, start with those enemies
    if (combination) {
      enemies.push(...combination.enemies);
    }

    // Fill remaining slots with random enemies from pool
    while (enemies.length < count) {
      const enemy = this.selectRandomEnemy(roomNumber, enemyPool, chapterId);
      enemies.push(enemy);
    }

    // Trim if we have too many
    while (enemies.length > count) {
      enemies.pop();
    }

    return enemies;
  }

  /**
   * Select a random enemy based on room progression, pool, and chapter-specific weights
   */
  private selectRandomEnemy(
    roomNumber: number,
    pool: EnemyType[],
    chapterId: ChapterId,
  ): EnemyType {
    // Base weights based on room number progression
    // Earlier rooms favor basic enemies, later rooms have more variety
    const baseWeights: Record<EnemyType, number> = {
      melee: roomNumber < 5 ? 2 : 1,
      ranged: roomNumber < 5 ? 2 : 1,
      spreader: roomNumber >= 3 ? 1.5 : 0.5,
      charger: roomNumber >= 3 ? 1.2 : 0.3,
      bomber: roomNumber >= 5 ? 1.2 : 0.2,
      tank: roomNumber >= 7 ? 1 : 0.1,
      healer: roomNumber >= 6 ? 1.2 : 0.1,
      spawner: roomNumber >= 8 ? 0.8 : 0,
    };

    // Apply chapter-specific spawn weight multipliers
    const finalWeights: Record<EnemyType, number> = {} as Record<EnemyType, number>;
    for (const enemyType of pool) {
      const chapterSpawnWeight = getEnemySpawnWeight(chapterId, enemyType);
      finalWeights[enemyType] = baseWeights[enemyType] * chapterSpawnWeight;
    }

    // Filter pool and calculate total weight
    const availableEnemies = pool.filter((e) => finalWeights[e] > 0);
    const totalWeight = availableEnemies.reduce((sum, e) => sum + finalWeights[e], 0);

    if (totalWeight === 0 || availableEnemies.length === 0) {
      return "melee"; // Fallback
    }

    // Weighted random selection (seeded)
    let random = this.rng.random() * totalWeight;
    for (const enemy of availableEnemies) {
      random -= finalWeights[enemy];
      if (random <= 0) {
        return enemy;
      }
    }

    return availableEnemies[availableEnemies.length - 1];
  }

  /**
   * Generate spawn positions based on layout and player position
   */
  private generateSpawnPositions(
    layout: RoomLayout,
    enemyTypes: EnemyType[],
    playerX: number,
    playerY: number,
  ): SpawnPosition[] {
    const spawns: SpawnPosition[] = [];

    // Convert player position to normalized coordinates
    const playerNormX = playerX / this.screenWidth;
    const playerNormY = playerY / this.screenHeight;

    for (const enemyType of enemyTypes) {
      let attempts = 0;
      const maxAttempts = 20;
      let validSpawn = false;

      while (!validSpawn && attempts < maxAttempts) {
        attempts++;

        // Select a spawn zone (weighted random)
        const zone = this.selectSpawnZone(layout.spawnZones);

        // Generate position within zone with some randomness (seeded)
        const angle = this.rng.random() * Math.PI * 2;
        const distance = this.rng.random() * zone.radius;
        const normX = zone.x + Math.cos(angle) * distance;
        const normY = zone.y + Math.sin(angle) * distance;

        // Check if position is valid
        if (this.isValidSpawnPosition(normX, normY, playerNormX, playerNormY, layout, spawns)) {
          const screenX = this.normalizedToScreenX(normX);
          const screenY = this.normalizedToScreenY(normY);

          spawns.push({
            x: screenX,
            y: screenY,
            enemyType,
          });
          validSpawn = true;
        }
      }

      // Fallback: If no valid position found, spawn at zone center
      if (!validSpawn && layout.spawnZones.length > 0) {
        const zone = layout.spawnZones[0];
        spawns.push({
          x: this.normalizedToScreenX(zone.x),
          y: this.normalizedToScreenY(zone.y),
          enemyType,
        });
      }
    }

    return spawns;
  }

  /**
   * Select a spawn zone with weighted probability (seeded)
   */
  private selectSpawnZone(zones: SpawnZone[]): SpawnZone {
    const totalWeight = zones.reduce((sum, z) => sum + z.weight, 0);
    let random = this.rng.random() * totalWeight;

    for (const zone of zones) {
      random -= zone.weight;
      if (random <= 0) {
        return zone;
      }
    }

    return zones[zones.length - 1];
  }

  /**
   * Check if spawn position is valid
   */
  private isValidSpawnPosition(
    normX: number,
    normY: number,
    playerNormX: number,
    playerNormY: number,
    layout: RoomLayout,
    existingSpawns: SpawnPosition[],
  ): boolean {
    // Check bounds (with margin)
    const marginNorm = this.margin / this.screenWidth;
    if (normX < marginNorm || normX > 1 - marginNorm) return false;
    if (normY < marginNorm || normY > 1 - marginNorm) return false;

    // Check distance from player
    const distToPlayer = Math.sqrt(
      Math.pow(normX - playerNormX, 2) + Math.pow(normY - playerNormY, 2),
    );
    if (distToPlayer < layout.playerSpawnSafeRadius) return false;

    // Check safe zones
    for (const safe of layout.safeZones) {
      const distToSafe = Math.sqrt(Math.pow(normX - safe.x, 2) + Math.pow(normY - safe.y, 2));
      if (distToSafe < safe.radius) return false;
    }

    // Check distance from other spawns (prevent stacking)
    const minSpawnDistance = 0.08; // Minimum normalized distance between spawns
    for (const spawn of existingSpawns) {
      const spawnNormX = spawn.x / this.screenWidth;
      const spawnNormY = spawn.y / this.screenHeight;
      const distToSpawn = Math.sqrt(
        Math.pow(normX - spawnNormX, 2) + Math.pow(normY - spawnNormY, 2),
      );
      if (distToSpawn < minSpawnDistance) return false;
    }

    // Check wall overlap - enemies shouldn't spawn inside walls
    if (layout.walls) {
      const wallMargin = 0.05; // Extra margin around walls for spawning
      for (const wall of layout.walls) {
        const wallLeft = wall.x - wall.width / 2 - wallMargin;
        const wallRight = wall.x + wall.width / 2 + wallMargin;
        const wallTop = wall.y - wall.height / 2 - wallMargin;
        const wallBottom = wall.y + wall.height / 2 + wallMargin;

        if (normX >= wallLeft && normX <= wallRight && normY >= wallTop && normY <= wallBottom) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Convert normalized X coordinate to screen coordinate
   */
  private normalizedToScreenX(normX: number): number {
    return Math.round(this.margin + normX * (this.screenWidth - 2 * this.margin));
  }

  /**
   * Convert normalized Y coordinate to screen coordinate
   */
  private normalizedToScreenY(normY: number): number {
    return Math.round(this.margin + normY * (this.screenHeight - 2 * this.margin));
  }

  /**
   * Get a specific layout by type (for testing or forced layouts)
   */
  getLayoutByType(type: RoomLayoutType): RoomLayout | undefined {
    return (
      ROOM_LAYOUTS.find((l) => l.type === type) ||
      BOSS_LAYOUTS.find((l) => l.type === type) ||
      MINI_BOSS_LAYOUTS.find((l) => l.type === type)
    );
  }

  /**
   * Get all available layout types
   */
  getAllLayoutTypes(): RoomLayoutType[] {
    const types = new Set<RoomLayoutType>();
    ROOM_LAYOUTS.forEach((l) => types.add(l.type));
    BOSS_LAYOUTS.forEach((l) => types.add(l.type));
    MINI_BOSS_LAYOUTS.forEach((l) => types.add(l.type));
    return Array.from(types);
  }
}

// Singleton instance
let roomGeneratorInstance: RoomGenerator | null = null;

/**
 * Get or create RoomGenerator instance
 */
export function getRoomGenerator(screenWidth: number, screenHeight: number): RoomGenerator {
  if (!roomGeneratorInstance) {
    roomGeneratorInstance = new RoomGenerator(screenWidth, screenHeight);
  } else {
    roomGeneratorInstance.setDimensions(screenWidth, screenHeight);
  }
  return roomGeneratorInstance;
}

export default RoomGenerator;
