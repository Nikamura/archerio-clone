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
export default class Wall extends Phaser.GameObjects.Container {
  private wallGraphics: Phaser.GameObjects.Rectangle | Phaser.GameObjects.TileSprite
  private borderGraphics: Phaser.GameObjects.Graphics

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
    super(scene, x, y)

    // Use texture if provided and exists, otherwise fallback to colored rectangle
    if (textureKey && scene.textures.exists(textureKey)) {
      // TileSprite repeats the texture to fill the wall area
      this.wallGraphics = scene.add.tileSprite(0, 0, width, height, textureKey)
      this.add(this.wallGraphics)
    } else {
      // Fallback to colored rectangle
      this.wallGraphics = scene.add.rectangle(0, 0, width, height, color)
      this.add(this.wallGraphics)
    }

    // Add visible border around the wall for clarity
    this.borderGraphics = scene.add.graphics()
    const borderWidth = 3
    // Draw outer dark border
    this.borderGraphics.lineStyle(borderWidth, borderColor, 1)
    this.borderGraphics.strokeRect(-width / 2, -height / 2, width, height)
    // Draw inner highlight for 3D effect
    this.borderGraphics.lineStyle(1, 0x666666, 0.5)
    this.borderGraphics.strokeRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4)
    this.add(this.borderGraphics)

    scene.add.existing(this)
    scene.physics.add.existing(this, true) // true = static body

    // Set up physics body to match wall size
    const body = this.body as Phaser.Physics.Arcade.StaticBody
    body.setSize(width, height)

    this.setDepth(1) // Above floor, below entities

    // Set container size for containsPoint check
    this.setSize(width, height)
  }

  /**
   * Check if a point is inside the wall
   */
  containsPoint(x: number, y: number): boolean {
    const halfWidth = this.width / 2
    const halfHeight = this.height / 2
    return (
      x >= this.x - halfWidth &&
      x <= this.x + halfWidth &&
      y >= this.y - halfHeight &&
      y <= this.y + halfHeight
    )
  }
}
