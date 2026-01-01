import Phaser from 'phaser'
import { PlayerStats } from '../systems/PlayerStats'

export default class Player extends Phaser.Physics.Arcade.Sprite {
  private stats: PlayerStats = new PlayerStats()
  private isMoving: boolean = false
  private invincibilityDuration: number = 500 // ms of invincibility after being hit

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'playerSprite')

    // Add to scene
    scene.add.existing(this)
    scene.physics.add.existing(this)

    // Set size to match sprite (64x64)
    this.setDisplaySize(40, 40) // Scale down slightly for better gameplay
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

  addPiercing() {
    this.stats.addPiercing()
  }

  addRicochet() {
    this.stats.addRicochet()
  }

  addFireDamage() {
    this.stats.addFireDamage()
  }

  addCritBoost() {
    this.stats.addCritBoost()
  }

  // New ability getters
  getPiercingLevel(): number {
    return this.stats.getPiercingLevel()
  }

  getRicochetBounces(): number {
    return this.stats.getRicochetBounces()
  }

  getFireDamagePercent(): number {
    return this.stats.getFireDamagePercent()
  }

  getFireDamage(): number {
    return this.stats.getFireDamage()
  }

  getCritChance(): number {
    return this.stats.getCritChance()
  }

  getCritDamageMultiplier(): number {
    return this.stats.getCritDamageMultiplier()
  }

  rollCrit(): boolean {
    return this.stats.rollCrit()
  }

  getDamageWithCrit(isCrit: boolean): number {
    return this.stats.getDamageWithCrit(isCrit)
  }

  getPiercingDamage(hitNumber: number): number {
    return this.stats.getPiercingDamage(hitNumber)
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
