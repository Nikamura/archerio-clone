import Phaser from 'phaser'
import HealthPickup from '../entities/HealthPickup'

/**
 * HealthPool - Object pool for health pickups.
 * Pre-allocates health pickup objects for performance.
 * Health potions drop from enemies with 5% chance and heal the player.
 */
export default class HealthPool extends Phaser.Physics.Arcade.Group {
  private _poolScene: Phaser.Scene
  private floatingTextPool: Phaser.GameObjects.Text[] = []
  private maxFloatingTexts: number = 10

  constructor(scene: Phaser.Scene) {
    super(scene.physics.world, scene, {
      classType: HealthPickup,
      maxSize: 20,
      runChildUpdate: false, // We'll manually update
    })

    this._poolScene = scene

    // Create health potion texture if it doesn't exist
    this.createHealthPotionTexture()

    // Pre-allocate floating text objects
    this.createFloatingTextPool()
  }

  /**
   * Create a simple health potion texture (red heart/potion shape)
   */
  private createHealthPotionTexture(): void {
    if (this._poolScene.textures.exists('healthPotion')) return

    const graphics = this._poolScene.make.graphics({ x: 0, y: 0 }, false)

    // Draw health potion (20x20)
    const size = 20
    const halfSize = size / 2

    // Bottle shape (darker red)
    graphics.fillStyle(0xcc0000, 1)
    graphics.fillRoundedRect(4, 8, 12, 10, 2)

    // Bottle neck
    graphics.fillStyle(0xcc0000, 1)
    graphics.fillRoundedRect(7, 4, 6, 6, 1)

    // Cork/cap (brown)
    graphics.fillStyle(0x8b4513, 1)
    graphics.fillRoundedRect(7, 2, 6, 4, 1)

    // Liquid shine highlight (brighter red)
    graphics.fillStyle(0xff4444, 1)
    graphics.fillCircle(halfSize - 2, halfSize + 2, 3)

    // White highlight for glass effect
    graphics.fillStyle(0xffffff, 0.4)
    graphics.fillCircle(halfSize - 3, halfSize, 2)

    graphics.generateTexture('healthPotion', size, size)
    graphics.destroy()
  }

  /**
   * Create a pool of floating text objects for "+X HP" display
   */
  private createFloatingTextPool(): void {
    for (let i = 0; i < this.maxFloatingTexts; i++) {
      const text = this._poolScene.add.text(0, 0, '', {
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#44ff44',
        stroke: '#000000',
        strokeThickness: 2,
      })
      text.setOrigin(0.5, 0.5)
      text.setDepth(100) // Above everything
      text.setVisible(false)
      this.floatingTextPool.push(text)
    }
  }

  /**
   * Get an available floating text from the pool
   */
  private getFloatingText(): Phaser.GameObjects.Text | null {
    for (const text of this.floatingTextPool) {
      if (!text.visible) {
        return text
      }
    }
    return null
  }

  /**
   * Show floating "+X HP" text at a position
   */
  private showFloatingText(x: number, y: number, value: number): void {
    const text = this.getFloatingText()
    if (!text) return

    text.setPosition(x, y - 10)
    text.setText(`+${value} HP`)
    text.setVisible(true)
    text.setAlpha(1)
    text.setScale(1)

    // Animate: float up and fade out
    this._poolScene.tweens.add({
      targets: text,
      y: y - 50,
      alpha: 0,
      scale: 1.3,
      duration: 1000,
      ease: 'Quad.easeOut',
      onComplete: () => {
        text.setVisible(false)
      },
    })
  }

  /**
   * Spawn health pickup at a position with a specific heal value
   * @param x Spawn X position
   * @param y Spawn Y position
   * @param value Heal value (default 20 HP)
   */
  spawn(x: number, y: number, value: number = 20): HealthPickup | null {
    const health = this.get(x, y) as HealthPickup
    if (health) {
      health.spawn(x, y, value)
    }
    return health
  }

  /**
   * Update all health pickups - check for player proximity and collection
   * @param playerX Player X position
   * @param playerY Player Y position
   * @param healCallback Callback to heal the player
   * @returns Total HP healed this frame
   */
  updateAll(playerX: number, playerY: number, healCallback: (amount: number) => void): number {
    let totalHealed = 0

    this.getChildren().forEach((child) => {
      const health = child as HealthPickup
      if (health.active) {
        const healValue = health.updatePickup(playerX, playerY)
        if (healValue > 0) {
          totalHealed += healValue
          // Show floating text at collection position
          this.showFloatingText(health.x, health.y, healValue)
          // Call the heal callback
          healCallback(healValue)
        }
      }
    })

    return totalHealed
  }

  /**
   * Get count of active health pickups
   */
  getActiveCount(): number {
    return this.getChildren().filter((child) => child.active).length
  }

  /**
   * Magnetically collect all health pickups instantly (called on room clear)
   * @param playerX Player X position
   * @param playerY Player Y position
   * @param healCallback Callback to heal the player
   * @returns Total HP collected
   */
  collectAll(playerX: number, playerY: number, healCallback: (amount: number) => void): number {
    let totalHealed = 0

    this.getChildren().forEach((child) => {
      const health = child as HealthPickup
      if (health.active) {
        // Kill any existing tweens (spawn animation) before fly animation
        this._poolScene.tweens.killTweensOf(health)

        // Animate health flying to player position
        this._poolScene.tweens.add({
          targets: health,
          x: playerX,
          y: playerY,
          duration: 300,
          ease: 'Quad.easeIn',
          onComplete: () => {
            const value = health.collect()
            if (value > 0) {
              this.showFloatingText(playerX, playerY - 30, value)
              healCallback(value)
            }
          },
        })
        totalHealed += health.getValue()
      }
    })

    return totalHealed
  }

  /**
   * Clean up all health pickups
   */
  cleanup(): void {
    this.getChildren().forEach((child) => {
      const health = child as HealthPickup
      health.deactivate()
    })
  }

  /**
   * Destroy the pool and all floating texts
   */
  destroy(destroyChildren?: boolean): void {
    // Clean up floating text pool
    this.floatingTextPool.forEach((text) => {
      text.destroy()
    })
    this.floatingTextPool = []

    super.destroy(destroyChildren)
  }
}
