import Phaser from 'phaser'

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
  private health: number
  private maxHealth: number
  protected damageMultiplier: number = 1.0 // For difficulty scaling

  // Fire DOT tracking
  private fireDamage: number = 0 // Damage per tick
  private fireTicks: number = 0 // Remaining ticks
  private fireTickInterval: number = 500 // ms between ticks
  private lastFireTick: number = 0

  // Health bar
  private healthBar?: Phaser.GameObjects.Graphics
  private healthBarWidth: number = 30
  private healthBarHeight: number = 4
  private healthBarOffsetY: number = -22 // Position above enemy

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    options?: {
      healthMultiplier?: number
      damageMultiplier?: number
    }
  ) {
    super(scene, x, y, 'enemyMelee')

    // Apply difficulty modifiers
    const baseHealth = 30
    this.maxHealth = Math.round(baseHealth * (options?.healthMultiplier ?? 1.0))
    this.health = this.maxHealth
    this.damageMultiplier = options?.damageMultiplier ?? 1.0

    // Set display size
    this.setDisplaySize(30, 30)

    // Ensure enemy is visible and active
    this.setActive(true)
    this.setVisible(true)
    this.setDepth(1) // Make sure enemy renders above background

    // Create health bar (initially hidden)
    this.healthBar = scene.add.graphics()
    this.healthBar.setDepth(10) // Above everything
    this.healthBar.setVisible(false)

    console.log('Enemy constructor called at', x, y, 'with health:', this.maxHealth)
  }

  takeDamage(amount: number): boolean {
    this.health -= amount

    // Flash effect
    this.setTint(0xffffff)
    this.scene.time.delayedCall(100, () => {
      // Don't clear tint if burning
      if (this.fireTicks === 0) {
        this.clearTint()
      } else {
        this.setTint(0xff4400) // Orange tint for burning
      }
    })

    // Update health bar
    this.updateHealthBar()

    if (this.health <= 0) {
      return true // Enemy died
    }
    return false
  }

  private updateHealthBar(): void {
    if (!this.healthBar) return

    // Only show if damaged but not dead
    if (this.health >= this.maxHealth || this.health <= 0) {
      this.healthBar.setVisible(false)
      return
    }

    this.healthBar.setVisible(true)
    this.healthBar.clear()

    const barX = this.x - this.healthBarWidth / 2
    const barY = this.y + this.healthBarOffsetY

    // Background (dark gray)
    this.healthBar.fillStyle(0x333333, 0.8)
    this.healthBar.fillRect(barX, barY, this.healthBarWidth, this.healthBarHeight)

    // Health fill (green to red based on health percentage)
    const healthPercent = this.health / this.maxHealth
    const fillWidth = this.healthBarWidth * healthPercent
    const color = healthPercent > 0.5 ? 0x00ff00 : healthPercent > 0.25 ? 0xffff00 : 0xff0000
    this.healthBar.fillStyle(color, 1)
    this.healthBar.fillRect(barX, barY, fillWidth, this.healthBarHeight)

    // Border
    this.healthBar.lineStyle(1, 0x000000, 0.8)
    this.healthBar.strokeRect(barX, barY, this.healthBarWidth, this.healthBarHeight)
  }

  /**
   * Apply fire DOT effect
   * @param damage Damage per tick
   * @param duration Duration in ms (default 2000ms = 2 seconds)
   */
  applyFireDamage(damage: number, duration: number = 2000): void {
    if (damage <= 0) return

    this.fireDamage = damage
    this.fireTicks = Math.ceil(duration / this.fireTickInterval)
    this.lastFireTick = this.scene.time.now

    // Visual indicator - orange tint for burning
    this.setTint(0xff4400)
  }

  resetHealth() {
    this.health = this.maxHealth
    this.fireDamage = 0
    this.fireTicks = 0
    this.clearTint()
    // Hide health bar when reset
    if (this.healthBar) {
      this.healthBar.setVisible(false)
      this.healthBar.clear()
    }
  }

  /**
   * Update fire DOT effect
   * @returns true if enemy died from fire damage
   */
  private updateFireDamage(time: number): boolean {
    if (this.fireTicks > 0 && time - this.lastFireTick >= this.fireTickInterval) {
      this.fireTicks--
      this.lastFireTick = time

      // Apply fire damage
      const died = this.takeDamage(this.fireDamage)

      // Clear fire effect if no ticks remaining
      if (this.fireTicks === 0) {
        this.fireDamage = 0
        if (!died) {
          this.clearTint()
        }
      }

      return died
    }
    return false
  }

  /**
   * Get the damage this enemy deals (with difficulty modifier applied)
   */
  getDamage(): number {
    const baseDamage = 5 // Base melee damage
    return Math.round(baseDamage * this.damageMultiplier)
  }

  update(time: number, _delta: number, playerX: number, playerY: number): boolean {
    if (!this.active || !this.body) {
      return false
    }

    // Update fire DOT
    const diedFromFire = this.updateFireDamage(time)
    if (diedFromFire) {
      return true // Signal to caller that enemy died
    }

    // Simple AI: move toward player
    const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
    const speed = 80

    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)

    // Update health bar position (if visible)
    if (this.healthBar?.visible) {
      this.updateHealthBar()
    }

    return false
  }

  destroy(fromScene?: boolean) {
    if (this.healthBar) {
      this.healthBar.destroy()
      this.healthBar = undefined
    }
    super.destroy(fromScene)
  }
}
