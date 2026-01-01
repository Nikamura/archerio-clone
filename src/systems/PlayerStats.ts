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

  // Ability multipliers (multiplicative stacking)
  private damageMultiplier: number = 1.0
  private attackSpeedMultiplier: number = 1.0

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
    this.damageMultiplier = 1.0
    this.attackSpeedMultiplier = 1.0
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
    }
  }
}
