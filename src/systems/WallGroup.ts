import Phaser from "phaser";
import Wall from "../entities/Wall";

/**
 * Wall texture tile size in pixels.
 * All wall dimensions are snapped to multiples of this value for proper texture alignment.
 */
export const WALL_TILE_SIZE = 64;

/**
 * Threshold for detecting parallel lines in intersection calculations.
 * Lines with cross product below this value are considered parallel.
 */
const PARALLEL_LINE_THRESHOLD = 0.0001;

/**
 * Snap a value to the nearest multiple of WALL_TILE_SIZE.
 * Minimum value is WALL_TILE_SIZE to ensure walls are always at least 1 tile.
 */
function snapToTileSize(value: number): number {
  const snapped = Math.round(value / WALL_TILE_SIZE) * WALL_TILE_SIZE;
  return Math.max(WALL_TILE_SIZE, snapped);
}

/**
 * Wall configuration for room layouts
 */
export interface WallConfig {
  x: number; // Normalized X position (0-1)
  y: number; // Normalized Y position (0-1)
  width: number; // Normalized width (0-1)
  height: number; // Normalized height (0-1)
}

/**
 * Wall texture mapping for chapters (default theme)
 */
const CHAPTER_WALL_TEXTURES: Record<number, string> = {
  1: "wall_dungeon",
  2: "wall_forest",
  3: "wall_ice",
  4: "wall_lava",
  5: "wall_shadow",
};

/**
 * Border colors for each chapter to make walls stand out from backgrounds
 */
const CHAPTER_BORDER_COLORS: Record<number, number> = {
  1: 0x1a1a1a, // Dark gray for dungeon
  2: 0x2d4a2d, // Dark green for forest
  3: 0x1a3a5a, // Dark blue for ice
  4: 0x4a1a0a, // Dark red-brown for lava
  5: 0x2a1a3a, // Dark purple for shadow
};

/**
 * WallGroup - Manages all walls in the current room
 *
 * Features:
 * - Creates walls from normalized configurations
 * - Provides static physics group for collision detection
 * - Cleans up walls between rooms
 */
export default class WallGroup extends Phaser.Physics.Arcade.StaticGroup {
  private screenWidth: number;
  private screenHeight: number;
  private wallColor: number = 0x444444;
  private borderColor: number = 0x222222;
  private textureKey: string | undefined;
  private chapterId: number = 1;
  private walls: Wall[] = [];

  constructor(scene: Phaser.Scene, screenWidth: number, screenHeight: number) {
    super(scene.physics.world, scene);
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
  }

  /**
   * Set wall color based on chapter theme (fallback for no texture)
   */
  setColor(color: number): void {
    this.wallColor = color;
  }

  /**
   * Set wall texture based on chapter ID
   * @param chapterId Chapter ID (1-5)
   */
  setTexture(chapterId: number | string): void {
    if (typeof chapterId === "number") {
      this.chapterId = chapterId;
      this.updateTextureKey();
    }
  }

  /**
   * Update texture key and border color based on current chapter
   */
  private updateTextureKey(): void {
    this.textureKey = CHAPTER_WALL_TEXTURES[this.chapterId];
    this.borderColor = CHAPTER_BORDER_COLORS[this.chapterId] || 0x222222;
  }

  /**
   * Create walls from configuration array
   * Wall dimensions are snapped to multiples of WALL_TILE_SIZE for proper texture alignment
   */
  createWalls(configs: WallConfig[]): void {
    // Clear existing walls
    this.clearWalls();

    for (const config of configs) {
      // Convert normalized coordinates to screen coordinates
      // Snap width and height to tile size multiples for texture alignment
      const width = snapToTileSize(config.width * this.screenWidth);
      const height = snapToTileSize(config.height * this.screenHeight);

      // Calculate position (center of wall) and snap to half-tile for better alignment
      const halfTile = WALL_TILE_SIZE / 2;
      const x = Math.round((config.x * this.screenWidth) / halfTile) * halfTile;
      const y = Math.round((config.y * this.screenHeight) / halfTile) * halfTile;

      const wall = new Wall(
        this.scene,
        x,
        y,
        width,
        height,
        this.wallColor,
        this.textureKey,
        this.borderColor,
      );
      this.walls.push(wall);
      // Add the physics object to the StaticGroup for collision detection
      this.add(wall.getPhysicsObject());
    }
  }

  /**
   * Clear all walls (called between rooms)
   */
  clearWalls(): void {
    // Destroy wall containers (which destroys their children)
    for (const wall of this.walls) {
      wall.destroy();
    }
    this.walls = [];
    // Clear the physics group
    this.clear(true, true);
  }

  /**
   * Update screen dimensions
   */
  setDimensions(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
  }

  /**
   * Get all walls as an array
   */
  getWalls(): Wall[] {
    return this.walls;
  }

  /**
   * Get the bounding box encompassing all walls (for early-exit optimizations)
   * Returns null if no walls exist
   */
  getBounds(): { left: number; right: number; top: number; bottom: number } | null {
    if (this.walls.length === 0) return null;

    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;

    for (const wall of this.walls) {
      const halfW = wall.width / 2;
      const halfH = wall.height / 2;
      left = Math.min(left, wall.x - halfW);
      right = Math.max(right, wall.x + halfW);
      top = Math.min(top, wall.y - halfH);
      bottom = Math.max(bottom, wall.y + halfH);
    }

    return { left, right, top, bottom };
  }

  /**
   * Check if a point is inside any wall
   * Used to prevent joystick creation on wall areas
   */
  containsPoint(x: number, y: number): boolean {
    for (const wall of this.walls) {
      if (wall.containsPoint(x, y)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if there's a clear line of sight between two points
   * Returns true if NO wall blocks the line, false if any wall blocks it
   */
  hasLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
    // No walls means clear line of sight
    if (!this.walls || this.walls.length === 0) {
      return true;
    }

    for (const wall of this.walls) {
      if (this.lineIntersectsRect(x1, y1, x2, y2, wall)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if a line segment intersects a rectangle (wall)
   * Uses line-segment vs rectangle edge intersection checks
   */
  private lineIntersectsRect(x1: number, y1: number, x2: number, y2: number, wall: Wall): boolean {
    const halfW = wall.width / 2;
    const halfH = wall.height / 2;
    const left = wall.x - halfW;
    const right = wall.x + halfW;
    const top = wall.y - halfH;
    const bottom = wall.y + halfH;

    // Check if line segment intersects any of the 4 edges of the rectangle
    // Left edge
    if (this.lineSegmentsIntersect(x1, y1, x2, y2, left, top, left, bottom)) {
      return true;
    }
    // Right edge
    if (this.lineSegmentsIntersect(x1, y1, x2, y2, right, top, right, bottom)) {
      return true;
    }
    // Top edge
    if (this.lineSegmentsIntersect(x1, y1, x2, y2, left, top, right, top)) {
      return true;
    }
    // Bottom edge
    if (this.lineSegmentsIntersect(x1, y1, x2, y2, left, bottom, right, bottom)) {
      return true;
    }

    // Also check if either endpoint is inside the rectangle
    // This handles the case where the line is entirely inside the wall
    if (
      (x1 >= left && x1 <= right && y1 >= top && y1 <= bottom) ||
      (x2 >= left && x2 <= right && y2 >= top && y2 <= bottom)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Check if two line segments intersect
   * Uses cross product method for efficient intersection detection
   */
  private lineSegmentsIntersect(
    x1: number,
    y1: number,
    x2: number,
    y2: number, // Line 1
    x3: number,
    y3: number,
    x4: number,
    y4: number, // Line 2
  ): boolean {
    // Calculate direction vectors
    const d1x = x2 - x1;
    const d1y = y2 - y1;
    const d2x = x4 - x3;
    const d2y = y4 - y3;

    // Cross product of direction vectors
    const cross = d1x * d2y - d1y * d2x;

    // Lines are parallel if cross product is near zero
    if (Math.abs(cross) < PARALLEL_LINE_THRESHOLD) {
      return false;
    }

    // Calculate parameters t and u
    const dx = x3 - x1;
    const dy = y3 - y1;

    const t = (dx * d2y - dy * d2x) / cross;
    const u = (dx * d1y - dy * d1x) / cross;

    // Lines intersect if both parameters are between 0 and 1
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }
}
