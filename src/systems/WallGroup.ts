import Phaser from 'phaser'
import Wall from '../entities/Wall'

/**
 * Wall configuration for room layouts
 */
export interface WallConfig {
  x: number // Normalized X position (0-1)
  y: number // Normalized Y position (0-1)
  width: number // Normalized width (0-1)
  height: number // Normalized height (0-1)
}

/**
 * Wall texture mapping for chapters (default theme)
 */
const CHAPTER_WALL_TEXTURES: Record<number, string> = {
  1: 'wall_dungeon',
  2: 'wall_forest',
  3: 'wall_ice',
  4: 'wall_lava',
  5: 'wall_shadow',
}

/**
 * Border colors for each chapter to make walls stand out from backgrounds
 */
const CHAPTER_BORDER_COLORS: Record<number, number> = {
  1: 0x1a1a1a, // Dark gray for dungeon
  2: 0x2d4a2d, // Dark green for forest
  3: 0x1a3a5a, // Dark blue for ice
  4: 0x4a1a0a, // Dark red-brown for lava
  5: 0x2a1a3a, // Dark purple for shadow
}

/**
 * Wall texture mapping for purchasable themes (per-chapter variants)
 */
const THEME_WALL_TEXTURES: Record<string, Record<number, string>> = {
  vaporwave: {
    1: 'wall_vaporwave_dungeon',
    2: 'wall_vaporwave_forest',
    3: 'wall_vaporwave_ice',
    4: 'wall_vaporwave_lava',
    5: 'wall_vaporwave_shadow',
  },
  lotr: {
    1: 'wall_lotr_dungeon',
    2: 'wall_lotr_forest',
    3: 'wall_lotr_ice',
    4: 'wall_lotr_lava',
    5: 'wall_lotr_shadow',
  },
  strangerThings: {
    1: 'wall_st_dungeon',
    2: 'wall_st_forest',
    3: 'wall_st_ice',
    4: 'wall_st_lava',
    5: 'wall_st_shadow',
  },
  dungeon: {
    1: 'wall_dungeon',
    2: 'wall_dungeon',
    3: 'wall_dungeon',
    4: 'wall_dungeon',
    5: 'wall_dungeon',
  },
}

/**
 * WallGroup - Manages all walls in the current room
 *
 * Features:
 * - Creates walls from normalized configurations
 * - Provides static physics group for collision detection
 * - Cleans up walls between rooms
 * - Supports themed wall textures
 */
export default class WallGroup extends Phaser.Physics.Arcade.StaticGroup {
  private screenWidth: number
  private screenHeight: number
  private wallColor: number = 0x444444
  private borderColor: number = 0x222222
  private textureKey: string | undefined
  private chapterId: number = 1
  private themeName: string | undefined
  private walls: Wall[] = []

  constructor(scene: Phaser.Scene, screenWidth: number, screenHeight: number) {
    super(scene.physics.world, scene)
    this.screenWidth = screenWidth
    this.screenHeight = screenHeight
  }

  /**
   * Set wall color based on chapter theme (fallback for no texture)
   */
  setColor(color: number): void {
    this.wallColor = color
  }

  /**
   * Set wall texture based on chapter ID
   * @param chapterId Chapter ID (1-5)
   */
  setTexture(chapterId: number | string): void {
    if (typeof chapterId === 'number') {
      this.chapterId = chapterId
      this.updateTextureKey()
    }
  }

  /**
   * Set purchasable theme (e.g., 'vaporwave')
   * Theme walls override chapter-based walls
   */
  setTheme(themeName: string | undefined): void {
    this.themeName = themeName
    this.updateTextureKey()
  }

  /**
   * Update texture key and border color based on current chapter and theme
   */
  private updateTextureKey(): void {
    if (this.themeName && THEME_WALL_TEXTURES[this.themeName]) {
      // Use theme-specific texture for current chapter
      this.textureKey = THEME_WALL_TEXTURES[this.themeName][this.chapterId]
    } else {
      // Use default chapter texture
      this.textureKey = CHAPTER_WALL_TEXTURES[this.chapterId]
    }
    // Update border color for chapter
    this.borderColor = CHAPTER_BORDER_COLORS[this.chapterId] || 0x222222
  }

  /**
   * Create walls from configuration array
   */
  createWalls(configs: WallConfig[]): void {
    // Clear existing walls
    this.clearWalls()

    for (const config of configs) {
      // Convert normalized coordinates to screen coordinates
      const x = config.x * this.screenWidth
      const y = config.y * this.screenHeight
      const width = config.width * this.screenWidth
      const height = config.height * this.screenHeight

      const wall = new Wall(this.scene, x, y, width, height, this.wallColor, this.textureKey, this.borderColor)
      this.walls.push(wall)
      // Add the physics object to the StaticGroup for collision detection
      this.add(wall.getPhysicsObject())
    }
  }

  /**
   * Clear all walls (called between rooms)
   */
  clearWalls(): void {
    // Destroy wall containers (which destroys their children)
    for (const wall of this.walls) {
      wall.destroy()
    }
    this.walls = []
    // Clear the physics group
    this.clear(true, true)
  }

  /**
   * Update screen dimensions
   */
  setDimensions(width: number, height: number): void {
    this.screenWidth = width
    this.screenHeight = height
  }

  /**
   * Get all walls as an array
   */
  getWalls(): Wall[] {
    return this.walls
  }

  /**
   * Check if a point is inside any wall
   * Used to prevent joystick creation on wall areas
   */
  containsPoint(x: number, y: number): boolean {
    for (const wall of this.walls) {
      if (wall.containsPoint(x, y)) {
        return true
      }
    }
    return false
  }
}
