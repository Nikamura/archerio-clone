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
 */
export default class Wall extends Phaser.GameObjects.Rectangle {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    color: number = 0x444444
  ) {
    super(scene, x, y, width, height, color)

    scene.add.existing(this)
    scene.physics.add.existing(this, true) // true = static body

    // Set up physics body to match rectangle size
    const body = this.body as Phaser.Physics.Arcade.StaticBody
    body.setSize(width, height)

    // Visual styling
    this.setStrokeStyle(2, 0x666666)
    this.setDepth(1) // Above floor, below entities
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
