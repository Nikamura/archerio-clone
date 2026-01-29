import Phaser from "phaser";
import Player from "../entities/Player";

/**
 * ShieldBarrierManager - Manages the shield barrier ability
 *
 * Shield Barrier absorbs damage before health, regenerates over time,
 * and displays a visual shield circle around the player.
 */
export class ShieldBarrierManager {
  private scene: Phaser.Scene;
  private player: Player;

  // Shield state
  private currentShield: number = 0;
  private maxShield: number = 0;
  private regenRate: number = 0; // Per second
  private lastRegenTime: number = 0;
  private lastShieldLevel: number = 0; // Track to detect ability upgrades

  // Visual
  private shieldGraphics: Phaser.GameObjects.Graphics | null = null;
  private shieldAlpha: number = 0.3;

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene;
    this.player = player;
    this.shieldGraphics = scene.add.graphics();
    this.shieldGraphics.setDepth(player.depth - 1);
  }

  /**
   * Update shield stats based on player's shield barrier level
   * Called when ability is acquired or upgraded
   * @param time Current game time (optional, used to initialize regen timer)
   */
  updateShieldStats(time?: number): void {
    const shieldPercent = this.player.getShieldBarrierMaxPercent();
    const playerMaxHealth = this.player.getMaxHealth();

    // For Glass Cannon builds, use flat shield values to prevent shield from being useless
    // when HP is capped at 100. Use whichever is higher: percentage-based or flat amount.
    const percentBasedShield = Math.floor(playerMaxHealth * shieldPercent);
    const flatShield = this.player.isGlassCannonEnabled()
      ? this.player.getShieldBarrierFlatAmount()
      : 0;
    this.maxShield = Math.max(percentBasedShield, flatShield);
    this.regenRate = this.player.getShieldBarrierRegenRate();

    // On first acquisition, start with full shield and initialize regen timer
    if (this.currentShield === 0 && this.maxShield > 0) {
      this.currentShield = this.maxShield;
      // Initialize lastRegenTime to prevent instant regen after first damage
      if (time !== undefined) {
        this.lastRegenTime = time;
      }
    }

    // Cap current shield to new max
    this.currentShield = Math.min(this.currentShield, this.maxShield);
  }

  /**
   * Absorb incoming damage
   * @returns remaining damage after shield absorption
   */
  absorbDamage(damage: number): number {
    if (this.maxShield <= 0 || this.currentShield <= 0) {
      return damage;
    }

    const absorbed = Math.min(damage, this.currentShield);
    this.currentShield -= absorbed;
    const remainingDamage = damage - absorbed;

    // Flash shield when absorbing damage
    if (absorbed > 0) {
      this.flashShield();
    }

    return remainingDamage;
  }

  /**
   * Update shield regeneration and visuals
   */
  update(time: number, _delta: number): void {
    // Check if shield ability level changed
    const currentLevel = this.player.getShieldBarrierLevel();
    if (currentLevel !== this.lastShieldLevel) {
      this.lastShieldLevel = currentLevel;
      this.updateShieldStats(time);
    }

    // Safety check: if player has shield level but maxShield is 0, force update
    // This handles edge cases where passiveEffectSystem.update() was skipped
    // during auto-level (e.g., if isLevelingUp flag wasn't properly reset)
    if (currentLevel > 0 && this.maxShield <= 0) {
      this.updateShieldStats(time);
    }

    if (this.maxShield <= 0) {
      // No shield ability
      if (this.shieldGraphics) {
        this.shieldGraphics.clear();
      }
      return;
    }

    // Regenerate shield over time
    if (this.currentShield < this.maxShield) {
      const timeSinceLastRegen = time - this.lastRegenTime;
      if (timeSinceLastRegen >= 100) {
        // Regen every 100ms
        const regenAmount = (this.maxShield * this.regenRate * timeSinceLastRegen) / 1000;
        this.currentShield = Math.min(this.maxShield, this.currentShield + regenAmount);
        this.lastRegenTime = time;
      }
    }

    // Update visual
    this.drawShield();
  }

  /**
   * Draw shield visual around player
   */
  private drawShield(): void {
    if (!this.shieldGraphics) return;

    this.shieldGraphics.clear();

    if (this.currentShield <= 0) return;

    const shieldPercent = this.currentShield / this.maxShield;
    const radius = 40 + shieldPercent * 10; // Shield shrinks as it depletes

    // Draw shield circle
    this.shieldGraphics.lineStyle(3, 0x4488ff, this.shieldAlpha * shieldPercent);
    this.shieldGraphics.strokeCircle(this.player.x, this.player.y, radius);

    // Inner glow
    this.shieldGraphics.fillStyle(0x4488ff, this.shieldAlpha * 0.3 * shieldPercent);
    this.shieldGraphics.fillCircle(this.player.x, this.player.y, radius);
  }

  /**
   * Flash shield when absorbing damage
   */
  private flashShield(): void {
    if (!this.shieldGraphics) return;

    this.shieldAlpha = 0.8;
    this.scene.tweens.add({
      targets: this,
      shieldAlpha: 0.3,
      duration: 200,
      ease: "Quad.easeOut",
    });
  }

  /**
   * Get current shield amount
   */
  getCurrentShield(): number {
    return this.currentShield;
  }

  /**
   * Get max shield amount
   */
  getMaxShield(): number {
    return this.maxShield;
  }

  /**
   * Get shield percentage (0-1)
   */
  getShieldPercent(): number {
    if (this.maxShield <= 0) return 0;
    return this.currentShield / this.maxShield;
  }

  /**
   * Check if shield is active
   */
  isActive(): boolean {
    return this.maxShield > 0;
  }

  /**
   * Reset shield (for new run)
   */
  reset(): void {
    this.currentShield = 0;
    this.maxShield = 0;
    this.regenRate = 0;
    if (this.shieldGraphics) {
      this.shieldGraphics.clear();
    }
  }

  /**
   * Clean up
   */
  destroy(): void {
    if (this.shieldGraphics) {
      this.shieldGraphics.destroy();
      this.shieldGraphics = null;
    }
  }
}
