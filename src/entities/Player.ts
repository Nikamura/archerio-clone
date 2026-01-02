import Phaser from 'phaser'
import { PlayerStats } from '../systems/PlayerStats'
import { themeManager } from '../systems/ThemeManager'

export default class Player extends Phaser.Physics.Arcade.Sprite {
  private stats: PlayerStats
  private isMoving: boolean = false

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    statsOptions?: {
      maxHealth?: number
      baseDamage?: number
      baseAttackSpeed?: number
      xpToLevelUp?: number
      critChance?: number
      critDamage?: number
    },
    heroId: string = 'atreus'
  ) {
    // Determine texture key based on heroId and theme
    // Atreus uses the themed game sprite (playerSprite or vaporwave_playerSprite)
    // Other heroes use their UI icons as fallback game sprites
    const themeAssets = themeManager.getAssets()
    let textureKey = themeAssets.playerSprite
    if (heroId === 'helix') textureKey = 'heroHelix'
    else if (heroId === 'meowgik') textureKey = 'heroMeowgik'

    super(scene, x, y, textureKey)

    // Initialize stats immediately after super
    this.stats = new PlayerStats(statsOptions)

    if (!this.stats) {
      console.error('Player: Failed to initialize PlayerStats!')
    }

    // Add to scene
    scene.add.existing(this)
    scene.physics.add.existing(this)

    // Set size to match sprite (original archer is 64x64, icons are 48x48)
    // We'll normalize all heroes to 64x64 for consistent hitboxes/gameplay
    this.setDisplaySize(64, 64)
    this.setCollideWorldBounds(true)
    this.setDrag(800, 800)

    // Set up centered circular hitbox for player
    if (this.body) {
      const displaySize = 64
      const radius = 16 // Player hitbox - not too large to allow dodging
      const offset = (displaySize - radius * 2) / 2
      this.body.setSize(displaySize, displaySize)
      this.body.setCircle(radius, offset, offset)
    }

    console.log('Player created at', x, y, 'with stats:', statsOptions)
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
    const result = this.stats?.takeDamage(amount)
    return result?.damaged ?? false
  }

  isPlayerInvincible(): boolean {
    return this.stats?.isPlayerInvincible() ?? false
  }

  heal(amount: number) {
    this.stats?.heal(amount)
  }

  getHealth(): number {
    return this.stats?.getHealth() ?? 100
  }

  getMaxHealth(): number {
    return this.stats?.getMaxHealth() ?? 100
  }

  isDead(): boolean {
    return this.stats?.isDead() ?? false
  }

  isPlayerMoving(): boolean {
    return this.isMoving
  }

  // XP/Leveling methods - delegate to stats
  addXP(amount: number): boolean {
    return this.stats?.addXP(amount) ?? false
  }

  getXP(): number {
    return this.stats?.getXP() ?? 0
  }

  getXPToLevelUp(): number {
    return this.stats?.getXPToLevelUp() ?? 10
  }

  getLevel(): number {
    return this.stats?.getLevel() ?? 1
  }

  getXPPercentage(): number {
    return this.stats?.getXPPercentage() ?? 0
  }

  // Stat getters - delegate to stats
  getDamage(): number {
    return this.stats?.getDamage() ?? 10
  }

  getAttackSpeed(): number {
    return this.stats?.getAttackSpeed() ?? 1.0
  }

  getExtraProjectiles(): number {
    return this.stats?.getExtraProjectiles() ?? 0
  }

  getMultishotCount(): number {
    return this.stats?.getMultishotCount() ?? 0
  }

  // Ability application - delegate to stats
  addAttackSpeedBoost(amount: number) {
    this.stats?.addAttackSpeedBoost(amount)
  }

  addDamageBoost(amount: number) {
    this.stats?.addDamageBoost(amount)
  }

  addFrontArrow() {
    this.stats?.addFrontArrow()
  }

  addMultishot() {
    this.stats?.addMultishot()
  }

  addPiercing() {
    this.stats?.addPiercing()
  }

  addRicochet() {
    this.stats?.addRicochet()
  }

  addFireDamage() {
    this.stats?.addFireDamage()
  }

  addCritBoost() {
    this.stats?.addCritBoost()
  }

  // New V1 ability application methods
  addIceShot() {
    this.stats?.addIceShot()
  }

  addPoisonShot() {
    this.stats?.addPoisonShot()
  }

  addLightningChain() {
    this.stats?.addLightningChain()
  }

  addDiagonalArrows() {
    this.stats?.addDiagonalArrows()
  }

  addRearArrow() {
    this.stats?.addRearArrow()
  }

  addDamageAura() {
    this.stats?.addDamageAura()
  }

  addBloodthirst() {
    this.stats?.addBloodthirst()
  }

  addRage() {
    this.stats?.addRage()
  }

  addSpeedBoost() {
    this.stats?.addSpeedBoost()
  }

  addMaxHealthBoost() {
    this.stats?.addMaxHealthBoost()
  }

  // New ability getters
  getPiercingLevel(): number {
    return this.stats?.getPiercingLevel() ?? 0
  }

  getRicochetBounces(): number {
    return this.stats?.getRicochetBounces() ?? 0
  }

  getFireDamagePercent(): number {
    return this.stats?.getFireDamagePercent() ?? 0
  }

  getFireDamage(): number {
    return this.stats?.getFireDamage() ?? 0
  }

  getCritChance(): number {
    return this.stats?.getCritChance() ?? 0
  }

  getCritDamageMultiplier(): number {
    return this.stats?.getCritDamageMultiplier() ?? 1.5
  }

  rollCrit(): boolean {
    return this.stats?.rollCrit() ?? false
  }

  getDamageWithCrit(isCrit: boolean): number {
    return this.stats?.getDamageWithCrit(isCrit) ?? this.getDamage()
  }

  getPiercingDamage(hitNumber: number): number {
    return this.stats?.getPiercingDamage(hitNumber) ?? this.getDamage()
  }

  // New V1 ability getters
  getFreezeChance(): number {
    return this.stats?.getFreezeChance() ?? 0
  }

  rollFreeze(): boolean {
    return this.stats?.rollFreeze() ?? false
  }

  getPoisonDamagePercent(): number {
    return this.stats?.getPoisonDamagePercent() ?? 0
  }

  getPoisonDamage(): number {
    return this.stats?.getPoisonDamage() ?? 0
  }

  getLightningChainCount(): number {
    return this.stats?.getLightningChainCount() ?? 0
  }

  getDiagonalArrows(): number {
    return this.stats?.getDiagonalArrows() ?? 0
  }

  getRearArrows(): number {
    return this.stats?.getRearArrows() ?? 0
  }

  getDamageAuraLevel(): number {
    return this.stats?.getDamageAuraLevel() ?? 0
  }

  getDamageAuraDPS(): number {
    return this.stats?.getDamageAuraDPS() ?? 0
  }

  getDamageAuraRadius(): number {
    return this.stats?.getDamageAuraRadius() ?? 0
  }

  getBloodthirstHeal(): number {
    return this.stats?.getBloodthirstHeal() ?? 0
  }

  getRageLevel(): number {
    return this.stats?.getRageLevel() ?? 0
  }

  getMovementSpeedMultiplier(): number {
    return this.stats?.getMovementSpeedMultiplier() ?? 1.0
  }

  // Reset run-based stats
  resetRunStats() {
    this.stats?.resetRunStats()
  }

  // Get underlying stats for debugging
  getStats(): PlayerStats {
    return this.stats
  }
}
