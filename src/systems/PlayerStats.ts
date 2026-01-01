/**
 * Pure game logic for player stats, health, abilities, and leveling.
 * No Phaser dependencies - fully unit testable.
 */
export interface DamageResult {
  damaged: boolean
  died: boolean
}

export class PlayerStats {
  // Health system
  private health: number
  private maxHealth: number
  private isInvincible: boolean = false

  // XP and leveling
  private currentXP: number = 0
  private xpToLevelUp: number
  private level: number = 1

  // Base stats
  private baseDamage: number
  private baseAttackSpeed: number

  // Ability counters (linear stacking)
  private extraProjectiles: number = 0
  private multishotCount: number = 0
  private piercingLevel: number = 0  // How many enemies bullet can pass through
  private ricochetBounces: number = 0  // How many times bullet bounces

  // Ability multipliers (multiplicative stacking)
  private damageMultiplier: number = 1.0
  private attackSpeedMultiplier: number = 1.0

  // Fire damage (DOT)
  private fireDamagePercent: number = 0  // Percentage of weapon damage as fire DOT

  // Critical hit
  private critChance: number = 0  // 0-1 (e.g., 0.1 = 10%)
  private critDamageMultiplier: number = 1.5  // Base crit multiplier (150%)

  constructor(options?: {
    maxHealth?: number
    baseDamage?: number
    baseAttackSpeed?: number
    xpToLevelUp?: number
  }) {
    this.maxHealth = options?.maxHealth ?? 100
    this.health = this.maxHealth
    this.baseDamage = options?.baseDamage ?? 10
    this.baseAttackSpeed = options?.baseAttackSpeed ?? 1.0
    this.xpToLevelUp = options?.xpToLevelUp ?? 10
  }

  // ============================================
  // Health System
  // ============================================

  takeDamage(amount: number): DamageResult {
    if (this.isInvincible) {
      return { damaged: false, died: false }
    }

    this.health = Math.max(0, this.health - amount)
    this.isInvincible = true

    return {
      damaged: true,
      died: this.health <= 0,
    }
  }

  /**
   * Clear invincibility (call this after invincibility timer expires)
   */
  clearInvincibility(): void {
    this.isInvincible = false
  }

  heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount)
  }

  getHealth(): number {
    return this.health
  }

  getMaxHealth(): number {
    return this.maxHealth
  }

  getHealthPercentage(): number {
    return this.health / this.maxHealth
  }

  isPlayerInvincible(): boolean {
    return this.isInvincible
  }

  isDead(): boolean {
    return this.health <= 0
  }

  // ============================================
  // XP and Leveling
  // ============================================

  /**
   * Add XP to the player
   * @returns true if this caused a level up
   */
  addXP(amount: number): boolean {
    this.currentXP += amount
    if (this.currentXP >= this.xpToLevelUp) {
      this.currentXP = 0
      this.level++
      return true
    }
    return false
  }

  getXP(): number {
    return this.currentXP
  }

  getXPToLevelUp(): number {
    return this.xpToLevelUp
  }

  getLevel(): number {
    return this.level
  }

  getXPPercentage(): number {
    return this.currentXP / this.xpToLevelUp
  }

  // ============================================
  // Stat Calculations (with ability modifiers)
  // ============================================

  /**
   * Calculate current damage with ability modifiers
   * Front Arrow reduces damage by 25% per extra projectile
   */
  getDamage(): number {
    const frontArrowPenalty = Math.pow(0.75, this.extraProjectiles)
    return Math.floor(this.baseDamage * this.damageMultiplier * frontArrowPenalty)
  }

  /**
   * Calculate current attack speed with ability modifiers
   * Multishot reduces attack speed by 15% per level
   */
  getAttackSpeed(): number {
    const multishotPenalty = Math.pow(0.85, this.multishotCount)
    return this.baseAttackSpeed * this.attackSpeedMultiplier * multishotPenalty
  }

  getExtraProjectiles(): number {
    return this.extraProjectiles
  }

  getMultishotCount(): number {
    return this.multishotCount
  }

  getPiercingLevel(): number {
    return this.piercingLevel
  }

  getRicochetBounces(): number {
    return this.ricochetBounces
  }

  getFireDamagePercent(): number {
    return this.fireDamagePercent
  }

  /**
   * Calculate fire damage amount based on current weapon damage
   */
  getFireDamage(): number {
    if (this.fireDamagePercent === 0) return 0
    return Math.floor(this.getDamage() * this.fireDamagePercent)
  }

  getCritChance(): number {
    return this.critChance
  }

  getCritDamageMultiplier(): number {
    return this.critDamageMultiplier
  }

  /**
   * Roll for a critical hit
   * @returns true if this hit should be critical
   */
  rollCrit(): boolean {
    return Math.random() < this.critChance
  }

  /**
   * Calculate damage with possible critical hit
   * @param isCrit whether this is a critical hit
   */
  getDamageWithCrit(isCrit: boolean): number {
    const baseDamage = this.getDamage()
    return isCrit ? Math.floor(baseDamage * this.critDamageMultiplier) : baseDamage
  }

  /**
   * Calculate piercing damage reduction
   * Each pierce reduces damage by 33%
   * @param hitNumber which enemy this is (0 = first, 1 = second, etc)
   */
  getPiercingDamage(hitNumber: number): number {
    const piercingPenalty = Math.pow(0.67, hitNumber)
    return Math.floor(this.getDamage() * piercingPenalty)
  }

  // ============================================
  // Ability Application (stacking)
  // ============================================

  /**
   * Add Front Arrow ability (+1 projectile, -25% damage)
   */
  addFrontArrow(): void {
    this.extraProjectiles++
  }

  /**
   * Add Multishot ability (+1 side projectile pair, -15% attack speed)
   */
  addMultishot(): void {
    this.multishotCount++
  }

  /**
   * Add Attack Speed boost (multiplicative stacking)
   * @param amount The percentage boost (e.g., 0.25 for +25%)
   */
  addAttackSpeedBoost(amount: number): void {
    this.attackSpeedMultiplier *= 1 + amount
  }

  /**
   * Add Damage boost (multiplicative stacking)
   * @param amount The percentage boost (e.g., 0.30 for +30%)
   */
  addDamageBoost(amount: number): void {
    this.damageMultiplier *= 1 + amount
  }

  /**
   * Add Piercing Shot ability (arrows pass through 1 additional enemy)
   * Stacking: Each level adds +1 enemy the arrow can pierce
   */
  addPiercing(): void {
    this.piercingLevel++
  }

  /**
   * Add Ricochet ability (arrows bounce between enemies)
   * Stacking: Each level adds +3 bounces
   */
  addRicochet(): void {
    this.ricochetBounces += 3
  }

  /**
   * Add Fire Damage ability (18% DOT)
   * Stacking: Additive (each level adds +18% fire damage)
   */
  addFireDamage(): void {
    this.fireDamagePercent += 0.18
  }

  /**
   * Add Crit Boost ability (+10% chance, +40% damage)
   * Stacking: Additive for chance, multiplicative for damage
   */
  addCritBoost(): void {
    this.critChance = Math.min(1, this.critChance + 0.10)  // Cap at 100%
    this.critDamageMultiplier *= 1.40  // +40% crit damage
  }

  // ============================================
  // Reset / Utility
  // ============================================

  /**
   * Reset all run-based stats (called on death/new game)
   */
  resetRunStats(): void {
    this.health = this.maxHealth
    this.currentXP = 0
    this.level = 1
    this.extraProjectiles = 0
    this.multishotCount = 0
    this.piercingLevel = 0
    this.ricochetBounces = 0
    this.damageMultiplier = 1.0
    this.attackSpeedMultiplier = 1.0
    this.fireDamagePercent = 0
    this.critChance = 0
    this.critDamageMultiplier = 1.5
    this.isInvincible = false
  }

  /**
   * Get a snapshot of current stats for debugging/UI
   */
  getStatsSnapshot(): {
    health: number
    maxHealth: number
    level: number
    xp: number
    xpToLevelUp: number
    damage: number
    attackSpeed: number
    extraProjectiles: number
    multishotCount: number
    piercingLevel: number
    ricochetBounces: number
    fireDamagePercent: number
    critChance: number
    critDamageMultiplier: number
  } {
    return {
      health: this.health,
      maxHealth: this.maxHealth,
      level: this.level,
      xp: this.currentXP,
      xpToLevelUp: this.xpToLevelUp,
      damage: this.getDamage(),
      attackSpeed: this.getAttackSpeed(),
      extraProjectiles: this.extraProjectiles,
      multishotCount: this.multishotCount,
      piercingLevel: this.piercingLevel,
      ricochetBounces: this.ricochetBounces,
      fireDamagePercent: this.fireDamagePercent,
      critChance: this.critChance,
      critDamageMultiplier: this.critDamageMultiplier,
    }
  }
}
