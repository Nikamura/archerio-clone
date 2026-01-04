/**
 * Pure game logic for player stats, health, abilities, and leveling.
 * No Phaser dependencies - fully unit testable.
 */
export interface DamageResult {
  damaged: boolean
  died: boolean
  dodged?: boolean
}

export class PlayerStats {
  // Health system
  private health: number
  private maxHealth: number

  // XP and leveling
  private currentXP: number = 0
  private baseXpToLevelUp: number
  private level: number = 1

  // Base stats
  private baseDamage: number
  private baseAttackSpeed: number

  // Attack speed cap: Maximum 10 attacks per second (with 500ms base fire rate, this means max attack speed of 5.0)
  private static readonly MAX_ATTACK_SPEED = 5.0

  // Dodge cap: Maximum 3% dodge chance (nerfed from 5%)
  public static readonly MAX_DODGE_CHANCE = 0.03

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

  // Dodge
  private dodgeChance: number = 0  // 0-1 (e.g., 0.1 = 10%), capped at 3%

  // New V1 abilities
  private freezeChance: number = 0  // 0-1 (e.g., 0.15 = 15%)
  private poisonDamagePercent: number = 0  // Percentage of weapon damage as poison DOT per second
  private poisonMaxStacks: number = 5  // Maximum poison stacks
  private lightningChainCount: number = 0  // Number of enemies lightning chains to
  private diagonalArrows: number = 0  // Number of diagonal arrow pairs
  private rearArrows: number = 0  // Number of rear arrows
  private damageAuraLevel: number = 0  // AOE damage aura around player
  private bloodthirstHeal: number = 0  // HP healed per kill
  private rageLevel: number = 0  // +5% damage per 10% missing HP, per level
  private movementSpeedMultiplier: number = 1.0  // Movement speed multiplier
  private maxHealthMultiplier: number = 1.0  // Max health multiplier from Vitality ability
  private wallBounceLevel: number = 0  // Number of wall bounces per level

  // Devil abilities
  private extraLives: number = 0  // Number of revives available
  private throughWallEnabled: boolean = false  // Arrows pass through walls
  private giantLevel: number = 0  // +40% damage per level, larger player hitbox

  // Orbital abilities
  private chainsawOrbitLevel: number = 0  // Number of chainsaws orbiting player

  constructor(options?: {
    maxHealth?: number
    baseDamage?: number
    baseAttackSpeed?: number
    xpToLevelUp?: number
    critChance?: number
    critDamage?: number
  }) {
    this.maxHealth = options?.maxHealth ?? 100
    this.health = this.maxHealth
    this.baseDamage = options?.baseDamage ?? 10
    this.baseAttackSpeed = options?.baseAttackSpeed ?? 1.0
    this.baseXpToLevelUp = options?.xpToLevelUp ?? 5  // Base XP for exponential scaling
    this.critChance = options?.critChance ?? 0
    this.critDamageMultiplier = options?.critDamage ?? 1.5
  }

  /**
   * Get XP required to level up from current level
   * Uses exponential scaling to make later levels harder:
   * - Level 1→2: 3 XP (quick intro to abilities)
   * - Level 2+: baseXP * 1.5^(level-2), where baseXP defaults to 5
   *
   * With default baseXP of 5:
   * - Level 2→3: 5 XP
   * - Level 3→4: 8 XP
   * - Level 4→5: 11 XP
   * - Level 5→6: 17 XP
   * - Level 6→7: 25 XP
   * - Level 7→8: 38 XP
   *
   * Formula: baseXpToLevelUp * (1.5 ^ (level - 2)) for level >= 2
   */
  private getXpRequiredForCurrentLevel(): number {
    if (this.level === 1) {
      return 3  // Fast first level-up
    }
    // Exponential scaling: base XP * 1.5^(level-2)
    const multiplier = Math.pow(1.5, this.level - 2)
    return Math.round(this.baseXpToLevelUp * multiplier)
  }

  // ============================================
  // Health System
  // ============================================

  takeDamage(amount: number): DamageResult {
    // Check debug invincibility (use global reference to avoid circular import)
    const globalDebugManager = (globalThis as Record<string, unknown>).__debugManager as { get: (key: string) => boolean } | undefined
    if (globalDebugManager?.get('invincible')) {
      return { damaged: false, died: false, dodged: false }
    }

    // Roll for dodge
    if (this.dodgeChance > 0 && Math.random() < this.dodgeChance) {
      return { damaged: false, died: false, dodged: true }
    }

    this.health = Math.max(0, this.health - amount)

    return {
      damaged: true,
      died: this.health <= 0,
      dodged: false,
    }
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
    return false
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
    let leveledUp = false
    
    // Support multiple level-ups if enough XP is gained at once
    // and preserve leftover XP
    while (true) {
      const xpRequired = this.getXpRequiredForCurrentLevel()
      if (this.currentXP >= xpRequired) {
        this.currentXP -= xpRequired
        this.level++
        leveledUp = true
        // Continue loop to check if we level up again with remaining XP
      } else {
        break
      }
    }
    
    return leveledUp
  }

  getXP(): number {
    return this.currentXP
  }

  getXPToLevelUp(): number {
    return this.getXpRequiredForCurrentLevel()
  }

  getLevel(): number {
    return this.level
  }

  getXPPercentage(): number {
    return this.currentXP / this.getXpRequiredForCurrentLevel()
  }

  // ============================================
  // Stat Calculations (with ability modifiers)
  // ============================================

  /**
   * Calculate current damage with ability modifiers
   * Front Arrow reduces damage by 25% per extra projectile
   * Rage adds +5% damage per 10% missing HP per level
   * Giant adds +40% damage per level
   */
  getDamage(): number {
    const frontArrowPenalty = Math.pow(0.75, this.extraProjectiles)

    // Calculate rage bonus based on missing HP
    let rageBonus = 1.0
    if (this.rageLevel > 0) {
      const missingHpPercent = 1 - (this.health / this.maxHealth)
      // +5% damage per 10% missing HP per level
      // At 50% HP missing with level 1: 5 * 0.05 = 25% bonus
      const bonusPercent = Math.floor(missingHpPercent * 10) * 0.05 * this.rageLevel
      rageBonus = 1 + bonusPercent
    }

    // Giant damage bonus
    const giantBonus = this.getGiantDamageMultiplier()

    return Math.floor(this.baseDamage * this.damageMultiplier * frontArrowPenalty * rageBonus * giantBonus)
  }

  /**
   * Calculate current attack speed with ability modifiers
   * Multishot reduces attack speed by 15% per level
   * Capped at MAX_ATTACK_SPEED (5.0) to limit to 10 attacks per second
   */
  getAttackSpeed(): number {
    const multishotPenalty = Math.pow(0.85, this.multishotCount)
    const rawAttackSpeed = this.baseAttackSpeed * this.attackSpeedMultiplier * multishotPenalty
    return Math.min(rawAttackSpeed, PlayerStats.MAX_ATTACK_SPEED)
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

  getDodgeChance(): number {
    return this.dodgeChance
  }

  setDodgeChance(chance: number): void {
    this.dodgeChance = Math.min(0.03, Math.max(0, chance))  // Cap at 3% (nerfed from 5%)
  }

  // New V1 ability getters
  getFreezeChance(): number {
    return this.freezeChance
  }

  getPoisonDamagePercent(): number {
    return this.poisonDamagePercent
  }

  /**
   * Calculate poison damage amount based on current weapon damage
   * Poison does 5% weapon damage per second
   */
  getPoisonDamage(): number {
    if (this.poisonDamagePercent === 0) return 0
    return Math.floor(this.getDamage() * this.poisonDamagePercent)
  }

  getPoisonMaxStacks(): number {
    return this.poisonMaxStacks
  }

  getLightningChainCount(): number {
    return this.lightningChainCount
  }

  getDiagonalArrows(): number {
    return this.diagonalArrows
  }

  getRearArrows(): number {
    return this.rearArrows
  }

  getDamageAuraLevel(): number {
    return this.damageAuraLevel
  }

  /**
   * Get damage aura DPS (10 damage per second per level)
   */
  getDamageAuraDPS(): number {
    return this.damageAuraLevel * 10
  }

  /**
   * Get damage aura radius (80px base)
   */
  getDamageAuraRadius(): number {
    return this.damageAuraLevel > 0 ? 80 : 0
  }

  getBloodthirstHeal(): number {
    return this.bloodthirstHeal
  }

  getRageLevel(): number {
    return this.rageLevel
  }

  getMovementSpeedMultiplier(): number {
    return Math.min(4.0, this.movementSpeedMultiplier)  // Cap at 400%
  }

  getWallBounceLevel(): number {
    return this.wallBounceLevel
  }

  /**
   * Get total wall bounces (2 per level)
   */
  getWallBounces(): number {
    return this.wallBounceLevel * 2
  }

  // Devil ability getters
  getExtraLives(): number {
    return this.extraLives
  }

  hasExtraLife(): boolean {
    return this.extraLives > 0
  }

  /**
   * Use an extra life and revive at 30% HP
   * @returns true if revived successfully
   */
  useExtraLife(): boolean {
    if (this.extraLives <= 0) return false
    this.extraLives--
    this.health = Math.floor(this.maxHealth * 0.3)
    return true
  }

  isThroughWallEnabled(): boolean {
    return this.throughWallEnabled
  }

  getGiantLevel(): number {
    return this.giantLevel
  }

  /**
   * Get giant damage multiplier (+40% per level)
   */
  getGiantDamageMultiplier(): number {
    return 1 + (this.giantLevel * 0.4)
  }

  // Chainsaw orbit getters
  getChainsawOrbitCount(): number {
    return this.chainsawOrbitLevel
  }

  /**
   * Get chainsaw orbit damage (50% of weapon damage per hit)
   */
  getChainsawOrbitDamage(): number {
    if (this.chainsawOrbitLevel <= 0) return 0
    return Math.floor(this.getDamage() * 0.5)
  }

  /**
   * Roll for freeze effect
   * @returns true if this hit should freeze the enemy
   */
  rollFreeze(): boolean {
    return Math.random() < this.freezeChance
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

  // New V1 ability application methods

  /**
   * Add Ice Shot ability (15% freeze chance per level)
   * Stacking: Additive (each level adds +15% freeze chance)
   */
  addIceShot(): void {
    this.freezeChance = Math.min(1, this.freezeChance + 0.15)  // Cap at 100%
  }

  /**
   * Add Poison Shot ability (5% DOT per second, stacks up to 5x)
   * Stacking: Additive poison damage per level
   */
  addPoisonShot(): void {
    this.poisonDamagePercent += 0.05  // +5% weapon damage per second
  }

  /**
   * Add Lightning Chain ability (chains to 2 additional enemies per level)
   * Stacking: Each level adds +2 chain targets
   */
  addLightningChain(): void {
    this.lightningChainCount += 2
  }

  /**
   * Add Diagonal Arrows ability (+2 arrows at 30 degree angles)
   * Stacking: Each level adds +2 diagonal arrows (1 pair)
   */
  addDiagonalArrows(): void {
    this.diagonalArrows += 2
  }

  /**
   * Add Rear Arrow ability (+1 arrow shooting backwards)
   * Stacking: Each level adds +1 rear arrow
   */
  addRearArrow(): void {
    this.rearArrows++
  }

  /**
   * Add Damage Aura ability (10 DPS in 80px radius)
   * Stacking: Each level adds +10 DPS
   */
  addDamageAura(): void {
    this.damageAuraLevel++
  }

  /**
   * Add Bloodthirst ability (+2 HP per kill per level)
   * Stacking: Each level adds +2 HP healed per kill
   */
  addBloodthirst(): void {
    this.bloodthirstHeal += 2
  }

  /**
   * Add Rage ability (+5% damage per 10% missing HP per level)
   * Stacking: Each level increases damage scaling
   */
  addRage(): void {
    this.rageLevel++
  }

  /**
   * Add Speed Boost ability (+15% movement speed)
   * Stacking: Multiplicative (each level multiplies speed by 1.15)
   */
  addSpeedBoost(): void {
    this.movementSpeedMultiplier *= 1.15
  }

  /**
   * Set speed multiplier directly (for debug override)
   */
  setSpeedMultiplier(multiplier: number): void {
    this.movementSpeedMultiplier = multiplier
  }

  /**
   * Add Max Health Boost ability (+10% max HP)
   * Stacking: Multiplicative (each level multiplies max HP by 1.10)
   * Also heals the player by the gained amount
   */
  addMaxHealthBoost(): void {
    const newMaxHealth = Math.floor(this.maxHealth * 1.10)
    const healthGain = newMaxHealth - this.maxHealth
    this.maxHealth = newMaxHealth
    this.health += healthGain  // Heal by the gained amount
    this.maxHealthMultiplier *= 1.10
  }

  getMaxHealthMultiplier(): number {
    return this.maxHealthMultiplier
  }

  /**
   * Add Bouncy Wall ability (+2 wall bounces per level)
   * Stacking: Each level adds +2 wall bounces
   */
  addWallBounce(): void {
    this.wallBounceLevel++
  }

  /**
   * Add Dodge Master ability (+1% dodge chance per level)
   * Stacking: Additive (capped at 3%, nerfed from 1.5%)
   */
  addDodgeMaster(): void {
    this.dodgeChance = Math.min(0.03, this.dodgeChance + 0.01)
  }

  /**
   * Add Extra Life ability (+1 revive per level)
   * Stacking: Each level adds +1 extra life
   */
  addExtraLife(): void {
    this.extraLives++
  }

  /**
   * Add Through Wall ability (arrows pass through walls)
   * Non-stacking: Only need one level
   */
  addThroughWall(): void {
    this.throughWallEnabled = true
  }

  /**
   * Add Giant ability (+40% damage, larger hitbox per level)
   * Stacking: Each level adds +40% damage
   */
  addGiant(): void {
    this.giantLevel++
  }

  /**
   * Add Chainsaw Orbit ability (+1 orbiting chainsaw per level)
   * Stacking: Each level adds +1 chainsaw at even spacing
   */
  addChainsawOrbit(): void {
    this.chainsawOrbitLevel++
  }

  // ============================================
  // Iron Will (Epic Talent) - Bonus HP when low health
  // ============================================

  /**
   * Add flat max health bonus (for Iron Will talent)
   * Does NOT heal the player, just increases max HP
   */
  addMaxHealthBonus(amount: number): void {
    this.maxHealth += amount
  }

  /**
   * Remove flat max health bonus (for Iron Will talent deactivation)
   * Caps current health to new max if needed
   */
  removeMaxHealthBonus(amount: number): void {
    this.maxHealth = Math.max(1, this.maxHealth - amount)
    // Cap current health to new max health
    if (this.health > this.maxHealth) {
      this.health = this.maxHealth
    }
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
    this.dodgeChance = 0
    // Reset new V1 abilities
    this.freezeChance = 0
    this.poisonDamagePercent = 0
    this.lightningChainCount = 0
    this.diagonalArrows = 0
    this.rearArrows = 0
    this.damageAuraLevel = 0
    this.bloodthirstHeal = 0
    this.rageLevel = 0
    this.movementSpeedMultiplier = 1.0
    this.maxHealthMultiplier = 1.0
    this.wallBounceLevel = 0
    // Reset devil abilities
    this.extraLives = 0
    this.throughWallEnabled = false
    this.giantLevel = 0
    // Reset orbital abilities
    this.chainsawOrbitLevel = 0
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
    freezeChance: number
    poisonDamagePercent: number
    lightningChainCount: number
    diagonalArrows: number
    rearArrows: number
    damageAuraLevel: number
    bloodthirstHeal: number
    rageLevel: number
    movementSpeedMultiplier: number
    maxHealthMultiplier: number
    wallBounceLevel: number
    extraLives: number
    throughWallEnabled: boolean
    giantLevel: number
    chainsawOrbitLevel: number
  } {
    return {
      health: this.health,
      maxHealth: this.maxHealth,
      level: this.level,
      xp: this.currentXP,
      xpToLevelUp: this.getXpRequiredForCurrentLevel(),
      damage: this.getDamage(),
      attackSpeed: this.getAttackSpeed(),
      extraProjectiles: this.extraProjectiles,
      multishotCount: this.multishotCount,
      piercingLevel: this.piercingLevel,
      ricochetBounces: this.ricochetBounces,
      fireDamagePercent: this.fireDamagePercent,
      critChance: this.critChance,
      critDamageMultiplier: this.critDamageMultiplier,
      freezeChance: this.freezeChance,
      poisonDamagePercent: this.poisonDamagePercent,
      lightningChainCount: this.lightningChainCount,
      diagonalArrows: this.diagonalArrows,
      rearArrows: this.rearArrows,
      damageAuraLevel: this.damageAuraLevel,
      bloodthirstHeal: this.bloodthirstHeal,
      rageLevel: this.rageLevel,
      movementSpeedMultiplier: this.movementSpeedMultiplier,
      maxHealthMultiplier: this.maxHealthMultiplier,
      wallBounceLevel: this.wallBounceLevel,
      extraLives: this.extraLives,
      throughWallEnabled: this.throughWallEnabled,
      giantLevel: this.giantLevel,
      chainsawOrbitLevel: this.chainsawOrbitLevel,
    }
  }
}
