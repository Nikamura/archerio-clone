/**
 * RangedEnemy - Base class for enemies that shoot projectiles
 *
 * Provides common functionality for ranged enemies:
 * - Fire rate and cooldown management
 * - Projectile speed multiplier
 * - Telegraph line support (optional)
 * - Common shooting patterns
 */

import Phaser from "phaser";
import Enemy, { EnemyOptions } from "../Enemy";
import EnemyBulletPool from "../../systems/EnemyBulletPool";

export interface RangedEnemyOptions extends EnemyOptions {
  /** Base fire rate in milliseconds (default varies by enemy type) */
  baseFireRate?: number;
}

export default abstract class RangedEnemy extends Enemy {
  protected bulletPool: EnemyBulletPool;
  protected lastShotTime: number = 0;
  protected fireRate: number;
  protected projectileSpeedMultiplier: number = 1.0;
  protected telegraphLine?: Phaser.GameObjects.Line;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bulletPool: EnemyBulletPool,
    baseFireRate: number,
    options?: EnemyOptions,
  ) {
    super(scene, x, y, options);

    this.bulletPool = bulletPool;

    // Apply chapter-specific modifiers
    this.fireRate = baseFireRate * (options?.attackCooldownMultiplier ?? 1.0);
    this.projectileSpeedMultiplier = options?.projectileSpeedMultiplier ?? 1.0;
  }

  /**
   * Create a telegraph line for aim indication
   */
  protected createTelegraph(color: number = 0xff0000, alpha: number = 0.6): void {
    this.telegraphLine = this.scene.add.line(0, 0, 0, 0, 0, 0, color, alpha);
    this.telegraphLine.setOrigin(0, 0);
    this.telegraphLine.setVisible(false);
    this.telegraphLine.setDepth(0);
  }

  /**
   * Show telegraph line pointing to target
   */
  protected showTelegraph(targetX: number, targetY: number, length: number = 300): void {
    if (!this.telegraphLine) return;

    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    const endX = this.x + Math.cos(angle) * length;
    const endY = this.y + Math.sin(angle) * length;

    this.telegraphLine.setTo(this.x, this.y, endX, endY);
    this.telegraphLine.setVisible(true);
  }

  /**
   * Hide telegraph line
   */
  protected hideTelegraph(): void {
    if (this.telegraphLine) {
      this.telegraphLine.setVisible(false);
    }
  }

  /**
   * Check if enough time has passed to fire again
   * Fire rate is scaled by game speed (physics.world.timeScale = 1/multiplier)
   */
  protected canFire(time: number): boolean {
    // Scale fire rate by game speed multiplier
    const timeScale = this.scene.physics.world.timeScale;
    const gameSpeedMultiplier = timeScale > 0 ? 1 / timeScale : 1;
    const scaledFireRate = this.fireRate / gameSpeedMultiplier;

    return time - this.lastShotTime > scaledFireRate;
  }

  /**
   * Record shot time
   */
  protected recordShot(time: number): void {
    this.lastShotTime = time;
  }

  /**
   * Fire a single projectile at the target
   */
  protected fireAtTarget(targetX: number, targetY: number, speed: number): void {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    const bulletSpeed = speed * this.projectileSpeedMultiplier;
    this.bulletPool.spawn(this.x, this.y, angle, bulletSpeed);
  }

  /**
   * Fire a spread of projectiles in multiple directions
   */
  protected fireSpread(angles: number[], speed: number): void {
    const bulletSpeed = speed * this.projectileSpeedMultiplier;
    angles.forEach((angle) => {
      this.bulletPool.spawn(this.x, this.y, angle, bulletSpeed);
    });
  }

  /**
   * Calculate predictive aim based on player velocity
   */
  protected calculatePredictiveTarget(
    targetX: number,
    targetY: number,
    bulletSpeed: number,
  ): { x: number; y: number } {
    const distance = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
    const travelTime = distance / bulletSpeed;

    // Try to get player velocity for prediction
    const gameScene = this.scene as { player?: { body?: Phaser.Physics.Arcade.Body } };
    if (gameScene.player?.body) {
      const playerBody = gameScene.player.body;
      // Predict where player will be when bullet arrives (with 0.5 factor to not be too accurate)
      return {
        x: targetX + playerBody.velocity.x * travelTime * 0.5,
        y: targetY + playerBody.velocity.y * travelTime * 0.5,
      };
    }

    return { x: targetX, y: targetY };
  }

  /**
   * Clamp position to world bounds
   */
  protected clampToWorldBounds(margin: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      const worldBounds = this.scene.physics.world.bounds;
      this.x = Phaser.Math.Clamp(this.x, worldBounds.left + margin, worldBounds.right - margin);
      this.y = Phaser.Math.Clamp(this.y, worldBounds.top + margin, worldBounds.bottom - margin);
    }
  }

  destroy(fromScene?: boolean): void {
    if (this.telegraphLine) {
      this.telegraphLine.destroy();
    }
    super.destroy(fromScene);
  }
}
