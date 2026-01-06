import Phaser from 'phaser'

/**
 * HitboxDebugRenderer - Draws hitbox outlines and sprite bounds for all physics bodies
 *
 * Shows both:
 * - Solid line: Actual hitbox (collision area)
 * - Dashed line: Sprite bounds (visual size)
 *
 * Color scheme:
 * - Player: Green (0x00ff00)
 * - Player bullets: Cyan (0x00ffff)
 * - Enemy bullets: Red (0xff0000)
 * - Enemies/Bosses: Orange (0xff8800)
 * - Pickups: Yellow (0xffff00)
 * - Doors: Magenta (0xff00ff)
 */
export default class HitboxDebugRenderer {
  private graphics: Phaser.GameObjects.Graphics
  private isEnabled: boolean = true
  private lineWidth: number = 1.5
  private alpha: number = 0.8
  private showSpriteBounds: boolean = true

  // Color constants
  private static readonly COLOR_PLAYER = 0x00ff00 // Green
  private static readonly COLOR_PLAYER_BULLET = 0x00ffff // Cyan
  private static readonly COLOR_ENEMY_BULLET = 0xff0000 // Red
  private static readonly COLOR_ENEMY = 0xff8800 // Orange
  private static readonly COLOR_BOSS = 0xff4400 // Darker orange for bosses
  private static readonly COLOR_PICKUP = 0xffff00 // Yellow
  private static readonly COLOR_DOOR = 0xff00ff // Magenta

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics()
    this.graphics.setDepth(1000) // Always on top
  }

  /**
   * Toggle hitbox rendering on/off
   */
  toggle(): boolean {
    this.isEnabled = !this.isEnabled
    if (!this.isEnabled) {
      this.graphics.clear()
    }
    return this.isEnabled
  }

  /**
   * Set enabled state
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
    if (!this.isEnabled) {
      this.graphics.clear()
    }
  }

  /**
   * Check if renderer is enabled
   */
  getEnabled(): boolean {
    return this.isEnabled
  }

  /**
   * Toggle sprite bounds visualization
   */
  toggleSpriteBounds(): boolean {
    this.showSpriteBounds = !this.showSpriteBounds
    return this.showSpriteBounds
  }

  /**
   * Render hitboxes for all game objects
   */
  render(
    player: Phaser.Physics.Arcade.Sprite | null,
    playerBullets: Phaser.Physics.Arcade.Group | null,
    enemyBullets: Phaser.Physics.Arcade.Group | null,
    enemies: Phaser.Physics.Arcade.Group | null,
    boss: Phaser.Physics.Arcade.Sprite | null,
    goldPickups: Phaser.Physics.Arcade.Group | null,
    healthPickups: Phaser.Physics.Arcade.Group | null,
    doors: Phaser.Physics.Arcade.Group | null
  ): void {
    if (!this.isEnabled) return

    this.graphics.clear()

    // Draw player
    if (player?.active && player.body) {
      this.drawSpriteDebug(player, HitboxDebugRenderer.COLOR_PLAYER)
    }

    // Draw player bullets
    if (playerBullets) {
      playerBullets.getChildren().forEach((child) => {
        const bullet = child as Phaser.Physics.Arcade.Sprite
        if (bullet.active && bullet.body) {
          this.drawSpriteDebug(bullet, HitboxDebugRenderer.COLOR_PLAYER_BULLET)
        }
      })
    }

    // Draw enemy bullets
    if (enemyBullets) {
      enemyBullets.getChildren().forEach((child) => {
        const bullet = child as Phaser.Physics.Arcade.Sprite
        if (bullet.active && bullet.body) {
          this.drawSpriteDebug(bullet, HitboxDebugRenderer.COLOR_ENEMY_BULLET)
        }
      })
    }

    // Draw enemies
    if (enemies) {
      enemies.getChildren().forEach((child) => {
        const enemy = child as Phaser.Physics.Arcade.Sprite
        if (enemy.active && enemy.body) {
          this.drawSpriteDebug(enemy, HitboxDebugRenderer.COLOR_ENEMY)
        }
      })
    }

    // Draw boss (separate since it may not be in enemies group)
    if (boss?.active && boss.body) {
      this.drawSpriteDebug(boss, HitboxDebugRenderer.COLOR_BOSS)
    }

    // Draw gold pickups
    if (goldPickups) {
      goldPickups.getChildren().forEach((child) => {
        const pickup = child as Phaser.Physics.Arcade.Sprite
        if (pickup.active && pickup.body) {
          this.drawSpriteDebug(pickup, HitboxDebugRenderer.COLOR_PICKUP)
        }
      })
    }

    // Draw health pickups
    if (healthPickups) {
      healthPickups.getChildren().forEach((child) => {
        const pickup = child as Phaser.Physics.Arcade.Sprite
        if (pickup.active && pickup.body) {
          this.drawSpriteDebug(pickup, HitboxDebugRenderer.COLOR_PICKUP)
        }
      })
    }

    // Draw doors
    if (doors) {
      doors.getChildren().forEach((child) => {
        const door = child as Phaser.Physics.Arcade.Sprite
        if (door.active && door.body) {
          this.drawSpriteDebug(door, HitboxDebugRenderer.COLOR_DOOR)
        }
      })
    }
  }

  /**
   * Draw both hitbox and sprite bounds for a sprite
   */
  private drawSpriteDebug(sprite: Phaser.Physics.Arcade.Sprite, color: number): void {
    // Draw sprite bounds first (underneath hitbox)
    if (this.showSpriteBounds) {
      this.drawSpriteBounds(sprite, color)
    }

    // Draw hitbox on top
    this.drawHitbox(sprite.body as Phaser.Physics.Arcade.Body, color)
  }

  /**
   * Draw sprite bounds (visual size) with dashed line
   */
  private drawSpriteBounds(sprite: Phaser.Physics.Arcade.Sprite, color: number): void {
    const displayWidth = sprite.displayWidth
    const displayHeight = sprite.displayHeight
    const x = sprite.x - displayWidth / 2
    const y = sprite.y - displayHeight / 2

    // Draw dashed rectangle for sprite bounds (lighter alpha)
    this.graphics.lineStyle(1, color, this.alpha * 0.4)
    this.drawDashedRect(x, y, displayWidth, displayHeight, 4, 4)
  }

  /**
   * Draw a dashed rectangle
   */
  private drawDashedRect(
    x: number,
    y: number,
    width: number,
    height: number,
    dashLength: number,
    gapLength: number
  ): void {
    // Top edge
    this.drawDashedLine(x, y, x + width, y, dashLength, gapLength)
    // Right edge
    this.drawDashedLine(x + width, y, x + width, y + height, dashLength, gapLength)
    // Bottom edge
    this.drawDashedLine(x + width, y + height, x, y + height, dashLength, gapLength)
    // Left edge
    this.drawDashedLine(x, y + height, x, y, dashLength, gapLength)
  }

  /**
   * Draw a dashed line between two points
   */
  private drawDashedLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    dashLength: number,
    gapLength: number
  ): void {
    const dx = x2 - x1
    const dy = y2 - y1
    const distance = Math.sqrt(dx * dx + dy * dy)
    const dashCount = Math.floor(distance / (dashLength + gapLength))
    const unitX = dx / distance
    const unitY = dy / distance

    for (let i = 0; i < dashCount; i++) {
      const startX = x1 + unitX * i * (dashLength + gapLength)
      const startY = y1 + unitY * i * (dashLength + gapLength)
      const endX = startX + unitX * dashLength
      const endY = startY + unitY * dashLength

      this.graphics.beginPath()
      this.graphics.moveTo(startX, startY)
      this.graphics.lineTo(endX, endY)
      this.graphics.strokePath()
    }
  }

  /**
   * Draw a single hitbox (handles both circular and rectangular bodies)
   */
  private drawHitbox(body: Phaser.Physics.Arcade.Body, color: number): void {
    this.graphics.lineStyle(this.lineWidth, color, this.alpha)

    if (body.isCircle) {
      // Circular hitbox
      const centerX = body.center.x
      const centerY = body.center.y
      const radius = body.halfWidth // For circles, halfWidth equals radius

      this.graphics.strokeCircle(centerX, centerY, radius)

      // Draw center point for precision
      this.graphics.fillStyle(color, this.alpha)
      this.graphics.fillCircle(centerX, centerY, 2)
    } else {
      // Rectangular hitbox
      const x = body.x
      const y = body.y
      const width = body.width
      const height = body.height

      this.graphics.strokeRect(x, y, width, height)

      // Draw center point
      this.graphics.fillStyle(color, this.alpha)
      this.graphics.fillCircle(x + width / 2, y + height / 2, 2)
    }
  }

  /**
   * Draw a custom group of sprites with a specific color
   */
  renderGroup(group: Phaser.Physics.Arcade.Group, color: number): void {
    if (!this.isEnabled) return

    group.getChildren().forEach((child) => {
      const sprite = child as Phaser.Physics.Arcade.Sprite
      if (sprite.active && sprite.body) {
        this.drawSpriteDebug(sprite, color)
      }
    })
  }

  /**
   * Draw a single sprite's hitbox with a specific color
   */
  renderSprite(sprite: Phaser.Physics.Arcade.Sprite, color: number): void {
    if (!this.isEnabled || !sprite.active || !sprite.body) return
    this.drawSpriteDebug(sprite, color)
  }

  /**
   * Clear all hitbox graphics
   */
  clear(): void {
    this.graphics.clear()
  }

  /**
   * Destroy the renderer
   */
  destroy(): void {
    this.graphics.destroy()
  }
}
