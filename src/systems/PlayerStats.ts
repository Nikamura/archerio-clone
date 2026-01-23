/**
 * Pure game logic for player stats, health, abilities, and leveling.
 * No Phaser dependencies - fully unit testable.
 */
export interface DamageResult {
  damaged: boolean;
  died: boolean;
  dodged?: boolean;
}

export class PlayerStats {
  // Health system
  private health: number;
  private maxHealth: number;

  // XP and leveling
  private currentXP: number = 0;
  private baseXpToLevelUp: number;
  private level: number = 1;

  // Base stats
  private baseDamage: number;
  private baseAttackSpeed: number;

  // Attack speed cap: Maximum 10 attacks per second (with 500ms base fire rate, this means max attack speed of 5.0)
  private static readonly MAX_ATTACK_SPEED = 5.0;

  // Dodge cap: Maximum 15% dodge chance (buffed from 3%)
  public static readonly MAX_DODGE_CHANCE = 0.15;

  // Ability counters (linear stacking)
  private extraProjectiles: number = 0;
  private multishotCount: number = 0;
  private piercingLevel: number = 0; // How many enemies bullet can pass through
  private ricochetBounces: number = 0; // How many times bullet bounces

  // Ability multipliers (multiplicative stacking)
  private damageMultiplier: number = 1.0;
  private attackSpeedMultiplier: number = 1.0;

  // Fire damage (DOT)
  private fireDamagePercent: number = 0; // Percentage of weapon damage as fire DOT

  // Critical hit
  private critChance: number = 0; // 0-1 (e.g., 0.1 = 10%)
  private critDamageMultiplier: number = 1.5; // Base crit multiplier (150%)

  // Dodge
  private dodgeChance: number = 0; // 0-1 (e.g., 0.1 = 10%), capped at 3%

  // New V1 abilities
  private freezeChance: number = 0; // 0-1 (e.g., 0.15 = 15%)
  private poisonDamagePercent: number = 0; // Percentage of weapon damage as poison DOT per second
  private poisonMaxStacks: number = 5; // Maximum poison stacks
  private lightningChainCount: number = 0; // Number of enemies lightning chains to
  private bleedDamagePercent: number = 0; // Percentage of weapon damage as bleed DOT (2x when moving)
  private diagonalArrows: number = 0; // Number of diagonal arrow pairs
  private bloodthirstHealPercent: number = 0; // Percentage of max HP healed per kill (caps at 5%)
  private movementSpeedMultiplier: number = 1.0; // Movement speed multiplier
  private maxHealthMultiplier: number = 1.0; // Max health multiplier from Vitality ability

  // Devil abilities
  private extraLives: number = 0; // Number of revives available
  private throughWallEnabled: boolean = false; // Arrows pass through walls

  // New orbital and effect abilities
  private rotatingOrbCount: number = 0; // Number of orbs orbiting player
  private orbitalShieldCount: number = 0; // Number of shields blocking projectiles
  private spiritPetCount: number = 0; // Number of homing spirit pets
  private deathNovaLevel: number = 0; // Death nova AOE level (affects radius/damage)
  private homingStrength: number = 0; // Bullet tracking strength (0-1)
  private explosiveArrowLevel: number = 0; // Explosive arrow AOE level (affects radius/damage)
  private shieldBarrierLevel: number = 0; // Shield barrier level (affects shield HP)
  private knockbackStrength: number = 0; // Knockback force on hit

  // Game modifier abilities (Risk/Reward)
  private asceticEnabled: boolean = false; // No healing, +200% XP gain
  private hordeMagnetLevel: number = 0; // Each level: +50% enemies, +100% XP gain (stacks)

  // Note: Shatter and Fire Spread are now passive effects:
  // - Shatter: Ice Shot enables +50% damage to frozen enemies automatically
  // - Fire Spread: Fire Damage enables fire spread on death automatically

  constructor(options?: {
    maxHealth?: number;
    baseDamage?: number;
    baseAttackSpeed?: number;
    xpToLevelUp?: number;
    critChance?: number;
    critDamage?: number;
  }) {
    this.maxHealth = options?.maxHealth ?? 100;
    this.health = this.maxHealth;
    this.baseDamage = options?.baseDamage ?? 10;
    this.baseAttackSpeed = options?.baseAttackSpeed ?? 1.0;
    this.baseXpToLevelUp = options?.xpToLevelUp ?? 10; // Base XP for exponential scaling (increased for balance)
    this.critChance = options?.critChance ?? 0;
    this.critDamageMultiplier = options?.critDamage ?? 1.5;
  }

  /**
   * Get XP required to level up from current level
   * Uses gentle exponential scaling for satisfying progression:
   * - Level 1→2: 4 XP (quick first level-up feels rewarding)
   * - Level 2+: baseXP * 1.25^(level-2), where baseXP defaults to 10
   *
   * With default baseXP of 10:
   * - Level 2→3: 10 XP
   * - Level 3→4: 13 XP
   * - Level 4→5: 16 XP
   * - Level 5→6: 20 XP
   * - Level 6→7: 24 XP
   * - Level 7→8: 31 XP
   *
   * This gentler curve keeps leveling feeling achievable throughout the run.
   * Formula: baseXpToLevelUp * (1.25 ^ (level - 2)) for level >= 2
   */
  private getXpRequiredForCurrentLevel(): number {
    if (this.level === 1) {
      return 4; // Quick first level-up feels rewarding
    }
    // Gentle exponential scaling: base XP * 1.25^(level-2)
    const multiplier = Math.pow(1.25, this.level - 2);
    return Math.round(this.baseXpToLevelUp * multiplier);
  }

  // ============================================
  // Health System
  // ============================================

  takeDamage(amount: number): DamageResult {
    // Roll for dodge
    if (this.dodgeChance > 0 && Math.random() < this.dodgeChance) {
      return { damaged: false, died: false, dodged: true };
    }

    this.health = Math.max(0, this.health - amount);

    return {
      damaged: true,
      died: this.health <= 0,
      dodged: false,
    };
  }

  heal(amount: number): void {
    // Ascetic modifier blocks all healing
    if (this.asceticEnabled) {
      return;
    }
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  getHealth(): number {
    return this.health;
  }

  getMaxHealth(): number {
    return this.maxHealth;
  }

  getHealthPercentage(): number {
    return this.health / this.maxHealth;
  }

  isPlayerInvincible(): boolean {
    return false;
  }

  isDead(): boolean {
    return this.health <= 0;
  }

  // ============================================
  // XP and Leveling
  // ============================================

  /**
   * Add XP to the player
   * @returns true if this caused a level up
   */
  addXP(amount: number): boolean {
    this.currentXP += amount;
    let leveledUp = false;

    // Support multiple level-ups if enough XP is gained at once
    // and preserve leftover XP
    while (true) {
      const xpRequired = this.getXpRequiredForCurrentLevel();
      if (this.currentXP >= xpRequired) {
        this.currentXP -= xpRequired;
        this.level++;
        leveledUp = true;
        // Continue loop to check if we level up again with remaining XP
      } else {
        break;
      }
    }

    return leveledUp;
  }

  getXP(): number {
    return this.currentXP;
  }

  getXPToLevelUp(): number {
    return this.getXpRequiredForCurrentLevel();
  }

  getLevel(): number {
    return this.level;
  }

  getXPPercentage(): number {
    return this.currentXP / this.getXpRequiredForCurrentLevel();
  }

  // ============================================
  // Stat Calculations (with ability modifiers)
  // ============================================

  /**
   * Calculate current damage with ability modifiers
   * Front Arrow reduces damage by 15% per extra projectile (buffed from 25%)
   */
  getDamage(): number {
    const frontArrowPenalty = Math.pow(0.85, this.extraProjectiles);

    return Math.floor(this.baseDamage * this.damageMultiplier * frontArrowPenalty);
  }

  /**
   * Calculate current attack speed with ability modifiers
   * Multishot reduces attack speed by 10% per level (buffed from 15%)
   * Capped at MAX_ATTACK_SPEED (5.0) to limit to 10 attacks per second
   */
  getAttackSpeed(): number {
    const multishotPenalty = Math.pow(0.9, this.multishotCount);
    const rawAttackSpeed = this.baseAttackSpeed * this.attackSpeedMultiplier * multishotPenalty;
    return Math.min(rawAttackSpeed, PlayerStats.MAX_ATTACK_SPEED);
  }

  getExtraProjectiles(): number {
    return this.extraProjectiles;
  }

  getMultishotCount(): number {
    return this.multishotCount;
  }

  getPiercingLevel(): number {
    return this.piercingLevel;
  }

  getRicochetBounces(): number {
    return this.ricochetBounces;
  }

  getFireDamagePercent(): number {
    return this.fireDamagePercent;
  }

  /**
   * Calculate fire damage amount based on current weapon damage
   */
  getFireDamage(): number {
    if (this.fireDamagePercent === 0) return 0;
    return Math.floor(this.getDamage() * this.fireDamagePercent);
  }

  getCritChance(): number {
    return this.critChance;
  }

  getCritDamageMultiplier(): number {
    return this.critDamageMultiplier;
  }

  getDodgeChance(): number {
    return this.dodgeChance;
  }

  setDodgeChance(chance: number): void {
    this.dodgeChance = Math.min(0.15, Math.max(0, chance)); // Cap at 15% (buffed from 3%)
  }

  // New V1 ability getters
  getFreezeChance(): number {
    return this.freezeChance;
  }

  getPoisonDamagePercent(): number {
    return this.poisonDamagePercent;
  }

  /**
   * Calculate poison damage amount based on current weapon damage
   * Poison does 10% weapon damage per second per level (buffed from 5%)
   */
  getPoisonDamage(): number {
    if (this.poisonDamagePercent === 0) return 0;
    return Math.floor(this.getDamage() * this.poisonDamagePercent);
  }

  getPoisonMaxStacks(): number {
    return this.poisonMaxStacks;
  }

  getBleedDamagePercent(): number {
    return this.bleedDamagePercent;
  }

  /**
   * Calculate bleed damage amount based on current weapon damage
   * Bleed does 10% weapon damage per tick (2x when enemy is moving)
   */
  getBleedDamage(): number {
    if (this.bleedDamagePercent === 0) return 0;
    return Math.floor(this.getDamage() * this.bleedDamagePercent);
  }

  getLightningChainCount(): number {
    return this.lightningChainCount;
  }

  /**
   * Calculate lightning chain damage reduction
   * Each chain reduces damage by 20% (due to resistance through bodies)
   * @param chainNumber which enemy this is (0 = first hit, 1 = first chain, etc)
   * @returns damage multiplier (e.g., 0.8 for first chain, 0.64 for second)
   */
  getLightningChainDamageMultiplier(chainNumber: number): number {
    if (chainNumber <= 0) return 1.0; // First hit does full damage
    return Math.pow(0.8, chainNumber); // -20% per chain
  }

  getDiagonalArrows(): number {
    return this.diagonalArrows;
  }

  /**
   * Get bloodthirst heal amount (percentage of max HP)
   * Returns the actual HP amount to heal based on current max HP
   */
  getBloodthirstHeal(): number {
    if (this.bloodthirstHealPercent <= 0) return 0;
    return Math.floor(this.maxHealth * this.bloodthirstHealPercent);
  }

  getBloodthirstHealPercent(): number {
    return this.bloodthirstHealPercent;
  }

  getMovementSpeedMultiplier(): number {
    return Math.min(4.0, this.movementSpeedMultiplier); // Cap at 400%
  }

  // Devil ability getters
  getExtraLives(): number {
    return this.extraLives;
  }

  hasExtraLife(): boolean {
    return this.extraLives > 0;
  }

  /**
   * Use an extra life and revive at 30% HP
   * @returns true if revived successfully
   */
  useExtraLife(): boolean {
    if (this.extraLives <= 0) return false;
    this.extraLives--;
    this.health = Math.floor(this.maxHealth * 0.3);
    return true;
  }

  isThroughWallEnabled(): boolean {
    return this.throughWallEnabled;
  }

  // New orbital and effect ability getters
  getRotatingOrbCount(): number {
    return this.rotatingOrbCount;
  }

  getOrbitalShieldCount(): number {
    return this.orbitalShieldCount;
  }

  getSpiritPetCount(): number {
    return this.spiritPetCount;
  }

  getDeathNovaLevel(): number {
    return this.deathNovaLevel;
  }

  /**
   * Get death nova radius based on level
   * Level 1 = 60px, Level 2 = 80px, Level 3 = 100px
   */
  getDeathNovaRadius(): number {
    if (this.deathNovaLevel <= 0) return 0;
    return 40 + this.deathNovaLevel * 20;
  }

  /**
   * Get death nova damage as percentage of kill damage
   * Level 1 = 40%, Level 2 = 55%, Level 3 = 70%
   */
  getDeathNovaDamagePercent(): number {
    if (this.deathNovaLevel <= 0) return 0;
    return 0.25 + this.deathNovaLevel * 0.15;
  }

  getHomingStrength(): number {
    return this.homingStrength;
  }

  getExplosiveArrowLevel(): number {
    return this.explosiveArrowLevel;
  }

  /**
   * Get explosive arrow radius based on level
   * Level 1 = 30px, Level 2 = 45px, Level 3 = 60px
   */
  getExplosiveArrowRadius(): number {
    if (this.explosiveArrowLevel <= 0) return 0;
    return 15 + this.explosiveArrowLevel * 15;
  }

  /**
   * Get explosive arrow damage as percentage of bullet damage
   * Level 1 = 30%, Level 2 = 45%, Level 3 = 60%
   */
  getExplosiveArrowDamagePercent(): number {
    if (this.explosiveArrowLevel <= 0) return 0;
    return 0.15 + this.explosiveArrowLevel * 0.15;
  }

  getShieldBarrierLevel(): number {
    return this.shieldBarrierLevel;
  }

  /**
   * Get shield barrier max HP as percentage of player max HP
   * Level 1 = 30%, Level 2 = 50%, Level 3 = 70%
   */
  getShieldBarrierMaxPercent(): number {
    if (this.shieldBarrierLevel <= 0) return 0;
    return 0.1 + this.shieldBarrierLevel * 0.2;
  }

  /**
   * Get shield barrier regen rate (% of max shield per second)
   * Level 1 = 5%, Level 2 = 7%, Level 3 = 10%
   */
  getShieldBarrierRegenRate(): number {
    if (this.shieldBarrierLevel <= 0) return 0;
    return 0.02 + this.shieldBarrierLevel * 0.03;
  }

  getKnockbackStrength(): number {
    return this.knockbackStrength;
  }

  /**
   * Get knockback force in pixels
   * Level 1 = 50, Level 2 = 100, Level 3 = 150
   */
  getKnockbackForce(): number {
    if (this.knockbackStrength <= 0) return 0;
    return this.knockbackStrength * 50;
  }

  // Game modifier getters
  isAsceticEnabled(): boolean {
    return this.asceticEnabled;
  }

  getHordeMagnetLevel(): number {
    return this.hordeMagnetLevel;
  }

  /**
   * Get enemy count multiplier from Horde Magnet
   * Each level adds +50% enemies (stacks additively)
   * Level 1: 1.5x, Level 2: 2.0x, Level 3: 2.5x, etc.
   */
  getHordeMagnetEnemyMultiplier(): number {
    return 1.0 + this.hordeMagnetLevel * 0.5;
  }

  /**
   * Get XP multiplier from game modifiers
   * Ascetic: 3x XP (200% increase)
   * Horde Magnet: 2x XP per level (100% increase each, stacks additively)
   * Examples:
   * - Ascetic only: 3x
   * - Horde Magnet L1: 2x
   * - Horde Magnet L2: 3x
   * - Horde Magnet L3: 4x
   * - Ascetic + Horde Magnet L1: 3x * 2x = 6x (multiplicative)
   * - Ascetic + Horde Magnet L3: 3x * 4x = 12x (multiplicative)
   */
  getXPMultiplier(): number {
    let multiplier = 1.0;
    if (this.asceticEnabled) multiplier *= 3.0;
    if (this.hordeMagnetLevel > 0) multiplier *= 1.0 + this.hordeMagnetLevel * 1.0; // 2x, 3x, 4x, etc.
    return multiplier;
  }

  // Conditional damage ability getters (now passive effects)

  /**
   * Get shatter level (bonus damage to frozen enemies)
   * Now returns 1 if player has Ice Shot, 0 otherwise (passive effect)
   */
  getShatterLevel(): number {
    return this.freezeChance > 0 ? 1 : 0;
  }

  /**
   * Get shatter damage multiplier (+50% to frozen enemies)
   * Automatically enabled when player has Ice Shot ability
   */
  getShatterDamageMultiplier(): number {
    if (this.freezeChance <= 0) return 1.0;
    return 1.5; // +50% damage to frozen enemies
  }

  /**
   * Check if fire spread is enabled
   * Automatically enabled when player has Fire Damage ability
   */
  hasFireSpread(): boolean {
    return this.fireDamagePercent > 0;
  }

  /**
   * Roll for freeze effect
   * @returns true if this hit should freeze the enemy
   */
  rollFreeze(): boolean {
    return Math.random() < this.freezeChance;
  }

  /**
   * Roll for a critical hit
   * @returns true if this hit should be critical
   */
  rollCrit(): boolean {
    return Math.random() < this.critChance;
  }

  /**
   * Calculate damage with possible critical hit
   * @param isCrit whether this is a critical hit
   */
  getDamageWithCrit(isCrit: boolean): number {
    const baseDamage = this.getDamage();
    return isCrit ? Math.floor(baseDamage * this.critDamageMultiplier) : baseDamage;
  }

  /**
   * Calculate piercing damage reduction
   * Each pierce reduces damage by 33%
   * @param hitNumber which enemy this is (0 = first, 1 = second, etc)
   */
  getPiercingDamage(hitNumber: number): number {
    const piercingPenalty = Math.pow(0.67, hitNumber);
    return Math.floor(this.getDamage() * piercingPenalty);
  }

  // ============================================
  // Ability Application (stacking)
  // ============================================

  /**
   * Add Front Arrow ability (+1 projectile, -25% damage)
   */
  addFrontArrow(): void {
    this.extraProjectiles++;
  }

  /**
   * Add Multishot ability (+1 side projectile pair, -15% attack speed)
   */
  addMultishot(): void {
    this.multishotCount++;
  }

  /**
   * Add Attack Speed boost (multiplicative stacking)
   * @param amount The percentage boost (e.g., 0.25 for +25%)
   */
  addAttackSpeedBoost(amount: number): void {
    this.attackSpeedMultiplier *= 1 + amount;
  }

  /**
   * Add Damage boost (multiplicative stacking)
   * @param amount The percentage boost (e.g., 0.30 for +30%)
   */
  addDamageBoost(amount: number): void {
    this.damageMultiplier *= 1 + amount;
  }

  /**
   * Add Piercing Shot ability (arrows pass through 1 additional enemy)
   * Stacking: Each level adds +1 enemy the arrow can pierce
   */
  addPiercing(): void {
    this.piercingLevel++;
  }

  /**
   * Add Ricochet ability (arrows bounce between enemies)
   * Stacking: Each level adds +3 bounces
   */
  addRicochet(): void {
    this.ricochetBounces += 3;
  }

  /**
   * Add Fire Damage ability (18% DOT)
   * Stacking: Additive (each level adds +18% fire damage)
   */
  addFireDamage(): void {
    this.fireDamagePercent += 0.18;
  }

  /**
   * Add Crit Boost ability (+10% chance, +40% damage)
   * Stacking: Additive for chance, multiplicative for damage
   */
  addCritBoost(): void {
    this.critChance = Math.min(1, this.critChance + 0.1); // Cap at 100%
    this.critDamageMultiplier *= 1.4; // +40% crit damage
  }

  // New V1 ability application methods

  /**
   * Add Ice Shot ability (15% freeze chance per level)
   * Stacking: Additive (each level adds +15% freeze chance)
   */
  addIceShot(): void {
    this.freezeChance = Math.min(1, this.freezeChance + 0.15); // Cap at 100%
  }

  /**
   * Add Poison Shot ability (10% DOT per second, stacks up to 5x)
   * Stacking: Additive poison damage per level (buffed from 5%)
   */
  addPoisonShot(): void {
    this.poisonDamagePercent += 0.1; // +10% weapon damage per second (buffed from 5%)
  }

  /**
   * Add Bleed ability (10% DOT, deals 2x damage when enemy is moving)
   * Stacking: Additive bleed damage per level
   */
  addBleed(): void {
    this.bleedDamagePercent += 0.1; // +10% weapon damage per tick
  }

  /**
   * Add Lightning Chain ability (chains to 2 additional enemies per level)
   * Stacking: Each level adds +2 chain targets
   * Damage penalty: -20% per chain (resistance through bodies)
   */
  addLightningChain(): void {
    this.lightningChainCount += 2;
  }

  /**
   * Add Diagonal Arrows ability (+2 arrows at 30 degree angles)
   * Stacking: Each level adds +2 diagonal arrows (1 pair)
   */
  addDiagonalArrows(): void {
    this.diagonalArrows += 2;
  }

  /**
   * Add Bloodthirst ability (+1% max HP per kill per level)
   * Stacking: Each level adds +1% max HP healed per kill (caps at 5%)
   */
  addBloodthirst(): void {
    this.bloodthirstHealPercent = Math.min(0.05, this.bloodthirstHealPercent + 0.01);
  }

  /**
   * Add Speed Boost ability (+15% movement speed, +5% attack speed)
   * Stacking: Multiplicative (each level multiplies speed by 1.15, attack speed by 1.05)
   * Now provides offensive utility alongside defensive mobility
   */
  addSpeedBoost(): void {
    this.movementSpeedMultiplier *= 1.15;
    this.attackSpeedMultiplier *= 1.05; // +5% attack speed bonus
  }

  /**
   * Add Max Health Boost ability (+15% max HP)
   * Stacking: Multiplicative (each level multiplies max HP by 1.15, buffed from 1.10)
   * Also heals the player by the gained amount
   */
  addMaxHealthBoost(): void {
    const newMaxHealth = Math.floor(this.maxHealth * 1.15); // +15% (buffed from 10%)
    const healthGain = newMaxHealth - this.maxHealth;
    this.maxHealth = newMaxHealth;
    this.health += healthGain; // Heal by the gained amount
    this.maxHealthMultiplier *= 1.15; // Buffed from 1.10
  }

  getMaxHealthMultiplier(): number {
    return this.maxHealthMultiplier;
  }

  /**
   * Add Dodge Master ability (+3% dodge chance per level)
   * Stacking: Additive (capped at 15%, buffed from 3%)
   */
  addDodgeMaster(): void {
    this.dodgeChance = Math.min(0.15, this.dodgeChance + 0.03); // +3% per level (buffed from 1%)
  }

  /**
   * Add Extra Life ability (+1 revive per level)
   * Stacking: Each level adds +1 extra life
   */
  addExtraLife(): void {
    this.extraLives++;
  }

  /**
   * Add Through Wall ability (arrows pass through walls)
   * Non-stacking: Only need one level
   */
  addThroughWall(): void {
    this.throughWallEnabled = true;
  }

  // New orbital and effect ability application methods

  /**
   * Add Rotating Orbs ability (+1 orb orbiting player)
   * Stacking: Each level adds +1 orb (max 5)
   */
  addRotatingOrbs(): void {
    this.rotatingOrbCount = Math.min(5, this.rotatingOrbCount + 1);
  }

  /**
   * Add Orbital Shields ability (+1 projectile-blocking shield)
   * Stacking: Each level adds +1 shield (max 3)
   */
  addOrbitalShields(): void {
    this.orbitalShieldCount = Math.min(3, this.orbitalShieldCount + 1);
  }

  /**
   * Add Spirit Pets ability (+1 homing wisp pet)
   * Stacking: Each level adds +1 pet (max 5)
   */
  addSpiritPets(): void {
    this.spiritPetCount = Math.min(5, this.spiritPetCount + 1);
  }

  /**
   * Add Death Nova ability (AOE damage on enemy kill)
   * Stacking: Each level increases radius and damage (max 3)
   */
  addDeathNova(): void {
    this.deathNovaLevel = Math.min(3, this.deathNovaLevel + 1);
  }

  /**
   * Add Homing Arrows ability (bullets slightly track enemies)
   * Stacking: Each level adds +15% tracking strength (max 45%)
   */
  addHomingArrows(): void {
    this.homingStrength = Math.min(0.45, this.homingStrength + 0.15);
  }

  /**
   * Add Explosive Arrows ability (AOE on bullet impact)
   * Stacking: Each level increases radius and damage (max 3)
   */
  addExplosiveArrows(): void {
    this.explosiveArrowLevel = Math.min(3, this.explosiveArrowLevel + 1);
  }

  /**
   * Add Shield Barrier ability (damage absorption shield)
   * Stacking: Each level increases shield HP (max 3)
   */
  addShieldBarrier(): void {
    this.shieldBarrierLevel = Math.min(3, this.shieldBarrierLevel + 1);
  }

  /**
   * Add Knockback ability (push enemies on hit)
   * Stacking: Each level increases knockback force (max 3)
   */
  addKnockback(): void {
    this.knockbackStrength = Math.min(3, this.knockbackStrength + 1);
  }

  // Game modifier abilities

  /**
   * Add Ascetic ability (no healing, +200% XP gain)
   * Non-stacking: Only need one level
   */
  addAscetic(): void {
    this.asceticEnabled = true;
  }

  /**
   * Add Horde Magnet ability (+50% enemies, +100% XP gain per level)
   * Stacking: Each level increases challenge and rewards
   */
  addHordeMagnet(): void {
    this.hordeMagnetLevel++;
  }

  // Note: addShatter() and addFireSpread() removed - these are now passive effects:
  // - Shatter: Automatically enabled when player has Ice Shot (freezeChance > 0)
  // - Fire Spread: Automatically enabled when player has Fire Damage (fireDamagePercent > 0)

  // ============================================
  // Iron Will (Epic Talent) - Bonus HP when low health
  // ============================================

  /**
   * Add flat max health bonus (for Iron Will talent)
   * Does NOT heal the player, just increases max HP
   */
  addMaxHealthBonus(amount: number): void {
    this.maxHealth += amount;
  }

  /**
   * Remove flat max health bonus (for Iron Will talent deactivation)
   * Caps current health to new max if needed
   */
  removeMaxHealthBonus(amount: number): void {
    this.maxHealth = Math.max(1, this.maxHealth - amount);
    // Cap current health to new max health
    if (this.health > this.maxHealth) {
      this.health = this.maxHealth;
    }
  }

  // ============================================
  // Reset / Utility
  // ============================================

  /**
   * Reset all run-based stats (called on death/new game)
   */
  resetRunStats(): void {
    this.health = this.maxHealth;
    this.currentXP = 0;
    this.level = 1;
    this.extraProjectiles = 0;
    this.multishotCount = 0;
    this.piercingLevel = 0;
    this.ricochetBounces = 0;
    this.damageMultiplier = 1.0;
    this.attackSpeedMultiplier = 1.0;
    this.fireDamagePercent = 0;
    this.critChance = 0;
    this.critDamageMultiplier = 1.5;
    this.dodgeChance = 0;
    // Reset new V1 abilities
    this.freezeChance = 0;
    this.poisonDamagePercent = 0;
    this.bleedDamagePercent = 0;
    this.lightningChainCount = 0;
    this.diagonalArrows = 0;
    this.bloodthirstHealPercent = 0;
    this.movementSpeedMultiplier = 1.0;
    this.maxHealthMultiplier = 1.0;
    // Reset devil abilities
    this.extraLives = 0;
    this.throughWallEnabled = false;
    // Reset new orbital and effect abilities
    this.rotatingOrbCount = 0;
    this.orbitalShieldCount = 0;
    this.spiritPetCount = 0;
    this.deathNovaLevel = 0;
    this.homingStrength = 0;
    this.explosiveArrowLevel = 0;
    this.shieldBarrierLevel = 0;
    this.knockbackStrength = 0;
    // Reset game modifiers
    this.asceticEnabled = false;
    this.hordeMagnetLevel = 0;
    // Note: Shatter and Fire Spread are passive effects (no reset needed)
  }

  /**
   * Get a snapshot of current stats for debugging/UI
   */
  getStatsSnapshot(): {
    health: number;
    maxHealth: number;
    level: number;
    xp: number;
    xpToLevelUp: number;
    damage: number;
    attackSpeed: number;
    extraProjectiles: number;
    multishotCount: number;
    piercingLevel: number;
    ricochetBounces: number;
    fireDamagePercent: number;
    critChance: number;
    critDamageMultiplier: number;
    freezeChance: number;
    poisonDamagePercent: number;
    bleedDamagePercent: number;
    lightningChainCount: number;
    diagonalArrows: number;
    bloodthirstHealPercent: number;
    movementSpeedMultiplier: number;
    maxHealthMultiplier: number;
    extraLives: number;
    throughWallEnabled: boolean;
    hasFireSpread: boolean;
    hasShatter: boolean;
    rotatingOrbCount: number;
    orbitalShieldCount: number;
    spiritPetCount: number;
    deathNovaLevel: number;
    homingStrength: number;
    explosiveArrowLevel: number;
    shieldBarrierLevel: number;
    knockbackStrength: number;
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
      bleedDamagePercent: this.bleedDamagePercent,
      lightningChainCount: this.lightningChainCount,
      diagonalArrows: this.diagonalArrows,
      bloodthirstHealPercent: this.bloodthirstHealPercent,
      movementSpeedMultiplier: this.movementSpeedMultiplier,
      maxHealthMultiplier: this.maxHealthMultiplier,
      extraLives: this.extraLives,
      throughWallEnabled: this.throughWallEnabled,
      hasFireSpread: this.hasFireSpread(),
      hasShatter: this.getShatterLevel() > 0,
      rotatingOrbCount: this.rotatingOrbCount,
      orbitalShieldCount: this.orbitalShieldCount,
      spiritPetCount: this.spiritPetCount,
      deathNovaLevel: this.deathNovaLevel,
      homingStrength: this.homingStrength,
      explosiveArrowLevel: this.explosiveArrowLevel,
      shieldBarrierLevel: this.shieldBarrierLevel,
      knockbackStrength: this.knockbackStrength,
    };
  }
}
