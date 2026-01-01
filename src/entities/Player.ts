import Phaser from 'phaser'
import { PlayerStats } from '../systems/PlayerStats'

export default class Player extends Phaser.Physics.Arcade.Sprite {
  private stats: PlayerStats = new PlayerStats()
  private isMoving: boolean = false
  private invincibilityDuration: number = 500 // ms of invincibility after being hit

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, '')

    // Add to scene
    scene.add.existing(this)
    scene.physics.add.existing(this)

    // Create a simple circle for the player
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false)
    graphics.fillStyle(0x4a9eff, 1)
    graphics.fillCircle(0, 0, 20)

    // Draw a direction indicator
    graphics.fillStyle(0xffffff, 1)
    graphics.fillCircle(8, 0, 5)

    graphics.generateTexture('player', 40, 40)
    graphics.destroy()

    this.setTexture('player')
    this.setCollideWorldBounds(true)
    this.setDrag(800, 800)

    console.log('Player created at', x, y)
  }

  update(_time: number, _delta: number) {
    // Check if player is moving
    const velocity = this.body?.velocity
    if (velocity) {
      this.isMoving = Math.abs(velocity.x) > 10 || Math.abs(velocity.y) > 10
    }

    // Rotate player to face movement direction
    if (this.isMoving && velocity) {
      this.rotation = Math.atan2(velocity.y, velocity.x)
    }
  }

  setVelocity(x: number, y: number): this {
    if (this.body) {
      this.body.velocity.x = x
      this.body.velocity.y = y
    }
    return this
  }

  takeDamage(amount: number): boolean {
    const result = this.stats.takeDamage(amount)

    if (result.damaged) {
      // Start invincibility timer (Phaser-specific)
      this.scene.time.delayedCall(this.invincibilityDuration, () => {
        this.stats.clearInvincibility()
      })
    }

    return result.damaged
  }

  isPlayerInvincible(): boolean {
    return this.stats.isPlayerInvincible()
  }

  heal(amount: number) {
    this.stats.heal(amount)
  }

  getHealth(): number {
    return this.stats.getHealth()
  }

  getMaxHealth(): number {
    return this.stats.getMaxHealth()
  }

  isDead(): boolean {
    return this.stats.isDead()
  }

  isPlayerMoving(): boolean {
    return this.isMoving
  }

  // XP/Leveling methods - delegate to stats
  addXP(amount: number): boolean {
    return this.stats.addXP(amount)
  }

  getXP(): number {
    return this.stats.getXP()
  }

  getXPToLevelUp(): number {
    return this.stats.getXPToLevelUp()
  }

  getLevel(): number {
    return this.stats.getLevel()
  }

  getXPPercentage(): number {
    return this.stats.getXPPercentage()
  }

  // Stat getters - delegate to stats
  getDamage(): number {
    return this.stats.getDamage()
  }

  getAttackSpeed(): number {
    return this.stats.getAttackSpeed()
  }

  getExtraProjectiles(): number {
    return this.stats.getExtraProjectiles()
  }

  getMultishotCount(): number {
    return this.stats.getMultishotCount()
  }

  // Ability application - delegate to stats
  addAttackSpeedBoost(amount: number) {
    this.stats.addAttackSpeedBoost(amount)
  }

  addDamageBoost(amount: number) {
    this.stats.addDamageBoost(amount)
  }

  addFrontArrow() {
    this.stats.addFrontArrow()
  }

  addMultishot() {
    this.stats.addMultishot()
  }

  // Reset run-based stats
  resetRunStats() {
    this.stats.resetRunStats()
  }

  // Get underlying stats for debugging
  getStats(): PlayerStats {
    return this.stats
  }
}
