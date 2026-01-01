import Phaser from 'phaser'
import GoldPickup from '../entities/GoldPickup'
import { currencyManager, EnemyType } from './CurrencyManager'

/**
 * GoldPool - Object pool for gold pickups.
 * Pre-allocates gold pickup objects for performance.
 * Handles spawning, collection, and integration with CurrencyManager.
 */
export default class GoldPool extends Phaser.Physics.Arcade.Group {
  private _poolScene: Phaser.Scene
  private floatingTextPool: Phaser.GameObjects.Text[] = []
  private maxFloatingTexts: number = 20

  constructor(scene: Phaser.Scene) {
    super(scene.physics.world, scene, {
      classType: GoldPickup,
      maxSize: 50,
      runChildUpdate: false, // We'll manually update
    })

    this._poolScene = scene

    // Create gold coin texture if it doesn't exist
    this.createGoldCoinTexture()

    // Pre-allocate floating text objects
    this.createFloatingTextPool()
  }

  /**
   * Create a simple gold coin texture (yellow circle with shine)
   */
  private createGoldCoinTexture(): void {
    if (this._poolScene.textures.exists('goldCoin')) return

    const graphics = this._poolScene.make.graphics({ x: 0, y: 0 }, false)

    // Draw gold coin (16x16)
    const size = 16
    const halfSize = size / 2

    // Outer circle (darker gold)
    graphics.fillStyle(0xdaa520, 1)
    graphics.fillCircle(halfSize, halfSize, halfSize - 1)

    // Inner circle (brighter gold)
    graphics.fillStyle(0xffd700, 1)
    graphics.fillCircle(halfSize, halfSize, halfSize - 3)

    // Shine highlight (top-left)
    graphics.fillStyle(0xfffacd, 0.8)
    graphics.fillCircle(halfSize - 2, halfSize - 2, 2)

    graphics.generateTexture('goldCoin', size, size)
    graphics.destroy()
  }

  /**
   * Create a pool of floating text objects for "+X" display
   */
  private createFloatingTextPool(): void {
    for (let i = 0; i < this.maxFloatingTexts; i++) {
      const text = this._poolScene.add.text(0, 0, '', {
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffd700',
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
   * Show floating "+X" text at a position
   */
  private showFloatingText(x: number, y: number, value: number): void {
    const text = this.getFloatingText()
    if (!text) return

    text.setPosition(x, y - 10)
    text.setText(`+${value}`)
    text.setVisible(true)
    text.setAlpha(1)
    text.setScale(1)

    // Animate: float up and fade out
    this._poolScene.tweens.add({
      targets: text,
      y: y - 40,
      alpha: 0,
      scale: 1.2,
      duration: 800,
      ease: 'Quad.easeOut',
      onComplete: () => {
        text.setVisible(false)
      },
    })
  }

  /**
   * Spawn gold at a position based on enemy type
   * @param x Spawn X position
   * @param y Spawn Y position
   * @param enemyType Type of enemy that was killed
   * @returns The gold value spawned
   */
  spawnForEnemy(x: number, y: number, enemyType: EnemyType): number {
    const goldValue = currencyManager.calculateEnemyGoldDrop(enemyType)
    this.spawn(x, y, goldValue)
    return goldValue
  }

  /**
   * Spawn gold pickup at a position with a specific value
   * @param x Spawn X position
   * @param y Spawn Y position
   * @param value Gold value
   */
  spawn(x: number, y: number, value: number): GoldPickup | null {
    const gold = this.get(x, y) as GoldPickup
    if (gold) {
      gold.spawn(x, y, value)
    }
    return gold
  }

  /**
   * Update all gold pickups - check for player proximity and collection
   * @param playerX Player X position
   * @param playerY Player Y position
   * @returns Total gold collected this frame
   */
  updateAll(playerX: number, playerY: number): number {
    let totalCollected = 0

    this.getChildren().forEach((child) => {
      const gold = child as GoldPickup
      if (gold.active) {
        const collected = gold.updatePickup(playerX, playerY)
        if (collected > 0) {
          totalCollected += collected
          // Show floating text at collection position
          this.showFloatingText(gold.x, gold.y, collected)
        }
      }
    })

    return totalCollected
  }

  /**
   * Get count of active gold pickups
   */
  getActiveCount(): number {
    return this.getChildren().filter((child) => child.active).length
  }

  /**
   * Clean up all gold pickups
   */
  cleanup(): void {
    this.getChildren().forEach((child) => {
      const gold = child as GoldPickup
      gold.deactivate()
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
