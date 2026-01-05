import Phaser from 'phaser'

/**
 * HitboxDebugRenderer - Draws hitbox outlines for all physics bodies
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

    // Draw player hitbox
    if (player?.active && player.body) {
      this.drawHitbox(player.body as Phaser.Physics.Arcade.Body, HitboxDebugRenderer.COLOR_PLAYER)
    }

    // Draw player bullets
    if (playerBullets) {
      playerBullets.getChildren().forEach((child) => {
        const bullet = child as Phaser.Physics.Arcade.Sprite
        if (bullet.active && bullet.body) {
          this.drawHitbox(bullet.body as Phaser.Physics.Arcade.Body, HitboxDebugRenderer.COLOR_PLAYER_BULLET)
        }
      })
    }

    // Draw enemy bullets
    if (enemyBullets) {
      enemyBullets.getChildren().forEach((child) => {
        const bullet = child as Phaser.Physics.Arcade.Sprite
        if (bullet.active && bullet.body) {
          this.drawHitbox(bullet.body as Phaser.Physics.Arcade.Body, HitboxDebugRenderer.COLOR_ENEMY_BULLET)
        }
      })
    }

    // Draw enemies
    if (enemies) {
      enemies.getChildren().forEach((child) => {
        const enemy = child as Phaser.Physics.Arcade.Sprite
        if (enemy.active && enemy.body) {
          this.drawHitbox(enemy.body as Phaser.Physics.Arcade.Body, HitboxDebugRenderer.COLOR_ENEMY)
        }
      })
    }

    // Draw boss (separate since it may not be in enemies group)
    if (boss?.active && boss.body) {
      this.drawHitbox(boss.body as Phaser.Physics.Arcade.Body, HitboxDebugRenderer.COLOR_BOSS)
    }

    // Draw gold pickups
    if (goldPickups) {
      goldPickups.getChildren().forEach((child) => {
        const pickup = child as Phaser.Physics.Arcade.Sprite
        if (pickup.active && pickup.body) {
          this.drawHitbox(pickup.body as Phaser.Physics.Arcade.Body, HitboxDebugRenderer.COLOR_PICKUP)
        }
      })
    }

    // Draw health pickups
    if (healthPickups) {
      healthPickups.getChildren().forEach((child) => {
        const pickup = child as Phaser.Physics.Arcade.Sprite
        if (pickup.active && pickup.body) {
          this.drawHitbox(pickup.body as Phaser.Physics.Arcade.Body, HitboxDebugRenderer.COLOR_PICKUP)
        }
      })
    }

    // Draw doors
    if (doors) {
      doors.getChildren().forEach((child) => {
        const door = child as Phaser.Physics.Arcade.Sprite
        if (door.active && door.body) {
          this.drawHitbox(door.body as Phaser.Physics.Arcade.Body, HitboxDebugRenderer.COLOR_DOOR)
        }
      })
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
        this.drawHitbox(sprite.body as Phaser.Physics.Arcade.Body, color)
      }
    })
  }

  /**
   * Draw a single sprite's hitbox with a specific color
   */
  renderSprite(sprite: Phaser.Physics.Arcade.Sprite, color: number): void {
    if (!this.isEnabled || !sprite.active || !sprite.body) return
    this.drawHitbox(sprite.body as Phaser.Physics.Arcade.Body, color)
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
