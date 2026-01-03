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
 * WallGroup - Manages all walls in the current room
 *
 * Features:
 * - Creates walls from normalized configurations
 * - Provides static physics group for collision detection
 * - Cleans up walls between rooms
 */
export default class WallGroup extends Phaser.Physics.Arcade.StaticGroup {
  private screenWidth: number
  private screenHeight: number
  private wallColor: number = 0x444444

  constructor(scene: Phaser.Scene, screenWidth: number, screenHeight: number) {
    super(scene.physics.world, scene)
    this.screenWidth = screenWidth
    this.screenHeight = screenHeight
  }

  /**
   * Set wall color based on chapter theme
   */
  setColor(color: number): void {
    this.wallColor = color
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

      const wall = new Wall(this.scene, x, y, width, height, this.wallColor)
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
