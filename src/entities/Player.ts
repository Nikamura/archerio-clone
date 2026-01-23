import Phaser from "phaser";
import { PlayerStats, DamageResult } from "../systems/PlayerStats";
import { getHeroSpriteKey, HeroId } from "../config/themeData";

export default class Player extends Phaser.Physics.Arcade.Sprite {
  private stats: PlayerStats;
  private isMoving: boolean = false;
  private hitboxRadius: number = 16;
  private isPlayingShootAnim: boolean = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    statsOptions?: {
      maxHealth?: number;
      baseDamage?: number;
      baseAttackSpeed?: number;
      xpToLevelUp?: number;
      critChance?: number;
      critDamage?: number;
    },
    heroId: string = "atreus",
  ) {
    // Determine texture key based on heroId
    const textureKey = getHeroSpriteKey(heroId as HeroId);

    super(scene, x, y, textureKey);

    // Initialize stats immediately after super
    this.stats = new PlayerStats(statsOptions);

    if (!this.stats) {
      console.error("Player: Failed to initialize PlayerStats!");
    }

    // Add to scene
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Set size to match sprite (original archer is 64x64, icons are 48x48)
    // We'll normalize all heroes to 64x64 for consistent hitboxes/gameplay
    this.setDisplaySize(64, 64);
    // Don't use setCollideWorldBounds - it doesn't work correctly with setCircle + offset
    // We manually clamp position in update() instead
    this.setDrag(800, 800);

    // Set up centered circular hitbox for player
    if (this.body) {
      const body = this.body as Phaser.Physics.Arcade.Body;
      const displaySize = 64;
      this.hitboxRadius = 16; // Player hitbox - not too large to allow dodging
      // Must call setSize before setCircle for proper collision detection
      body.setSize(displaySize, displaySize);
      // Offset centers the 32px diameter circle within the 64px display
      const offset = (displaySize - this.hitboxRadius * 2) / 2;
      body.setCircle(this.hitboxRadius, offset, offset);
    }

    console.log("Player created at", x, y, "with stats:", statsOptions);
  }

  update(_time: number, _delta: number) {
    // Check if player is moving
    const velocity = this.body?.velocity;
    if (velocity) {
      this.isMoving = Math.abs(velocity.x) > 10 || Math.abs(velocity.y) > 10;
    }

    // Player sprite should remain upright - no rotation based on movement direction

    // Manually clamp position to world bounds based on hitbox radius
    // This is more reliable than setCollideWorldBounds with setCircle + offset
    const camera = this.scene.cameras.main;
    const minX = this.hitboxRadius;
    const maxX = camera.width - this.hitboxRadius;
    const minY = this.hitboxRadius;
    const maxY = camera.height - this.hitboxRadius;

    if (this.x < minX) {
      this.x = minX;
      if (this.body) this.body.velocity.x = 0;
    } else if (this.x > maxX) {
      this.x = maxX;
      if (this.body) this.body.velocity.x = 0;
    }

    if (this.y < minY) {
      this.y = minY;
      if (this.body) this.body.velocity.y = 0;
    } else if (this.y > maxY) {
      this.y = maxY;
      if (this.body) this.body.velocity.y = 0;
    }
  }

  setVelocity(x: number, y: number): this {
    if (this.body) {
      this.body.velocity.x = x;
      this.body.velocity.y = y;
    }
    return this;
  }

  takeDamage(amount: number): DamageResult {
    return this.stats?.takeDamage(amount) ?? { damaged: false, died: false };
  }

  isPlayerInvincible(): boolean {
    return this.stats?.isPlayerInvincible() ?? false;
  }

  heal(amount: number) {
    this.stats?.heal(amount);
  }

  getHealth(): number {
    return this.stats?.getHealth() ?? 100;
  }

  getMaxHealth(): number {
    return this.stats?.getMaxHealth() ?? 100;
  }

  isDead(): boolean {
    return this.stats?.isDead() ?? false;
  }

  isPlayerMoving(): boolean {
    return this.isMoving;
  }

  // XP/Leveling methods - delegate to stats
  addXP(amount: number): boolean {
    return this.stats?.addXP(amount) ?? false;
  }

  getXP(): number {
    return this.stats?.getXP() ?? 0;
  }

  getXPToLevelUp(): number {
    return this.stats?.getXPToLevelUp() ?? 10;
  }

  getLevel(): number {
    return this.stats?.getLevel() ?? 1;
  }

  getXPPercentage(): number {
    return this.stats?.getXPPercentage() ?? 0;
  }

  // Stat getters - delegate to stats
  getDamage(): number {
    return this.stats?.getDamage() ?? 10;
  }

  getAttackSpeed(): number {
    return this.stats?.getAttackSpeed() ?? 1.0;
  }

  getExtraProjectiles(): number {
    return this.stats?.getExtraProjectiles() ?? 0;
  }

  getMultishotCount(): number {
    return this.stats?.getMultishotCount() ?? 0;
  }

  // Ability application - delegate to stats
  addAttackSpeedBoost(amount: number) {
    this.stats?.addAttackSpeedBoost(amount);
  }

  addDamageBoost(amount: number) {
    this.stats?.addDamageBoost(amount);
  }

  addFrontArrow() {
    this.stats?.addFrontArrow();
  }

  addMultishot() {
    this.stats?.addMultishot();
  }

  addPiercing() {
    this.stats?.addPiercing();
  }

  addRicochet() {
    this.stats?.addRicochet();
  }

  addFireDamage() {
    this.stats?.addFireDamage();
  }

  addCritBoost() {
    this.stats?.addCritBoost();
  }

  // New V1 ability application methods
  addIceShot() {
    this.stats?.addIceShot();
  }

  addPoisonShot() {
    this.stats?.addPoisonShot();
  }

  addBleed() {
    this.stats?.addBleed();
  }

  addLightningChain() {
    this.stats?.addLightningChain();
  }

  addDiagonalArrows() {
    this.stats?.addDiagonalArrows();
  }

  addBloodthirst() {
    this.stats?.addBloodthirst();
  }

  addSpeedBoost() {
    this.stats?.addSpeedBoost();
  }

  addMaxHealthBoost() {
    this.stats?.addMaxHealthBoost();
  }

  addDodgeMaster() {
    this.stats?.addDodgeMaster();
  }

  addExtraLife() {
    this.stats?.addExtraLife();
  }

  addThroughWall() {
    this.stats?.addThroughWall();
  }

  // New orbital and effect ability application methods
  addRotatingOrbs() {
    this.stats?.addRotatingOrbs();
  }

  addOrbitalShields() {
    this.stats?.addOrbitalShields();
  }

  addSpiritPets() {
    this.stats?.addSpiritPets();
  }

  addDeathNova() {
    this.stats?.addDeathNova();
  }

  addHomingArrows() {
    this.stats?.addHomingArrows();
  }

  addExplosiveArrows() {
    this.stats?.addExplosiveArrows();
  }

  addShieldBarrier() {
    this.stats?.addShieldBarrier();
  }

  addKnockback() {
    this.stats?.addKnockback();
  }

  // Game modifier abilities
  addAscetic() {
    this.stats?.addAscetic();
  }

  addHordeMagnet() {
    this.stats?.addHordeMagnet();
  }

  isAsceticEnabled(): boolean {
    return this.stats?.isAsceticEnabled() ?? false;
  }

  getHordeMagnetLevel(): number {
    return this.stats?.getHordeMagnetLevel() ?? 0;
  }

  getHordeMagnetEnemyMultiplier(): number {
    return this.stats?.getHordeMagnetEnemyMultiplier() ?? 1.0;
  }

  getXPMultiplier(): number {
    return this.stats?.getXPMultiplier() ?? 1.0;
  }

  // Note: addShatter() and addFireSpread() removed - these are now passive effects:
  // - Shatter: Automatically enabled when player has Ice Shot
  // - Fire Spread: Automatically enabled when player has Fire Damage

  // Iron Will talent support (bonus HP when low health)
  addMaxHealthBonus(amount: number) {
    this.stats?.addMaxHealthBonus(amount);
  }

  removeMaxHealthBonus(amount: number) {
    this.stats?.removeMaxHealthBonus(amount);
  }

  // New ability getters
  getPiercingLevel(): number {
    return this.stats?.getPiercingLevel() ?? 0;
  }

  getRicochetBounces(): number {
    return this.stats?.getRicochetBounces() ?? 0;
  }

  getFireDamagePercent(): number {
    return this.stats?.getFireDamagePercent() ?? 0;
  }

  getFireDamage(): number {
    return this.stats?.getFireDamage() ?? 0;
  }

  getCritChance(): number {
    return this.stats?.getCritChance() ?? 0;
  }

  getCritDamageMultiplier(): number {
    return this.stats?.getCritDamageMultiplier() ?? 1.5;
  }

  rollCrit(): boolean {
    return this.stats?.rollCrit() ?? false;
  }

  getDodgeChance(): number {
    return this.stats?.getDodgeChance() ?? 0;
  }

  setDodgeChance(chance: number): void {
    this.stats?.setDodgeChance(chance);
  }

  getDamageWithCrit(isCrit: boolean): number {
    return this.stats?.getDamageWithCrit(isCrit) ?? this.getDamage();
  }

  getPiercingDamage(hitNumber: number): number {
    return this.stats?.getPiercingDamage(hitNumber) ?? this.getDamage();
  }

  // New V1 ability getters
  getFreezeChance(): number {
    return this.stats?.getFreezeChance() ?? 0;
  }

  rollFreeze(): boolean {
    return this.stats?.rollFreeze() ?? false;
  }

  getPoisonDamagePercent(): number {
    return this.stats?.getPoisonDamagePercent() ?? 0;
  }

  getPoisonDamage(): number {
    return this.stats?.getPoisonDamage() ?? 0;
  }

  getBleedDamagePercent(): number {
    return this.stats?.getBleedDamagePercent() ?? 0;
  }

  getBleedDamage(): number {
    return this.stats?.getBleedDamage() ?? 0;
  }

  getLightningChainCount(): number {
    return this.stats?.getLightningChainCount() ?? 0;
  }

  getDiagonalArrows(): number {
    return this.stats?.getDiagonalArrows() ?? 0;
  }

  getBloodthirstHeal(): number {
    return this.stats?.getBloodthirstHeal() ?? 0;
  }

  getMovementSpeedMultiplier(): number {
    return this.stats?.getMovementSpeedMultiplier() ?? 1.0;
  }

  // Devil ability getters
  hasExtraLife(): boolean {
    return this.stats?.hasExtraLife() ?? false;
  }

  useExtraLife(): boolean {
    return this.stats?.useExtraLife() ?? false;
  }

  isThroughWallEnabled(): boolean {
    return this.stats?.isThroughWallEnabled() ?? false;
  }

  // Conditional damage ability getters
  getShatterLevel(): number {
    return this.stats?.getShatterLevel() ?? 0;
  }

  getShatterDamageMultiplier(): number {
    return this.stats?.getShatterDamageMultiplier() ?? 1.0;
  }

  hasFireSpread(): boolean {
    return this.stats?.hasFireSpread() ?? false;
  }

  // Lightning chain damage multiplier (progressive reduction per chain)
  getLightningChainDamageMultiplier(chainNumber: number): number {
    return this.stats?.getLightningChainDamageMultiplier(chainNumber) ?? 1.0;
  }

  // New orbital and effect ability getters
  getRotatingOrbCount(): number {
    return this.stats?.getRotatingOrbCount() ?? 0;
  }

  getOrbitalShieldCount(): number {
    return this.stats?.getOrbitalShieldCount() ?? 0;
  }

  getSpiritPetCount(): number {
    return this.stats?.getSpiritPetCount() ?? 0;
  }

  getDeathNovaLevel(): number {
    return this.stats?.getDeathNovaLevel() ?? 0;
  }

  getDeathNovaRadius(): number {
    return this.stats?.getDeathNovaRadius() ?? 0;
  }

  getDeathNovaDamagePercent(): number {
    return this.stats?.getDeathNovaDamagePercent() ?? 0;
  }

  getHomingStrength(): number {
    return this.stats?.getHomingStrength() ?? 0;
  }

  getExplosiveArrowLevel(): number {
    return this.stats?.getExplosiveArrowLevel() ?? 0;
  }

  getExplosiveArrowRadius(): number {
    return this.stats?.getExplosiveArrowRadius() ?? 0;
  }

  getExplosiveArrowDamagePercent(): number {
    return this.stats?.getExplosiveArrowDamagePercent() ?? 0;
  }

  getShieldBarrierLevel(): number {
    return this.stats?.getShieldBarrierLevel() ?? 0;
  }

  getShieldBarrierMaxPercent(): number {
    return this.stats?.getShieldBarrierMaxPercent() ?? 0;
  }

  getShieldBarrierRegenRate(): number {
    return this.stats?.getShieldBarrierRegenRate() ?? 0;
  }

  getKnockbackStrength(): number {
    return this.stats?.getKnockbackStrength() ?? 0;
  }

  getKnockbackForce(): number {
    return this.stats?.getKnockbackForce() ?? 0;
  }

  // Reset run-based stats
  resetRunStats() {
    this.stats?.resetRunStats();
  }

  // Get underlying stats for debugging
  getStats(): PlayerStats {
    return this.stats;
  }

  // ============================================
  // Shooting Animation
  // ============================================

  /**
   * Play a brief shooting animation (scale pulse + slight recoil)
   * Called by GameScene when the player fires
   */
  playShootAnimation(angle: number): void {
    // Prevent overlapping animations
    if (this.isPlayingShootAnim || !this.scene) return;
    this.isPlayingShootAnim = true;

    // Calculate slight recoil offset (opposite to shooting direction)
    const recoilDistance = 3;
    const recoilX = -Math.cos(angle) * recoilDistance;
    const recoilY = -Math.sin(angle) * recoilDistance;
    const originalX = this.x;
    const originalY = this.y;

    // Quick scale-up "draw" effect
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.15,
      scaleY: 0.9, // Squash horizontally for bow-draw effect
      duration: 50,
      ease: "Quad.easeOut",
      onComplete: () => {
        // Release: snap back with slight overshoot
        this.scene.tweens.add({
          targets: this,
          scaleX: 1.0,
          scaleY: 1.0,
          duration: 100,
          ease: "Back.easeOut",
          onComplete: () => {
            this.isPlayingShootAnim = false;
          },
        });
      },
    });

    // Recoil movement (separate tween for position)
    this.scene.tweens.add({
      targets: this,
      x: originalX + recoilX,
      y: originalY + recoilY,
      duration: 50,
      ease: "Quad.easeOut",
      yoyo: true,
    });
  }
}
