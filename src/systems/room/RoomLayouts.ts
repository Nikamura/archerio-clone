/**
 * Room Layout Definitions
 *
 * Contains all room layout templates for procedural room generation.
 * Layouts define spawn zones, safe zones, and wall configurations.
 */

// ============================================
// Wall Size Constants (normalized 0-1)
// ============================================
// These values result in pixel sizes that are multiples of WALL_TILE_SIZE (64px)
// when applied to screen dimensions (375x667)

/**
 * Standard wall widths (normalized to 375px screen width)
 * W1 = 1 tile (64px), W2 = 2 tiles (128px), W3 = 3 tiles (192px)
 */
export const WALL_W1 = 0.171; // ~64px
export const WALL_W2 = 0.341; // ~128px
export const WALL_W3 = 0.512; // ~192px

/**
 * Standard wall heights (normalized to 667px screen height)
 * H1 = 1 tile (64px), H2 = 2 tiles, H3 = 3 tiles, H4 = 4 tiles, H5 = 5 tiles
 */
export const WALL_H1 = 0.096; // ~64px
export const WALL_H2 = 0.192; // ~128px
export const WALL_H3 = 0.288; // ~192px
export const WALL_H4 = 0.384; // ~256px
export const WALL_H5 = 0.48; // ~320px

/**
 * Wall X positions for proper corridor spacing (player is 64px, needs ~96px min corridor)
 * These positions ensure walls either block passage completely or allow comfortable movement
 */
// Walls flush against screen edges (no passage possible)
export const WALL_X_LEFT_EDGE = 0.085; // Wall center at 32px, flush with left edge
export const WALL_X_RIGHT_EDGE = 0.915; // Wall center at 343px, flush with right edge

// Walls with passage to screen edge (96px+ corridor)
export const WALL_X_LEFT_PASSAGE = 0.34; // Wall at 128px center, leaves 96px corridor to left
export const WALL_X_RIGHT_PASSAGE = 0.66; // Wall at 247px center, leaves 96px corridor to right

// Center corridor walls (ensures 128px+ passage in center)
export const WALL_X_LEFT_CENTER = 0.38; // For center corridors
export const WALL_X_RIGHT_CENTER = 0.62; // For center corridors

/**
 * Minimum spacing between walls (normalized)
 * Walls should never be closer than this to avoid feeling closed-off
 * ~128px vertical gap, ~96px horizontal gap
 */
export const MIN_WALL_GAP_Y = 0.19; // ~128px vertical spacing between walls
export const MIN_WALL_GAP_X = 0.26; // ~96px horizontal spacing between walls

// ============================================
// Types
// ============================================

/**
 * Room layout types for variety
 */
export type RoomLayoutType =
  | "open_arena" // Large open space - good for kiting
  | "narrow_corridor" // Long narrow area - limited dodging
  | "split_arena" // Two halves connected - divide and conquer
  | "corner_rooms" // Four corners with center - tactical positioning
  | "maze_lite" // Light maze with a few walls - cover tactics
  | "gauntlet" // Long path with enemies along sides
  | "ambush" // Enemies spawn from edges after entering
  | "boss_arena" // Large circular arena for boss fights
  | "mini_boss_pit"; // Medium arena with tight space

/**
 * Spawn zone within a room (normalized 0-1 coordinates)
 */
export interface SpawnZone {
  x: number; // Center X (0-1)
  y: number; // Center Y (0-1)
  radius: number; // Spawn radius (0-1)
  weight: number; // Spawn probability weight
}

/**
 * Safe zone where enemies should not spawn
 */
export interface SafeZone {
  x: number;
  y: number;
  radius: number;
}

/**
 * Wall configuration (normalized coordinates 0-1)
 */
export interface WallConfig {
  x: number; // Center X (0-1)
  y: number; // Center Y (0-1)
  width: number; // Width (0-1)
  height: number; // Height (0-1)
}

/**
 * Room layout definition
 */
export interface RoomLayout {
  type: RoomLayoutType;
  name: string;
  description: string;
  spawnZones: SpawnZone[];
  safeZones: SafeZone[];
  walls?: WallConfig[]; // Optional walls for obstacles
  playerSpawnSafeRadius: number; // Minimum distance from player spawn
}

// ============================================
// Standard Room Layouts - 20+ variations
// ============================================

export const ROOM_LAYOUTS: RoomLayout[] = [
  // Open Arenas (3 variants)
  {
    type: "open_arena",
    name: "Central Arena",
    description: "Large open space with enemies spawning around the edges",
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
    type: "open_arena",
    name: "Scattered Arena",
    description: "Open space with enemies scattered throughout",
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
    type: "open_arena",
    name: "Ring Formation",
    description: "Enemies form a ring around the player",
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
    type: "narrow_corridor",
    name: "Vertical Corridor",
    description: "Narrow vertical path with enemies blocking the way",
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
    type: "narrow_corridor",
    name: "Horizontal Corridor",
    description: "Wide horizontal corridor with flanking positions",
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
    type: "narrow_corridor",
    name: "Diagonal Run",
    description: "Diagonal path with enemies positioned along it",
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
    type: "split_arena",
    name: "Left-Right Split",
    description: "Two groups on opposite sides with center wall",
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
    walls: [{ x: 0.5, y: 0.35, width: WALL_W1, height: WALL_H3 }],
    playerSpawnSafeRadius: 0.22,
  },
  {
    type: "split_arena",
    name: "Top-Bottom Split",
    description: "Enemies in upper section with horizontal barrier",
    spawnZones: [
      { x: 0.3, y: 0.2, radius: 0.18, weight: 1.2 },
      { x: 0.7, y: 0.2, radius: 0.18, weight: 1.2 },
      { x: 0.5, y: 0.35, radius: 0.2, weight: 1.5 },
      { x: 0.5, y: 0.55, radius: 0.15, weight: 0.8 },
    ],
    safeZones: [{ x: 0.5, y: 0.9, radius: 0.15 }],
    walls: [{ x: 0.5, y: 0.48, width: WALL_W2, height: WALL_H1 }],
    playerSpawnSafeRadius: 0.3,
  },

  // Corner Rooms (2 variants) - with corner cover
  {
    type: "corner_rooms",
    name: "Four Corners",
    description: "Enemies in corners with center pillars",
    spawnZones: [
      { x: 0.15, y: 0.2, radius: 0.12, weight: 1 },
      { x: 0.85, y: 0.2, radius: 0.12, weight: 1 },
      { x: 0.15, y: 0.65, radius: 0.12, weight: 1 },
      { x: 0.85, y: 0.65, radius: 0.12, weight: 1 },
    ],
    safeZones: [{ x: 0.5, y: 0.5, radius: 0.2 }],
    walls: [
      { x: 0.35, y: 0.4, width: WALL_W1, height: WALL_H1 },
      { x: 0.65, y: 0.4, width: WALL_W1, height: WALL_H1 },
    ],
    playerSpawnSafeRadius: 0.2,
  },
  {
    type: "corner_rooms",
    name: "Corners Plus Center",
    description: "Enemies in corners with center pillar",
    spawnZones: [
      { x: 0.2, y: 0.22, radius: 0.1, weight: 0.8 },
      { x: 0.8, y: 0.22, radius: 0.1, weight: 0.8 },
      { x: 0.2, y: 0.6, radius: 0.1, weight: 0.8 },
      { x: 0.8, y: 0.6, radius: 0.1, weight: 0.8 },
      { x: 0.5, y: 0.38, radius: 0.18, weight: 1.5 },
    ],
    safeZones: [{ x: 0.5, y: 0.85, radius: 0.12 }],
    walls: [{ x: 0.5, y: 0.42, width: WALL_W1, height: WALL_H1 }],
    playerSpawnSafeRadius: 0.25,
  },

  // Maze Lite (2 variants) - with walls for cover
  {
    type: "maze_lite",
    name: "Cover Points",
    description: "Side pillars provide cover for kiting",
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
      { x: 0.3, y: 0.38, width: WALL_W1, height: WALL_H1 },
      { x: 0.7, y: 0.38, width: WALL_W1, height: WALL_H1 },
    ],
    playerSpawnSafeRadius: 0.2,
  },
  {
    type: "maze_lite",
    name: "Scattered Pockets",
    description: "Small groups spread throughout the room with wall barriers",
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
      { x: 0.5, y: 0.4, width: WALL_W1, height: WALL_H2 },
      { x: WALL_X_LEFT_PASSAGE, y: 0.45, width: WALL_W1, height: WALL_H1 },
      { x: WALL_X_RIGHT_PASSAGE, y: 0.35, width: WALL_W1, height: WALL_H1 },
    ],
    playerSpawnSafeRadius: 0.22,
  },

  // Gauntlet (2 variants) - with side walls
  {
    type: "gauntlet",
    name: "Side Runners",
    description: "Enemies along both sides with corridor walls",
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
      { x: WALL_X_LEFT_CENTER, y: 0.35, width: WALL_W1, height: WALL_H3 },
      { x: WALL_X_RIGHT_CENTER, y: 0.35, width: WALL_W1, height: WALL_H3 },
    ],
    playerSpawnSafeRadius: 0.18,
  },
  {
    type: "gauntlet",
    name: "Forward March",
    description: "Enemies advancing with barrier cover",
    spawnZones: [
      { x: 0.35, y: 0.18, radius: 0.12, weight: 1.2 },
      { x: 0.65, y: 0.18, radius: 0.12, weight: 1.2 },
      { x: 0.5, y: 0.32, radius: 0.15, weight: 1 },
      { x: 0.3, y: 0.45, radius: 0.1, weight: 0.8 },
      { x: 0.7, y: 0.45, radius: 0.1, weight: 0.8 },
    ],
    safeZones: [{ x: 0.5, y: 0.82, radius: 0.15 }],
    walls: [
      { x: 0.5, y: 0.55, width: WALL_W2, height: WALL_H1 },
      { x: WALL_X_LEFT_PASSAGE, y: 0.4, width: WALL_W1, height: WALL_H1 },
      { x: WALL_X_RIGHT_PASSAGE, y: 0.4, width: WALL_W1, height: WALL_H1 },
    ],
    playerSpawnSafeRadius: 0.28,
  },

  // Ambush (1 variant - special) - with trap corridor
  {
    type: "ambush",
    name: "Pincer Attack",
    description: "Enemies spawn from sides with corridor walls",
    spawnZones: [
      { x: 0.1, y: 0.35, radius: 0.08, weight: 1 },
      { x: 0.1, y: 0.55, radius: 0.08, weight: 1 },
      { x: 0.9, y: 0.35, radius: 0.08, weight: 1 },
      { x: 0.9, y: 0.55, radius: 0.08, weight: 1 },
      { x: 0.5, y: 0.2, radius: 0.15, weight: 1.2 },
    ],
    safeZones: [{ x: 0.5, y: 0.75, radius: 0.2 }],
    walls: [
      { x: WALL_X_LEFT_PASSAGE, y: 0.45, width: WALL_W1, height: WALL_H2 },
      { x: WALL_X_RIGHT_PASSAGE, y: 0.45, width: WALL_W1, height: WALL_H2 },
      { x: 0.5, y: 0.6, width: WALL_W1, height: WALL_H1 },
    ],
    playerSpawnSafeRadius: 0.2,
  },

  // Circular Formation (1 variant) - with center pillar
  {
    type: "open_arena",
    name: "Circular Siege",
    description: "Enemies arranged in circle with center obstacle",
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
    walls: [{ x: 0.5, y: 0.42, width: WALL_W1, height: WALL_H1 }],
    playerSpawnSafeRadius: 0.25,
  },

  // Wave Formation (2 variants)
  {
    type: "gauntlet",
    name: "Advancing Wave",
    description: "Enemies in rows advancing toward player",
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
    type: "gauntlet",
    name: "Staggered Lines",
    description: "Multiple staggered enemy lines",
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
    type: "split_arena",
    name: "Crossfire",
    description: "Enemies positioned for crossfire tactics",
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
    type: "corner_rooms",
    name: "Defensive Perimeter",
    description: "Enemies positioned defensively around the room",
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
    type: "maze_lite",
    name: "Central Nexus",
    description: "Enemies converge from multiple points toward center",
    spawnZones: [
      { x: 0.5, y: 0.28, radius: 0.18, weight: 2 },
      { x: 0.2, y: 0.25, radius: 0.1, weight: 0.8 },
      { x: 0.8, y: 0.25, radius: 0.1, weight: 0.8 },
      { x: 0.25, y: 0.5, radius: 0.1, weight: 0.8 },
      { x: 0.75, y: 0.5, radius: 0.1, weight: 0.8 },
    ],
    safeZones: [{ x: 0.5, y: 0.85, radius: 0.15 }],
    playerSpawnSafeRadius: 0.25,
  },
];

// ============================================
// Chokepoint Layouts - wall-heavy designs
// ============================================

/**
 * Chokepoint layouts - wall-heavy designs with narrow passages
 * These create tactical gameplay with predictable wall positions
 * All walls are positioned with y < 0.70 to keep bottom area clear for player spawn
 */
export const CHOKEPOINT_LAYOUTS: RoomLayout[] = [
  // The Funnel - side pillars guide movement through center
  {
    type: "narrow_corridor",
    name: "The Funnel",
    description: "Side pillars guide movement through center",
    spawnZones: [
      { x: 0.5, y: 0.2, radius: 0.2, weight: 1.5 },
      { x: 0.5, y: 0.4, radius: 0.18, weight: 1 },
      { x: 0.35, y: 0.55, radius: 0.1, weight: 0.8 },
      { x: 0.65, y: 0.55, radius: 0.1, weight: 0.8 },
    ],
    safeZones: [{ x: 0.5, y: 0.9, radius: 0.15 }],
    walls: [
      { x: WALL_X_LEFT_EDGE, y: 0.35, width: WALL_W1, height: WALL_H2 },
      { x: WALL_X_RIGHT_EDGE, y: 0.35, width: WALL_W1, height: WALL_H2 },
    ],
    playerSpawnSafeRadius: 0.25,
  },

  // Corridor Split - center divider forces left/right choice
  {
    type: "split_arena",
    name: "Corridor Split",
    description: "Center wall splits arena into two paths",
    spawnZones: [
      { x: 0.25, y: 0.25, radius: 0.15, weight: 1.2 },
      { x: 0.75, y: 0.25, radius: 0.15, weight: 1.2 },
      { x: 0.25, y: 0.5, radius: 0.12, weight: 1 },
      { x: 0.75, y: 0.5, radius: 0.12, weight: 1 },
    ],
    safeZones: [{ x: 0.5, y: 0.9, radius: 0.15 }],
    walls: [{ x: 0.5, y: 0.38, width: WALL_W1, height: WALL_H4 }],
    playerSpawnSafeRadius: 0.25,
  },

  // Barricades - staggered barriers create weaving path (2 walls, well spaced)
  {
    type: "maze_lite",
    name: "Barricades",
    description: "Staggered barriers create a weaving path",
    spawnZones: [
      { x: 0.25, y: 0.15, radius: 0.12, weight: 1 },
      { x: 0.75, y: 0.15, radius: 0.12, weight: 1 },
      { x: 0.5, y: 0.35, radius: 0.15, weight: 1.2 },
      { x: 0.25, y: 0.5, radius: 0.1, weight: 0.8 },
      { x: 0.75, y: 0.5, radius: 0.1, weight: 0.8 },
    ],
    safeZones: [{ x: 0.5, y: 0.9, radius: 0.15 }],
    walls: [
      { x: 0.3, y: 0.25, width: WALL_W1, height: WALL_H1 },
      { x: 0.7, y: 0.5, width: WALL_W1, height: WALL_H1 },
    ],
    playerSpawnSafeRadius: 0.25,
  },

  // Fortress - central obstacle forces flanking movement
  {
    type: "corner_rooms",
    name: "Fortress",
    description: "Central obstacle forces flanking movement",
    spawnZones: [
      { x: 0.2, y: 0.2, radius: 0.12, weight: 1.2 },
      { x: 0.8, y: 0.2, radius: 0.12, weight: 1.2 },
      { x: 0.5, y: 0.15, radius: 0.15, weight: 1 },
      { x: 0.2, y: 0.5, radius: 0.1, weight: 0.8 },
      { x: 0.8, y: 0.5, radius: 0.1, weight: 0.8 },
    ],
    safeZones: [{ x: 0.5, y: 0.9, radius: 0.15 }],
    walls: [{ x: 0.5, y: 0.38, width: WALL_W2, height: WALL_H2 }],
    playerSpawnSafeRadius: 0.25,
  },

  // Pinch Points - center obstacle with side pillars (3 walls, well spaced)
  {
    type: "gauntlet",
    name: "Pinch Points",
    description: "Center obstacle creates tactical positioning",
    spawnZones: [
      { x: 0.5, y: 0.15, radius: 0.18, weight: 1.5 },
      { x: 0.25, y: 0.3, radius: 0.1, weight: 1 },
      { x: 0.75, y: 0.3, radius: 0.1, weight: 1 },
      { x: 0.5, y: 0.5, radius: 0.12, weight: 1 },
    ],
    safeZones: [{ x: 0.5, y: 0.9, radius: 0.15 }],
    walls: [
      { x: WALL_X_LEFT_PASSAGE, y: 0.25, width: WALL_W1, height: WALL_H1 },
      { x: 0.5, y: 0.45, width: WALL_W1, height: WALL_H1 },
      { x: WALL_X_RIGHT_PASSAGE, y: 0.25, width: WALL_W1, height: WALL_H1 },
    ],
    playerSpawnSafeRadius: 0.25,
  },

  // The Gauntlet - side pillars create tactical lanes
  {
    type: "gauntlet",
    name: "The Gauntlet",
    description: "Side pillars create tactical lanes",
    spawnZones: [
      { x: 0.5, y: 0.15, radius: 0.15, weight: 1.5 },
      { x: 0.5, y: 0.3, radius: 0.15, weight: 1.2 },
      { x: 0.5, y: 0.45, radius: 0.15, weight: 1 },
      { x: 0.4, y: 0.58, radius: 0.1, weight: 0.8 },
      { x: 0.6, y: 0.58, radius: 0.1, weight: 0.8 },
    ],
    safeZones: [{ x: 0.5, y: 0.9, radius: 0.15 }],
    walls: [
      { x: WALL_X_LEFT_PASSAGE, y: 0.35, width: WALL_W1, height: WALL_H2 },
      { x: WALL_X_RIGHT_PASSAGE, y: 0.35, width: WALL_W1, height: WALL_H2 },
    ],
    playerSpawnSafeRadius: 0.22,
  },
];

// ============================================
// Special Room Layouts
// ============================================

/**
 * Boss room layouts
 */
export const BOSS_LAYOUTS: RoomLayout[] = [
  {
    type: "boss_arena",
    name: "Boss Arena",
    description: "Large circular arena for boss fights",
    spawnZones: [{ x: 0.5, y: 0.35, radius: 0.05, weight: 1 }],
    safeZones: [{ x: 0.5, y: 0.85, radius: 0.18 }],
    playerSpawnSafeRadius: 0.35,
  },
];

/**
 * Mini-boss room layouts
 */
export const MINI_BOSS_LAYOUTS: RoomLayout[] = [
  {
    type: "mini_boss_pit",
    name: "Mini-Boss Pit",
    description: "Tighter arena for mini-boss encounters",
    spawnZones: [{ x: 0.5, y: 0.4, radius: 0.1, weight: 1 }],
    safeZones: [{ x: 0.5, y: 0.85, radius: 0.15 }],
    playerSpawnSafeRadius: 0.3,
  },
];
