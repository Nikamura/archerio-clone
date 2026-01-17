/**
 * Editor Types
 *
 * Types shared between the editor and game for custom room layouts.
 */

import type { WallConfig, SpawnZone, SafeZone } from "../systems/room/RoomLayouts";

export type { WallConfig, SpawnZone, SafeZone };

/**
 * Custom room layout created in the editor
 */
export interface CustomRoomLayout {
  id: string;
  name: string;
  walls: WallConfig[];
  spawnZones: SpawnZone[];
  safeZones: SafeZone[];
  playerSpawnSafeRadius: number;
}

/**
 * Data structure stored in localStorage
 */
export interface CustomLayoutsData {
  version: 1;
  layouts: CustomRoomLayout[];
}

/**
 * Editor mode for different editing operations
 */
export type EditorMode = "walls" | "spawns" | "safe";

/**
 * Wall size presets (matching RoomLayouts.ts constants)
 */
export const WALL_WIDTHS = {
  W1: 0.171, // ~64px
  W2: 0.341, // ~128px
  W3: 0.512, // ~192px
} as const;

export const WALL_HEIGHTS = {
  H1: 0.096, // ~64px
  H2: 0.192, // ~128px
  H3: 0.288, // ~192px
  H4: 0.384, // ~256px
  H5: 0.48, // ~320px
} as const;

/**
 * Game canvas dimensions
 */
export const GAME_WIDTH = 375;
export const GAME_HEIGHT = 667;

/**
 * Grid tile size in pixels
 */
export const TILE_SIZE = 64;

/**
 * localStorage key for custom layouts
 */
export const STORAGE_KEY = "aura_archer_custom_layouts";

/**
 * Selection state for editor objects
 */
export interface EditorSelection {
  type: "wall" | "spawn" | "safe";
  index: number;
}

/**
 * Resize handle positions
 */
export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
