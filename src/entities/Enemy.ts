import Phaser from 'phaser'

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
  private health: number = 30
  private maxHealth: number = 30

  // Fire DOT tracking
  private fireDamage: number = 0 // Damage per tick
  private fireTicks: number = 0 // Remaining ticks
  private fireTickInterval: number = 500 // ms between ticks
  private lastFireTick: number = 0

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemy')

    // Ensure enemy is visible and active
    this.setActive(true)
    this.setVisible(true)
    this.setDepth(1) // Make sure enemy renders above background

    console.log('Enemy constructor called at', x, y)
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

    if (this.health <= 0) {
      return true // Enemy died
    }
    return false
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
    return false
  }
}
