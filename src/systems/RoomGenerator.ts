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

import { ChapterId, EnemyType, getChapterDefinition, getRoomTypeForNumber, RoomType, getEnemySpawnWeight } from '../config/chapterData'
import { SeededRandom } from './SeededRandom'

// ============================================
// Types
// ============================================

/**
 * Room layout types for variety
 */
export type RoomLayoutType =
  | 'open_arena'      // Large open space - good for kiting
  | 'narrow_corridor' // Long narrow area - limited dodging
  | 'split_arena'     // Two halves connected - divide and conquer
  | 'corner_rooms'    // Four corners with center - tactical positioning
  | 'maze_lite'       // Light maze with a few walls - cover tactics
  | 'gauntlet'        // Long path with enemies along sides
  | 'ambush'          // Enemies spawn from edges after entering
  | 'boss_arena'      // Large circular arena for boss fights
  | 'mini_boss_pit'   // Medium arena with tight space

/**
 * Spawn zone within a room (normalized 0-1 coordinates)
 */
export interface SpawnZone {
  x: number      // Center X (0-1)
  y: number      // Center Y (0-1)
  radius: number // Spawn radius (0-1)
  weight: number // Spawn probability weight
}

/**
 * Safe zone where enemies should not spawn
 */
export interface SafeZone {
  x: number
  y: number
  radius: number
}

/**
 * Wall configuration (normalized coordinates 0-1)
 */
export interface WallConfig {
  x: number      // Center X (0-1)
  y: number      // Center Y (0-1)
  width: number  // Width (0-1)
  height: number // Height (0-1)
}

/**
 * Room layout definition
 */
export interface RoomLayout {
  type: RoomLayoutType
  name: string
  description: string
  spawnZones: SpawnZone[]
  safeZones: SafeZone[]
  walls?: WallConfig[] // Optional walls for obstacles
  playerSpawnSafeRadius: number // Minimum distance from player spawn
}

/**
 * Enemy combination pattern for tactical scenarios
 */
export interface EnemyCombination {
  name: string
  description: string
  enemies: EnemyType[]
  minRoom: number   // Minimum room number to appear
  weight: number    // Selection weight
  synergy: string   // Description of tactical synergy
}

/**
 * Spawn position result
 */
export interface SpawnPosition {
  x: number
  y: number
  enemyType: EnemyType
}

/**
 * Room generation result
 */
export interface GeneratedRoom {
  layout: RoomLayout
  enemySpawns: SpawnPosition[]
  combination: EnemyCombination | null
}

// ============================================
// Room Layout Templates
// ============================================

/**
 * Standard room layouts - 15+ variations
 */
export const ROOM_LAYOUTS: RoomLayout[] = [
  // Open Arenas (3 variants)
  {
    type: 'open_arena',
    name: 'Central Arena',
    description: 'Large open space with enemies spawning around the edges',
    spawnZones: [
      { x: 0.2, y: 0.2, radius: 0.15, weight: 1 },
      { x: 0.8, y: 0.2, radius: 0.15, weight: 1 },
      { x: 0.2, y: 0.7, radius: 0.15, weight: 1 },
      { x: 0.8, y: 0.7, radius: 0.15, weight: 1 },
      { x: 0.5, y: 0.25, radius: 0.2, weight: 0.5 },
    ],
    safeZones: [{ x: 0.5, y: 0.85, radius: 0.15 }],
    playerSpawnSafeRadius: 0.25,
  },
  {
    type: 'open_arena',
    name: 'Scattered Arena',
    description: 'Open space with enemies scattered throughout',
    spawnZones: [
      { x: 0.3, y: 0.3, radius: 0.18, weight: 1 },
      { x: 0.7, y: 0.3, radius: 0.18, weight: 1 },
      { x: 0.5, y: 0.5, radius: 0.15, weight: 0.8 },
      { x: 0.3, y: 0.6, radius: 0.15, weight: 1 },
      { x: 0.7, y: 0.6, radius: 0.15, weight: 1 },
    ],
    safeZones: [{ x: 0.5, y: 0.9, radius: 0.12 }],
    playerSpawnSafeRadius: 0.22,
  },
  {
    type: 'open_arena',
    name: 'Ring Formation',
    description: 'Enemies form a ring around the player',
    spawnZones: [
      { x: 0.15, y: 0.4, radius: 0.1, weight: 1 },
      { x: 0.85, y: 0.4, radius: 0.1, weight: 1 },
      { x: 0.3, y: 0.2, radius: 0.12, weight: 1 },
      { x: 0.7, y: 0.2, radius: 0.12, weight: 1 },
      { x: 0.5, y: 0.15, radius: 0.15, weight: 1.2 },
      { x: 0.3, y: 0.65, radius: 0.1, weight: 0.8 },
      { x: 0.7, y: 0.65, radius: 0.1, weight: 0.8 },
    ],
    safeZones: [{ x: 0.5, y: 0.85, radius: 0.18 }],
    playerSpawnSafeRadius: 0.28,
  },

  // Narrow Corridors (3 variants)
  {
    type: 'narrow_corridor',
    name: 'Vertical Corridor',
    description: 'Narrow vertical path with enemies blocking the way',
    spawnZones: [
      { x: 0.5, y: 0.2, radius: 0.2, weight: 1.5 },
      { x: 0.5, y: 0.4, radius: 0.18, weight: 1 },
      { x: 0.5, y: 0.55, radius: 0.15, weight: 0.8 },
    ],
    safeZones: [
      { x: 0.15, y: 0.5, radius: 0.1 },
      { x: 0.85, y: 0.5, radius: 0.1 },
    ],
    playerSpawnSafeRadius: 0.2,
  },
  {
    type: 'narrow_corridor',
    name: 'Horizontal Corridor',
    description: 'Wide horizontal corridor with flanking positions',
    spawnZones: [
      { x: 0.2, y: 0.4, radius: 0.15, weight: 1 },
      { x: 0.5, y: 0.35, radius: 0.18, weight: 1.2 },
      { x: 0.8, y: 0.4, radius: 0.15, weight: 1 },
    ],
    safeZones: [
      { x: 0.5, y: 0.15, radius: 0.1 },
      { x: 0.5, y: 0.85, radius: 0.12 },
    ],
    playerSpawnSafeRadius: 0.2,
  },
  {
    type: 'narrow_corridor',
    name: 'Diagonal Run',
    description: 'Diagonal path with enemies positioned along it',
    spawnZones: [
      { x: 0.25, y: 0.25, radius: 0.15, weight: 1 },
      { x: 0.45, y: 0.4, radius: 0.15, weight: 1 },
      { x: 0.65, y: 0.3, radius: 0.15, weight: 1 },
      { x: 0.75, y: 0.2, radius: 0.12, weight: 0.8 },
    ],
    safeZones: [{ x: 0.5, y: 0.8, radius: 0.15 }],
    playerSpawnSafeRadius: 0.25,
  },

  // Split Arenas (2 variants) - with dividing walls
  {
    type: 'split_arena',
    name: 'Left-Right Split',
    description: 'Two groups on opposite sides with center wall',
    spawnZones: [
      { x: 0.2, y: 0.35, radius: 0.18, weight: 1.5 },
      { x: 0.25, y: 0.55, radius: 0.12, weight: 1 },
      { x: 0.8, y: 0.35, radius: 0.18, weight: 1.5 },
      { x: 0.75, y: 0.55, radius: 0.12, weight: 1 },
    ],
    safeZones: [
      { x: 0.5, y: 0.45, radius: 0.12 },
      { x: 0.5, y: 0.85, radius: 0.1 },
    ],
    walls: [
      { x: 0.5, y: 0.35, width: 0.04, height: 0.25 }, // Center vertical divider
    ],
    playerSpawnSafeRadius: 0.22,
  },
  {
    type: 'split_arena',
    name: 'Top-Bottom Split',
    description: 'Enemies in upper section with horizontal barrier',
    spawnZones: [
      { x: 0.3, y: 0.2, radius: 0.18, weight: 1.2 },
      { x: 0.7, y: 0.2, radius: 0.18, weight: 1.2 },
      { x: 0.5, y: 0.35, radius: 0.2, weight: 1.5 },
      { x: 0.5, y: 0.55, radius: 0.15, weight: 0.8 },
    ],
    safeZones: [{ x: 0.5, y: 0.9, radius: 0.15 }],
    walls: [
      { x: 0.5, y: 0.48, width: 0.25, height: 0.04 }, // Horizontal barrier
    ],
    playerSpawnSafeRadius: 0.3,
  },

  // Corner Rooms (2 variants) - with corner cover
  {
    type: 'corner_rooms',
    name: 'Four Corners',
    description: 'Enemies in corners with center pillars',
    spawnZones: [
      { x: 0.15, y: 0.2, radius: 0.12, weight: 1 },
      { x: 0.85, y: 0.2, radius: 0.12, weight: 1 },
      { x: 0.15, y: 0.65, radius: 0.12, weight: 1 },
      { x: 0.85, y: 0.65, radius: 0.12, weight: 1 },
    ],
    safeZones: [{ x: 0.5, y: 0.5, radius: 0.2 }],
    walls: [
      { x: 0.35, y: 0.4, width: 0.06, height: 0.06 }, // Left pillar
      { x: 0.65, y: 0.4, width: 0.06, height: 0.06 }, // Right pillar
    ],
    playerSpawnSafeRadius: 0.2,
  },
  {
    type: 'corner_rooms',
    name: 'Corners Plus Center',
    description: 'Enemies in corners with center obstacles',
    spawnZones: [
      { x: 0.2, y: 0.22, radius: 0.1, weight: 0.8 },
      { x: 0.8, y: 0.22, radius: 0.1, weight: 0.8 },
      { x: 0.2, y: 0.6, radius: 0.1, weight: 0.8 },
      { x: 0.8, y: 0.6, radius: 0.1, weight: 0.8 },
      { x: 0.5, y: 0.38, radius: 0.18, weight: 1.5 },
    ],
    safeZones: [{ x: 0.5, y: 0.85, radius: 0.12 }],
    walls: [
      { x: 0.5, y: 0.5, width: 0.08, height: 0.08 }, // Center obstacle
      { x: 0.3, y: 0.35, width: 0.05, height: 0.1 }, // Left barrier
      { x: 0.7, y: 0.35, width: 0.05, height: 0.1 }, // Right barrier
    ],
    playerSpawnSafeRadius: 0.25,
  },

  // Maze Lite (2 variants) - with walls for cover
  {
    type: 'maze_lite',
    name: 'Cover Points',
    description: 'Multiple clusters with gaps for kiting, walls provide cover',
    spawnZones: [
      { x: 0.25, y: 0.25, radius: 0.12, weight: 1 },
      { x: 0.5, y: 0.3, radius: 0.12, weight: 1 },
      { x: 0.75, y: 0.25, radius: 0.12, weight: 1 },
      { x: 0.35, y: 0.5, radius: 0.1, weight: 0.8 },
      { x: 0.65, y: 0.5, radius: 0.1, weight: 0.8 },
    ],
    safeZones: [
      { x: 0.5, y: 0.85, radius: 0.1 },
      { x: 0.5, y: 0.65, radius: 0.08 },
    ],
    walls: [
      { x: 0.3, y: 0.4, width: 0.08, height: 0.15 }, // Left cover
      { x: 0.7, y: 0.4, width: 0.08, height: 0.15 }, // Right cover
      { x: 0.5, y: 0.55, width: 0.12, height: 0.04 }, // Center horizontal
    ],
    playerSpawnSafeRadius: 0.2,
  },
  {
    type: 'maze_lite',
    name: 'Scattered Pockets',
    description: 'Small groups spread throughout the room with wall barriers',
    spawnZones: [
      { x: 0.2, y: 0.3, radius: 0.1, weight: 1 },
      { x: 0.4, y: 0.2, radius: 0.1, weight: 1 },
      { x: 0.6, y: 0.35, radius: 0.1, weight: 1 },
      { x: 0.8, y: 0.25, radius: 0.1, weight: 1 },
      { x: 0.3, y: 0.55, radius: 0.1, weight: 0.8 },
      { x: 0.7, y: 0.5, radius: 0.1, weight: 0.8 },
    ],
    safeZones: [{ x: 0.5, y: 0.88, radius: 0.12 }],
    walls: [
      { x: 0.5, y: 0.4, width: 0.04, height: 0.2 }, // Center vertical barrier
      { x: 0.25, y: 0.45, width: 0.06, height: 0.1 }, // Left pocket
      { x: 0.75, y: 0.35, width: 0.06, height: 0.1 }, // Right pocket
    ],
    playerSpawnSafeRadius: 0.22,
  },

  // Gauntlet (2 variants) - with side walls
  {
    type: 'gauntlet',
    name: 'Side Runners',
    description: 'Enemies along both sides with corridor walls',
    spawnZones: [
      { x: 0.15, y: 0.25, radius: 0.1, weight: 1 },
      { x: 0.15, y: 0.45, radius: 0.1, weight: 1 },
      { x: 0.15, y: 0.65, radius: 0.1, weight: 0.8 },
      { x: 0.85, y: 0.25, radius: 0.1, weight: 1 },
      { x: 0.85, y: 0.45, radius: 0.1, weight: 1 },
      { x: 0.85, y: 0.65, radius: 0.1, weight: 0.8 },
    ],
    safeZones: [
      { x: 0.5, y: 0.4, radius: 0.15 },
      { x: 0.5, y: 0.85, radius: 0.1 },
    ],
    walls: [
      { x: 0.32, y: 0.35, width: 0.04, height: 0.25 }, // Left corridor wall
      { x: 0.68, y: 0.35, width: 0.04, height: 0.25 }, // Right corridor wall
    ],
    playerSpawnSafeRadius: 0.18,
  },
  {
    type: 'gauntlet',
    name: 'Forward March',
    description: 'Enemies advancing with barrier cover',
    spawnZones: [
      { x: 0.35, y: 0.18, radius: 0.12, weight: 1.2 },
      { x: 0.65, y: 0.18, radius: 0.12, weight: 1.2 },
      { x: 0.5, y: 0.32, radius: 0.15, weight: 1 },
      { x: 0.3, y: 0.45, radius: 0.1, weight: 0.8 },
      { x: 0.7, y: 0.45, radius: 0.1, weight: 0.8 },
    ],
    safeZones: [{ x: 0.5, y: 0.82, radius: 0.15 }],
    walls: [
      { x: 0.5, y: 0.55, width: 0.2, height: 0.04 }, // Horizontal barrier
      { x: 0.25, y: 0.4, width: 0.06, height: 0.1 }, // Left cover
      { x: 0.75, y: 0.4, width: 0.06, height: 0.1 }, // Right cover
    ],
    playerSpawnSafeRadius: 0.28,
  },

  // Ambush (1 variant - special) - with trap corridor
  {
    type: 'ambush',
    name: 'Pincer Attack',
    description: 'Enemies spawn from sides with corridor walls',
    spawnZones: [
      { x: 0.1, y: 0.35, radius: 0.08, weight: 1 },
      { x: 0.1, y: 0.55, radius: 0.08, weight: 1 },
      { x: 0.9, y: 0.35, radius: 0.08, weight: 1 },
      { x: 0.9, y: 0.55, radius: 0.08, weight: 1 },
      { x: 0.5, y: 0.2, radius: 0.15, weight: 1.2 },
    ],
    safeZones: [{ x: 0.5, y: 0.75, radius: 0.2 }],
    walls: [
      { x: 0.25, y: 0.45, width: 0.04, height: 0.2 }, // Left corridor wall
      { x: 0.75, y: 0.45, width: 0.04, height: 0.2 }, // Right corridor wall
      { x: 0.5, y: 0.6, width: 0.15, height: 0.04 }, // Bottom barrier
    ],
    playerSpawnSafeRadius: 0.2,
  },

  // Circular Formation (2 variants) - with center pillar
  {
    type: 'open_arena',
    name: 'Circular Siege',
    description: 'Enemies arranged in circle with center obstacle',
    spawnZones: [
      { x: 0.5, y: 0.15, radius: 0.1, weight: 1 },
      { x: 0.2, y: 0.3, radius: 0.1, weight: 1 },
      { x: 0.8, y: 0.3, radius: 0.1, weight: 1 },
      { x: 0.15, y: 0.5, radius: 0.1, weight: 1 },
      { x: 0.85, y: 0.5, radius: 0.1, weight: 1 },
      { x: 0.25, y: 0.65, radius: 0.08, weight: 0.8 },
      { x: 0.75, y: 0.65, radius: 0.08, weight: 0.8 },
    ],
    safeZones: [{ x: 0.5, y: 0.85, radius: 0.15 }],
    walls: [
      { x: 0.5, y: 0.42, width: 0.1, height: 0.1 }, // Center pillar
    ],
    playerSpawnSafeRadius: 0.25,
  },

  // Wave Formation (2 variants)
  {
    type: 'gauntlet',
    name: 'Advancing Wave',
    description: 'Enemies in rows advancing toward player',
    spawnZones: [
      { x: 0.25, y: 0.15, radius: 0.12, weight: 1.2 },
      { x: 0.5, y: 0.15, radius: 0.12, weight: 1.2 },
      { x: 0.75, y: 0.15, radius: 0.12, weight: 1.2 },
      { x: 0.35, y: 0.32, radius: 0.1, weight: 1 },
      { x: 0.65, y: 0.32, radius: 0.1, weight: 1 },
      { x: 0.5, y: 0.48, radius: 0.12, weight: 0.8 },
    ],
    safeZones: [{ x: 0.5, y: 0.85, radius: 0.18 }],
    playerSpawnSafeRadius: 0.3,
  },
  {
    type: 'gauntlet',
    name: 'Staggered Lines',
    description: 'Multiple staggered enemy lines',
    spawnZones: [
      { x: 0.3, y: 0.2, radius: 0.1, weight: 1 },
      { x: 0.7, y: 0.2, radius: 0.1, weight: 1 },
      { x: 0.2, y: 0.38, radius: 0.1, weight: 1 },
      { x: 0.5, y: 0.35, radius: 0.12, weight: 1 },
      { x: 0.8, y: 0.38, radius: 0.1, weight: 1 },
      { x: 0.35, y: 0.55, radius: 0.08, weight: 0.7 },
      { x: 0.65, y: 0.55, radius: 0.08, weight: 0.7 },
    ],
    safeZones: [{ x: 0.5, y: 0.88, radius: 0.12 }],
    playerSpawnSafeRadius: 0.28,
  },

  // Crossfire Pattern
  {
    type: 'split_arena',
    name: 'Crossfire',
    description: 'Enemies positioned for crossfire tactics',
    spawnZones: [
      { x: 0.15, y: 0.25, radius: 0.1, weight: 1 },
      { x: 0.85, y: 0.25, radius: 0.1, weight: 1 },
      { x: 0.15, y: 0.5, radius: 0.1, weight: 1.2 },
      { x: 0.85, y: 0.5, radius: 0.1, weight: 1.2 },
      { x: 0.5, y: 0.2, radius: 0.15, weight: 1 },
    ],
    safeZones: [
      { x: 0.5, y: 0.5, radius: 0.1 },
      { x: 0.5, y: 0.85, radius: 0.12 },
    ],
    playerSpawnSafeRadius: 0.22,
  },

  // Defensive Positions
  {
    type: 'corner_rooms',
    name: 'Defensive Perimeter',
    description: 'Enemies positioned defensively around the room',
    spawnZones: [
      { x: 0.2, y: 0.2, radius: 0.1, weight: 1.2 },
      { x: 0.8, y: 0.2, radius: 0.1, weight: 1.2 },
      { x: 0.5, y: 0.3, radius: 0.15, weight: 1.5 },
      { x: 0.2, y: 0.55, radius: 0.08, weight: 0.8 },
      { x: 0.8, y: 0.55, radius: 0.08, weight: 0.8 },
    ],
    safeZones: [
      { x: 0.5, y: 0.6, radius: 0.1 },
      { x: 0.5, y: 0.85, radius: 0.12 },
    ],
    playerSpawnSafeRadius: 0.25,
  },

  // Central Nexus
  {
    type: 'maze_lite',
    name: 'Central Nexus',
    description: 'Enemies converge from multiple points toward center',
    spawnZones: [
      { x: 0.5, y: 0.28, radius: 0.18, weight: 2 }, // Strong center
      { x: 0.2, y: 0.25, radius: 0.1, weight: 0.8 },
      { x: 0.8, y: 0.25, radius: 0.1, weight: 0.8 },
      { x: 0.25, y: 0.5, radius: 0.1, weight: 0.8 },
      { x: 0.75, y: 0.5, radius: 0.1, weight: 0.8 },
    ],
    safeZones: [{ x: 0.5, y: 0.85, radius: 0.15 }],
    playerSpawnSafeRadius: 0.25,
  },
]

/**
 * Chokepoint layouts - wall-heavy designs with narrow passages
 * These create tactical gameplay with predictable wall positions
 * All walls are positioned with y < 0.70 to keep bottom area clear for player spawn
 */
export const CHOKEPOINT_LAYOUTS: RoomLayout[] = [
  // The Funnel - walls on sides force movement through center
  {
    type: 'narrow_corridor',
    name: 'The Funnel',
    description: 'Side walls create a narrow central passage',
    spawnZones: [
      { x: 0.5, y: 0.20, radius: 0.20, weight: 1.5 },
      { x: 0.5, y: 0.40, radius: 0.18, weight: 1 },
      { x: 0.35, y: 0.55, radius: 0.10, weight: 0.8 },
      { x: 0.65, y: 0.55, radius: 0.10, weight: 0.8 },
    ],
    safeZones: [{ x: 0.5, y: 0.90, radius: 0.15 }],
    walls: [
      { x: 0.15, y: 0.40, width: 0.15, height: 0.50 }, // Left wall
      { x: 0.85, y: 0.40, width: 0.15, height: 0.50 }, // Right wall
    ],
    playerSpawnSafeRadius: 0.25,
  },

  // Corridor Split - center divider forces left/right choice
  {
    type: 'split_arena',
    name: 'Corridor Split',
    description: 'Center wall splits arena into two paths',
    spawnZones: [
      { x: 0.25, y: 0.25, radius: 0.15, weight: 1.2 },
      { x: 0.75, y: 0.25, radius: 0.15, weight: 1.2 },
      { x: 0.25, y: 0.50, radius: 0.12, weight: 1 },
      { x: 0.75, y: 0.50, radius: 0.12, weight: 1 },
    ],
    safeZones: [{ x: 0.5, y: 0.90, radius: 0.15 }],
    walls: [
      { x: 0.12, y: 0.35, width: 0.10, height: 0.40 }, // Far left wall
      { x: 0.50, y: 0.35, width: 0.10, height: 0.45 }, // Center divider
      { x: 0.88, y: 0.35, width: 0.10, height: 0.40 }, // Far right wall
    ],
    playerSpawnSafeRadius: 0.25,
  },

  // Barricades - staggered horizontal bars create weaving path
  {
    type: 'maze_lite',
    name: 'Barricades',
    description: 'Staggered horizontal barriers create a weaving path',
    spawnZones: [
      { x: 0.25, y: 0.15, radius: 0.12, weight: 1 },
      { x: 0.75, y: 0.15, radius: 0.12, weight: 1 },
      { x: 0.50, y: 0.28, radius: 0.15, weight: 1.2 },
      { x: 0.25, y: 0.40, radius: 0.10, weight: 0.8 },
      { x: 0.75, y: 0.40, radius: 0.10, weight: 0.8 },
      { x: 0.50, y: 0.55, radius: 0.12, weight: 0.8 },
    ],
    safeZones: [{ x: 0.5, y: 0.90, radius: 0.15 }],
    walls: [
      { x: 0.30, y: 0.20, width: 0.28, height: 0.05 }, // Top left bar
      { x: 0.70, y: 0.32, width: 0.28, height: 0.05 }, // Mid right bar
      { x: 0.30, y: 0.44, width: 0.28, height: 0.05 }, // Mid left bar
      { x: 0.70, y: 0.56, width: 0.28, height: 0.05 }, // Lower right bar
    ],
    playerSpawnSafeRadius: 0.25,
  },

  // Fortress - large central obstacle with side pillars
  {
    type: 'corner_rooms',
    name: 'Fortress',
    description: 'Large central obstacle forces flanking movement',
    spawnZones: [
      { x: 0.20, y: 0.20, radius: 0.12, weight: 1.2 },
      { x: 0.80, y: 0.20, radius: 0.12, weight: 1.2 },
      { x: 0.50, y: 0.15, radius: 0.15, weight: 1 },
      { x: 0.20, y: 0.50, radius: 0.10, weight: 0.8 },
      { x: 0.80, y: 0.50, radius: 0.10, weight: 0.8 },
    ],
    safeZones: [{ x: 0.5, y: 0.90, radius: 0.15 }],
    walls: [
      { x: 0.50, y: 0.38, width: 0.28, height: 0.22 }, // Central fortress
      { x: 0.14, y: 0.35, width: 0.08, height: 0.30 }, // Left pillar
      { x: 0.86, y: 0.35, width: 0.08, height: 0.30 }, // Right pillar
    ],
    playerSpawnSafeRadius: 0.25,
  },

  // Pinch Points - alternating walls create zigzag path
  {
    type: 'gauntlet',
    name: 'Pinch Points',
    description: 'Alternating obstacles create multiple chokepoints',
    spawnZones: [
      { x: 0.50, y: 0.15, radius: 0.18, weight: 1.5 },
      { x: 0.25, y: 0.30, radius: 0.10, weight: 1 },
      { x: 0.75, y: 0.30, radius: 0.10, weight: 1 },
      { x: 0.50, y: 0.45, radius: 0.12, weight: 1 },
      { x: 0.25, y: 0.58, radius: 0.08, weight: 0.7 },
      { x: 0.75, y: 0.58, radius: 0.08, weight: 0.7 },
    ],
    safeZones: [{ x: 0.5, y: 0.90, radius: 0.15 }],
    walls: [
      { x: 0.25, y: 0.22, width: 0.16, height: 0.10 }, // Top left
      { x: 0.75, y: 0.22, width: 0.16, height: 0.10 }, // Top right
      { x: 0.50, y: 0.38, width: 0.20, height: 0.08 }, // Center
      { x: 0.25, y: 0.52, width: 0.16, height: 0.10 }, // Bottom left
      { x: 0.75, y: 0.52, width: 0.16, height: 0.10 }, // Bottom right
    ],
    playerSpawnSafeRadius: 0.25,
  },

  // The Gauntlet - long corridor with extended side walls
  {
    type: 'gauntlet',
    name: 'The Gauntlet',
    description: 'Extended side walls create a long corridor',
    spawnZones: [
      { x: 0.50, y: 0.15, radius: 0.15, weight: 1.5 },
      { x: 0.50, y: 0.30, radius: 0.15, weight: 1.2 },
      { x: 0.50, y: 0.45, radius: 0.15, weight: 1 },
      { x: 0.40, y: 0.58, radius: 0.10, weight: 0.8 },
      { x: 0.60, y: 0.58, radius: 0.10, weight: 0.8 },
    ],
    safeZones: [{ x: 0.5, y: 0.90, radius: 0.15 }],
    walls: [
      { x: 0.20, y: 0.38, width: 0.12, height: 0.55 }, // Long left wall
      { x: 0.80, y: 0.38, width: 0.12, height: 0.55 }, // Long right wall
    ],
    playerSpawnSafeRadius: 0.22,
  },
]

/**
 * Boss room layouts
 */
export const BOSS_LAYOUTS: RoomLayout[] = [
  {
    type: 'boss_arena',
    name: 'Boss Arena',
    description: 'Large circular arena for boss fights',
    spawnZones: [
      { x: 0.5, y: 0.35, radius: 0.05, weight: 1 }, // Boss spawn center-top
    ],
    safeZones: [{ x: 0.5, y: 0.85, radius: 0.18 }],
    playerSpawnSafeRadius: 0.35,
  },
]

/**
 * Mini-boss room layouts
 */
export const MINI_BOSS_LAYOUTS: RoomLayout[] = [
  {
    type: 'mini_boss_pit',
    name: 'Mini-Boss Pit',
    description: 'Tighter arena for mini-boss encounters',
    spawnZones: [
      { x: 0.5, y: 0.4, radius: 0.1, weight: 1 }, // Mini-boss spawn
    ],
    safeZones: [{ x: 0.5, y: 0.85, radius: 0.15 }],
    playerSpawnSafeRadius: 0.3,
  },
]

// ============================================
// Enemy Combination Patterns
// ============================================

/**
 * Predefined enemy combination patterns for tactical scenarios
 */
export const ENEMY_COMBINATIONS: EnemyCombination[] = [
  // Basic combinations (Rooms 1-4)
  {
    name: 'Melee Rush',
    description: 'Pure melee swarm - test kiting skills',
    enemies: ['melee', 'melee', 'melee', 'melee'],
    minRoom: 1,
    weight: 1,
    synergy: 'Overwhelming numbers',
  },
  {
    name: 'Ranged Support',
    description: 'Ranged enemies with melee protection',
    enemies: ['melee', 'melee', 'ranged', 'ranged'],
    minRoom: 1,
    weight: 1.2,
    synergy: 'Ranged pressure while melee closes distance',
  },
  {
    name: 'Sniper Nest',
    description: 'Multiple ranged enemies',
    enemies: ['ranged', 'ranged', 'ranged'],
    minRoom: 2,
    weight: 0.8,
    synergy: 'Constant projectile dodging',
  },

  // Mid-early combinations (Rooms 3-5)
  {
    name: 'Spread Formation',
    description: 'Spreader with melee escorts',
    enemies: ['spreader', 'melee', 'melee', 'ranged'],
    minRoom: 3,
    weight: 1.2,
    synergy: 'Spreader forces movement, melee punishes standing still',
  },
  {
    name: 'Charge Assault',
    description: 'Chargers with ranged backup',
    enemies: ['charger', 'charger', 'ranged', 'ranged'],
    minRoom: 3,
    weight: 1,
    synergy: 'Must dodge charges while avoiding projectiles',
  },
  {
    name: 'Blitz Squad',
    description: 'Fast aggressive composition',
    enemies: ['charger', 'melee', 'melee', 'melee'],
    minRoom: 4,
    weight: 0.9,
    synergy: 'Constant pressure from all directions',
  },

  // Mid-late combinations (Rooms 6-8)
  {
    name: 'Bomber Support',
    description: 'Bombers with protection',
    enemies: ['bomber', 'bomber', 'melee', 'melee', 'ranged'],
    minRoom: 5,
    weight: 1.1,
    synergy: 'AOE denial while melee closes in',
  },
  {
    name: 'Healer Tank',
    description: 'Tank protected by healer',
    enemies: ['tank', 'healer', 'melee', 'melee'],
    minRoom: 6,
    weight: 1.3,
    synergy: 'Kill healer first or tank becomes unkillable',
  },
  {
    name: 'Double Trouble',
    description: 'Two tanks with healer support',
    enemies: ['tank', 'tank', 'healer'],
    minRoom: 7,
    weight: 0.8,
    synergy: 'Heavy pressure - must focus fire',
  },

  // Late game combinations (Rooms 9+)
  {
    name: 'Spawner Den',
    description: 'Spawner with charger protection',
    enemies: ['spawner', 'charger', 'charger', 'ranged'],
    minRoom: 8,
    weight: 1,
    synergy: 'Kill spawner fast or get overwhelmed by minions',
  },
  {
    name: 'Full Support',
    description: 'Healer + Spawner combo',
    enemies: ['healer', 'spawner', 'tank', 'bomber'],
    minRoom: 9,
    weight: 0.9,
    synergy: 'Priority targeting is critical',
  },
  {
    name: 'Chaos Formation',
    description: 'All elite enemies',
    enemies: ['tank', 'charger', 'bomber', 'healer', 'spreader'],
    minRoom: 9,
    weight: 0.7,
    synergy: 'Pure chaos - every enemy type demands attention',
  },
  {
    name: 'Siege Warfare',
    description: 'Ranged heavy with tank',
    enemies: ['tank', 'bomber', 'bomber', 'ranged', 'ranged'],
    minRoom: 8,
    weight: 0.9,
    synergy: 'Constant AOE and projectiles with tanky frontline',
  },
  {
    name: 'Infinite Army',
    description: 'Double spawner chaos',
    enemies: ['spawner', 'spawner', 'healer', 'tank'],
    minRoom: 9,
    weight: 0.6,
    synergy: 'Kill spawners immediately or face endless minions',
  },

  // Mid-game variety combinations (Rooms 4-6)
  {
    name: 'Fire Support',
    description: 'Bombers with ranged protection',
    enemies: ['bomber', 'ranged', 'ranged', 'melee', 'melee'],
    minRoom: 4,
    weight: 1,
    synergy: 'AOE zone denial with ranged pressure',
  },
  {
    name: 'Coordinated Strike',
    description: 'Chargers and spreaders create chaos',
    enemies: ['charger', 'charger', 'spreader', 'ranged'],
    minRoom: 5,
    weight: 0.9,
    synergy: 'Forced movement into spread patterns',
  },
  {
    name: 'Guardian Formation',
    description: 'Healer with protected escorts',
    enemies: ['healer', 'melee', 'melee', 'melee', 'ranged'],
    minRoom: 6,
    weight: 1.1,
    synergy: 'Focus the healer while melee swarms',
  },

  // Heavy and elite combinations (Rooms 7+)
  {
    name: 'Heavy Hitters',
    description: 'Tank duo with charger support',
    enemies: ['tank', 'tank', 'charger', 'charger'],
    minRoom: 7,
    weight: 0.9,
    synergy: 'Slow but deadly frontline with fast flankers',
  },
  {
    name: 'Artillery Line',
    description: 'Multiple bombers with tank frontline',
    enemies: ['tank', 'bomber', 'bomber', 'bomber'],
    minRoom: 7,
    weight: 0.8,
    synergy: 'Constant AOE bombardment behind tank shield',
  },
  {
    name: 'Elite Guard',
    description: 'Ultimate enemy formation',
    enemies: ['tank', 'healer', 'spawner', 'bomber', 'charger', 'spreader'],
    minRoom: 10,
    weight: 0.5,
    synergy: 'Every enemy type that demands priority - extreme danger',
  },
]

// ============================================
// RoomGenerator Class
// ============================================

export class RoomGenerator {
  private screenWidth: number
  private screenHeight: number
  private margin: number = 50 // Margin from screen edges
  private rng: SeededRandom = new SeededRandom() // Default random seed

  constructor(screenWidth: number, screenHeight: number) {
    this.screenWidth = screenWidth
    this.screenHeight = screenHeight
  }

  /**
   * Set the random number generator for deterministic room generation
   * Call this before generateRoom() to use a specific seed
   */
  setRng(rng: SeededRandom): void {
    this.rng = rng
  }

  /**
   * Get the current RNG seed string (for display)
   */
  getSeedString(): string {
    return this.rng.getSeedString()
  }

  /**
   * Update screen dimensions (if they change)
   */
  setDimensions(width: number, height: number): void {
    this.screenWidth = width
    this.screenHeight = height
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
    extraEnemiesPerRoom: number = 0
  ): GeneratedRoom {
    const roomType = getRoomTypeForNumber(roomNumber)

    // Select layout based on room type
    const layout = this.selectLayout(roomType)

    // Calculate total enemies (doubled for higher difficulty)
    const roomScaling = Math.floor(roomNumber / 5)
    const totalEnemies = (baseEnemyCount + extraEnemiesPerRoom + roomScaling) * 2

    // Get chapter enemy pool
    const chapterDef = getChapterDefinition(chapterId)
    const enemyPool = chapterDef.enemyTypes

    // Select enemy combination or generate random composition
    const combination = this.selectCombination(chapterId, roomNumber, enemyPool)

    // Generate enemy types based on combination or random selection
    const enemyTypes = this.generateEnemyTypes(
      totalEnemies,
      roomNumber,
      enemyPool,
      combination,
      chapterId
    )

    // Generate spawn positions
    const enemySpawns = this.generateSpawnPositions(
      layout,
      enemyTypes,
      playerX,
      playerY
    )

    return {
      layout,
      enemySpawns,
      combination,
    }
  }

  /**
   * Select appropriate layout for room type
   * Combat rooms have 70% chance to use chokepoint layouts with walls
   */
  private selectLayout(roomType: RoomType): RoomLayout {
    switch (roomType) {
      case 'boss':
        return BOSS_LAYOUTS[0]
      case 'miniboss':
        return MINI_BOSS_LAYOUTS[0]
      case 'angel':
        // Angel rooms don't need enemies, return empty layout
        return ROOM_LAYOUTS[0]
      case 'combat':
      default: {
        // 70% chance to use chokepoint layouts (wall-heavy)
        // 30% chance to use standard layouts (mixed open/wall)
        if (this.rng.random() < 0.7) {
          const index = Math.floor(this.rng.random() * CHOKEPOINT_LAYOUTS.length)
          return CHOKEPOINT_LAYOUTS[index]
        } else {
          const index = Math.floor(this.rng.random() * ROOM_LAYOUTS.length)
          return ROOM_LAYOUTS[index]
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
    allowedComboNames: string[]
  ): EnemyCombination[] {
    return ENEMY_COMBINATIONS.filter(combo => {
      // Must be in the allowed list for this chapter
      if (!allowedComboNames.includes(combo.name)) return false
      // Must meet room progression requirement
      if (combo.minRoom > roomNumber) return false
      return true
    })
  }

  /**
   * Select an enemy combination based on room number and chapter
   */
  private selectCombination(
    chapterId: ChapterId,
    roomNumber: number,
    enemyPool: EnemyType[]
  ): EnemyCombination | null {
    // 60% chance to use a predefined combination (seeded)
    if (this.rng.random() > 0.6) {
      return null
    }

    // Get chapter definition and allowed combo names
    const chapterDef = getChapterDefinition(chapterId)
    const allowedComboNames = chapterDef.tacticComboNames

    // Get chapter-specific available combos
    const availableCombos = this.getAvailableCombinationsForChapter(
      roomNumber,
      allowedComboNames
    )

    // Also verify all enemies in combo are available in chapter pool
    const validCombos = availableCombos.filter(combo =>
      combo.enemies.every(enemy => enemyPool.includes(enemy))
    )

    if (validCombos.length === 0) {
      return null
    }

    // Weighted random selection (seeded)
    const totalWeight = validCombos.reduce((sum, c) => sum + c.weight, 0)
    let random = this.rng.random() * totalWeight

    for (const combo of validCombos) {
      random -= combo.weight
      if (random <= 0) {
        return combo
      }
    }

    return validCombos[validCombos.length - 1]
  }

  /**
   * Generate enemy types based on combination or random selection
   */
  private generateEnemyTypes(
    count: number,
    roomNumber: number,
    enemyPool: EnemyType[],
    combination: EnemyCombination | null,
    chapterId: ChapterId
  ): EnemyType[] {
    const enemies: EnemyType[] = []

    // If using a combination, start with those enemies
    if (combination) {
      enemies.push(...combination.enemies)
    }

    // Fill remaining slots with random enemies from pool
    while (enemies.length < count) {
      const enemy = this.selectRandomEnemy(roomNumber, enemyPool, chapterId)
      enemies.push(enemy)
    }

    // Trim if we have too many
    while (enemies.length > count) {
      enemies.pop()
    }

    return enemies
  }

  /**
   * Select a random enemy based on room progression, pool, and chapter-specific weights
   */
  private selectRandomEnemy(roomNumber: number, pool: EnemyType[], chapterId: ChapterId): EnemyType {
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
    }

    // Apply chapter-specific spawn weight multipliers
    const finalWeights: Record<EnemyType, number> = {} as Record<EnemyType, number>
    for (const enemyType of pool) {
      const chapterSpawnWeight = getEnemySpawnWeight(chapterId, enemyType)
      finalWeights[enemyType] = baseWeights[enemyType] * chapterSpawnWeight
    }

    // Filter pool and calculate total weight
    const availableEnemies = pool.filter(e => finalWeights[e] > 0)
    const totalWeight = availableEnemies.reduce((sum, e) => sum + finalWeights[e], 0)

    if (totalWeight === 0 || availableEnemies.length === 0) {
      return 'melee' // Fallback
    }

    // Weighted random selection (seeded)
    let random = this.rng.random() * totalWeight
    for (const enemy of availableEnemies) {
      random -= finalWeights[enemy]
      if (random <= 0) {
        return enemy
      }
    }

    return availableEnemies[availableEnemies.length - 1]
  }

  /**
   * Generate spawn positions based on layout and player position
   */
  private generateSpawnPositions(
    layout: RoomLayout,
    enemyTypes: EnemyType[],
    playerX: number,
    playerY: number
  ): SpawnPosition[] {
    const spawns: SpawnPosition[] = []

    // Convert player position to normalized coordinates
    const playerNormX = playerX / this.screenWidth
    const playerNormY = playerY / this.screenHeight

    for (const enemyType of enemyTypes) {
      let attempts = 0
      const maxAttempts = 20
      let validSpawn = false

      while (!validSpawn && attempts < maxAttempts) {
        attempts++

        // Select a spawn zone (weighted random)
        const zone = this.selectSpawnZone(layout.spawnZones)

        // Generate position within zone with some randomness (seeded)
        const angle = this.rng.random() * Math.PI * 2
        const distance = this.rng.random() * zone.radius
        const normX = zone.x + Math.cos(angle) * distance
        const normY = zone.y + Math.sin(angle) * distance

        // Check if position is valid
        if (this.isValidSpawnPosition(normX, normY, playerNormX, playerNormY, layout, spawns)) {
          const screenX = this.normalizedToScreenX(normX)
          const screenY = this.normalizedToScreenY(normY)

          spawns.push({
            x: screenX,
            y: screenY,
            enemyType,
          })
          validSpawn = true
        }
      }

      // Fallback: If no valid position found, spawn at zone center
      if (!validSpawn && layout.spawnZones.length > 0) {
        const zone = layout.spawnZones[0]
        spawns.push({
          x: this.normalizedToScreenX(zone.x),
          y: this.normalizedToScreenY(zone.y),
          enemyType,
        })
      }
    }

    return spawns
  }

  /**
   * Select a spawn zone with weighted probability (seeded)
   */
  private selectSpawnZone(zones: SpawnZone[]): SpawnZone {
    const totalWeight = zones.reduce((sum, z) => sum + z.weight, 0)
    let random = this.rng.random() * totalWeight

    for (const zone of zones) {
      random -= zone.weight
      if (random <= 0) {
        return zone
      }
    }

    return zones[zones.length - 1]
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
    existingSpawns: SpawnPosition[]
  ): boolean {
    // Check bounds (with margin)
    const marginNorm = this.margin / this.screenWidth
    if (normX < marginNorm || normX > 1 - marginNorm) return false
    if (normY < marginNorm || normY > 1 - marginNorm) return false

    // Check distance from player
    const distToPlayer = Math.sqrt(
      Math.pow(normX - playerNormX, 2) + Math.pow(normY - playerNormY, 2)
    )
    if (distToPlayer < layout.playerSpawnSafeRadius) return false

    // Check safe zones
    for (const safe of layout.safeZones) {
      const distToSafe = Math.sqrt(
        Math.pow(normX - safe.x, 2) + Math.pow(normY - safe.y, 2)
      )
      if (distToSafe < safe.radius) return false
    }

    // Check distance from other spawns (prevent stacking)
    const minSpawnDistance = 0.08 // Minimum normalized distance between spawns
    for (const spawn of existingSpawns) {
      const spawnNormX = spawn.x / this.screenWidth
      const spawnNormY = spawn.y / this.screenHeight
      const distToSpawn = Math.sqrt(
        Math.pow(normX - spawnNormX, 2) + Math.pow(normY - spawnNormY, 2)
      )
      if (distToSpawn < minSpawnDistance) return false
    }

    return true
  }

  /**
   * Convert normalized X coordinate to screen coordinate
   */
  private normalizedToScreenX(normX: number): number {
    return Math.round(this.margin + normX * (this.screenWidth - 2 * this.margin))
  }

  /**
   * Convert normalized Y coordinate to screen coordinate
   */
  private normalizedToScreenY(normY: number): number {
    return Math.round(this.margin + normY * (this.screenHeight - 2 * this.margin))
  }

  /**
   * Get a specific layout by type (for testing or forced layouts)
   */
  getLayoutByType(type: RoomLayoutType): RoomLayout | undefined {
    return ROOM_LAYOUTS.find(l => l.type === type) ||
           BOSS_LAYOUTS.find(l => l.type === type) ||
           MINI_BOSS_LAYOUTS.find(l => l.type === type)
  }

  /**
   * Get all available layout types
   */
  getAllLayoutTypes(): RoomLayoutType[] {
    const types = new Set<RoomLayoutType>()
    ROOM_LAYOUTS.forEach(l => types.add(l.type))
    BOSS_LAYOUTS.forEach(l => types.add(l.type))
    MINI_BOSS_LAYOUTS.forEach(l => types.add(l.type))
    return Array.from(types)
  }
}

// Singleton instance
let roomGeneratorInstance: RoomGenerator | null = null

/**
 * Get or create RoomGenerator instance
 */
export function getRoomGenerator(screenWidth: number, screenHeight: number): RoomGenerator {
  if (!roomGeneratorInstance) {
    roomGeneratorInstance = new RoomGenerator(screenWidth, screenHeight)
  } else {
    roomGeneratorInstance.setDimensions(screenWidth, screenHeight)
  }
  return roomGeneratorInstance
}

export default RoomGenerator
