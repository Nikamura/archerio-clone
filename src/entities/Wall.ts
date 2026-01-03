import Phaser from 'phaser'

/**
 * Wall entity - static obstacle that blocks player, enemies, and bullets
 *
 * Features:
 * - Rectangular shape with configurable dimensions
 * - Static physics body (immovable)
 * - Collision with player, enemies, and bullets
 * - Bullets with bouncy_wall ability bounce off walls
 * - Bullets with through_wall ability pass through
 * - Optional texture support with TileSprite for repeating patterns
 * - Visible border for clarity against backgrounds
 */
export default class Wall {
  private wallGraphics: Phaser.GameObjects.Rectangle | Phaser.GameObjects.TileSprite
  private borderGraphics: Phaser.GameObjects.Graphics
  private _x: number
  private _y: number
  private _width: number
  private _height: number

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    color: number = 0x444444,
    textureKey?: string,
    borderColor: number = 0x222222
  ) {
    this._x = x
    this._y = y
    this._width = width
    this._height = height

    // Use texture if provided and exists, otherwise fallback to colored rectangle
    if (textureKey && scene.textures.exists(textureKey)) {
      // TileSprite repeats the texture to fill the wall area
      this.wallGraphics = scene.add.tileSprite(x, y, width, height, textureKey)
    } else {
      // Fallback to colored rectangle
      this.wallGraphics = scene.add.rectangle(x, y, width, height, color)
    }

    // Add visible border around the wall for clarity
    this.borderGraphics = scene.add.graphics()
    const borderWidth = 3
    // Draw outer dark border
    this.borderGraphics.lineStyle(borderWidth, borderColor, 1)
    this.borderGraphics.strokeRect(x - width / 2, y - height / 2, width, height)
    // Draw inner highlight for 3D effect
    this.borderGraphics.lineStyle(1, 0x666666, 0.5)
    this.borderGraphics.strokeRect(x - width / 2 + 2, y - height / 2 + 2, width - 4, height - 4)

    // Add physics to the wallGraphics (Rectangle/TileSprite have proper bounds methods)
    scene.physics.add.existing(this.wallGraphics, true) // true = static body

    // Set depth - above floor, below entities
    this.wallGraphics.setDepth(1)
    this.borderGraphics.setDepth(1)
  }

  get x(): number {
    return this._x
  }

  get y(): number {
    return this._y
  }

  get width(): number {
    return this._width
  }

  get height(): number {
    return this._height
  }

  /**
   * Get the physics body for collision detection
   */
  getBody(): Phaser.Physics.Arcade.StaticBody {
    return this.wallGraphics.body as Phaser.Physics.Arcade.StaticBody
  }

  /**
   * Get the game object with the physics body
   */
  getPhysicsObject(): Phaser.GameObjects.Rectangle | Phaser.GameObjects.TileSprite {
    return this.wallGraphics
  }

  /**
   * Check if a point is inside the wall
   */
  containsPoint(px: number, py: number): boolean {
    const halfWidth = this._width / 2
    const halfHeight = this._height / 2
    return (
      px >= this._x - halfWidth &&
      px <= this._x + halfWidth &&
      py >= this._y - halfHeight &&
      py <= this._y + halfHeight
    )
  }

  /**
   * Destroy the wall and all its graphics
   */
  destroy(): void {
    this.wallGraphics.destroy()
    this.borderGraphics.destroy()
  }
}
