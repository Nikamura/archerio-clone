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
 * Wall texture mapping for chapters and themes
 */
const WALL_TEXTURES: Record<number | string, string> = {
  // Chapter themes (ChapterId 1-5)
  1: 'wall_dungeon',
  2: 'wall_forest',
  3: 'wall_ice',
  4: 'wall_lava',
  5: 'wall_shadow',
  // Purchasable themes
  'vaporwave': 'wall_vaporwave',
  'dungeon': 'wall_dungeon',
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
  private textureKey: string | undefined

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
   * Set wall texture based on chapter or theme
   * @param chapterOrTheme Chapter ID (1-5) or theme name (e.g., 'vaporwave')
   */
  setTexture(chapterOrTheme: number | string): void {
    this.textureKey = WALL_TEXTURES[chapterOrTheme]
  }

  /**
   * Create walls from configuration array
   */
  createWalls(configs: WallConfig[]): void {
    // Clear existing walls
    this.clear(true, true)

    for (const config of configs) {
      // Convert normalized coordinates to screen coordinates
      const x = config.x * this.screenWidth
      const y = config.y * this.screenHeight
      const width = config.width * this.screenWidth
      const height = config.height * this.screenHeight

      const wall = new Wall(this.scene, x, y, width, height, this.wallColor, this.textureKey)
      this.add(wall)
    }
  }

  /**
   * Clear all walls (called between rooms)
   */
  clearWalls(): void {
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
    return this.getChildren() as Wall[]
  }
}
