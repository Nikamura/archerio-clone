import Phaser from "phaser";
import Player from "../../entities/Player";
import Enemy from "../../entities/Enemy";
import type BulletPool from "../../systems/BulletPool";
import type WallGroup from "../../systems/WallGroup";
import { audioManager } from "../../systems/AudioManager";
import { hapticManager } from "../../systems/HapticManager";

/**
 * Event handlers for shooting-related side effects
 */
export interface ShootingEventHandlers {
  onShotFired: () => void;
}

/**
 * Configuration for projectile spawning based on equipped weapon
 */
export interface WeaponProjectileConfig {
  sprite: string;
  sizeMultiplier: number;
}

/**
 * Configuration for ShootingSystem
 */
export interface ShootingSystemConfig {
  scene: Phaser.Scene;
  player: Player;
  enemies: Phaser.Physics.Arcade.Group;
  bulletPool: BulletPool;
  wallGroup: WallGroup;
  baseFireRate: number;
  weaponProjectileConfig: WeaponProjectileConfig | null;
  eventHandlers: ShootingEventHandlers;
}

/**
 * ShootingSystem - Handles all player shooting mechanics
 *
 * Extracted from GameScene to provide focused shooting management.
 * Manages:
 * - Enemy targeting with line-of-sight checking
 * - Target caching for performance optimization
 * - Fire rate calculations
 * - Multiple projectile type spawning (main, extra, multishot, diagonal, rear)
 */
export class ShootingSystem {
  private scene: Phaser.Scene;
  private player: Player;
  private enemies: Phaser.Physics.Arcade.Group;
  private bulletPool: BulletPool;
  private wallGroup: WallGroup;
  private eventHandlers: ShootingEventHandlers;

  // Weapon configuration
  private weaponProjectileConfig: WeaponProjectileConfig | null;

  // Fire rate state
  private fireRate: number;
  private lastShotTime: number = 0;

  // Targeting cache for performance
  private cachedNearestEnemy: Enemy | null = null;
  private nearestEnemyCacheFrame: number = 0;
  private readonly NEAREST_ENEMY_CACHE_FRAMES = 3; // Recalculate every 3 frames

  // Constants
  private readonly BULLET_SPEED = 400;
  private readonly SPAWN_OFFSET = 20; // Pixels ahead in firing direction (past player radius of 16)

  constructor(config: ShootingSystemConfig) {
    this.scene = config.scene;
    this.player = config.player;
    this.enemies = config.enemies;
    this.bulletPool = config.bulletPool;
    this.wallGroup = config.wallGroup;
    this.fireRate = config.baseFireRate;
    this.weaponProjectileConfig = config.weaponProjectileConfig;
    this.eventHandlers = config.eventHandlers;
  }

  /**
   * Try to shoot at the nearest enemy if conditions are met
   * @returns true if a shot was fired
   */
  tryShoot(
    time: number,
    isInTransition: boolean,
    showingTutorial: boolean,
    isGameOver: boolean,
  ): boolean {
    // Don't shoot during transitions, tutorial, or game over
    if (isInTransition || showingTutorial || isGameOver) {
      return false;
    }

    // Check fire rate cooldown
    if (time - this.lastShotTime <= this.getEffectiveFireRate()) {
      return false;
    }

    // Find and shoot at nearest enemy
    const nearestEnemy = this.getCachedNearestEnemy();
    if (nearestEnemy) {
      this.shootAtEnemy(nearestEnemy, time);
      return true;
    }

    return false;
  }

  /**
   * Get the nearest enemy with caching for performance
   * Only recalculates every NEAREST_ENEMY_CACHE_FRAMES frames
   */
  getCachedNearestEnemy(): Enemy | null {
    const currentFrame = this.scene.game.getFrame();

    // Check if cache is stale
    if (currentFrame - this.nearestEnemyCacheFrame >= this.NEAREST_ENEMY_CACHE_FRAMES) {
      this.cachedNearestEnemy = this.findNearestEnemy();
      this.nearestEnemyCacheFrame = currentFrame;
    }

    // Validate cached enemy is still valid (active, has body, not destroyed)
    if (
      this.cachedNearestEnemy &&
      (!this.cachedNearestEnemy.active || !this.cachedNearestEnemy.body)
    ) {
      // Cache is invalid, force refresh
      this.cachedNearestEnemy = this.findNearestEnemy();
      this.nearestEnemyCacheFrame = currentFrame;
    }

    return this.cachedNearestEnemy;
  }

  /**
   * Invalidate the nearest enemy cache (call when enemies die or spawn)
   */
  invalidateTargetCache(): void {
    this.nearestEnemyCacheFrame = 0;
    this.cachedNearestEnemy = null;
  }

  /**
   * Get the effective fire rate accounting for player attack speed and game speed
   * Game speed is derived from physics.world.timeScale (timeScale = 1/multiplier)
   */
  getEffectiveFireRate(): number {
    if (!this.player) return this.fireRate;
    const baseRate = this.fireRate / this.player.getAttackSpeed();

    // Scale fire rate by game speed multiplier
    // physics.world.timeScale = 1/multiplier, so multiplier = 1/timeScale
    const timeScale = this.scene.physics.world.timeScale;
    const gameSpeedMultiplier = timeScale > 0 ? 1 / timeScale : 1;

    // Divide fire rate by game speed so attacks happen faster at higher speeds
    return baseRate / gameSpeedMultiplier;
  }

  /**
   * Set the base fire rate
   */
  setFireRate(rate: number): void {
    this.fireRate = rate;
  }

  /**
   * Get the current base fire rate
   */
  getFireRate(): number {
    return this.fireRate;
  }

  /**
   * Get last shot time (for state saving/loading)
   */
  getLastShotTime(): number {
    return this.lastShotTime;
  }

  /**
   * Set last shot time (for state loading)
   */
  setLastShotTime(time: number): void {
    this.lastShotTime = time;
  }

  /**
   * Find the nearest enemy with line-of-sight checking
   */
  private findNearestEnemy(): Enemy | null {
    let nearestVisibleEnemy: Enemy | null = null;
    let nearestVisibleDistance = Infinity;
    let nearestBlockedEnemy: Enemy | null = null;
    let nearestBlockedDistance = Infinity;

    const children = this.enemies.getChildren();

    // Safety check for player position
    if (!this.player || !isFinite(this.player.x) || !isFinite(this.player.y)) {
      console.warn("findNearestEnemy: Invalid player position", this.player?.x, this.player?.y);
      return null;
    }

    // Check if player can shoot through walls
    const canShootThroughWalls = this.player.isThroughWallEnabled();

    // Debug: Log when there are enemies in group but none are targetable
    let activeCount = 0;
    let inactiveCount = 0;
    let bodylessCount = 0;

    children.forEach((enemy) => {
      const e = enemy as Enemy;

      // Debug: Track why enemies might be skipped
      if (!e.active) {
        inactiveCount++;
        return;
      }

      if (!e.body) {
        bodylessCount++;
        return;
      }

      activeCount++;

      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);

      // Check line of sight if player can't shoot through walls
      const hasLineOfSight =
        canShootThroughWalls ||
        !this.wallGroup ||
        this.wallGroup.hasLineOfSight(this.player.x, this.player.y, e.x, e.y);

      if (hasLineOfSight) {
        // Prioritize enemies with clear line of sight
        if (distance < nearestVisibleDistance) {
          nearestVisibleDistance = distance;
          nearestVisibleEnemy = e;
        }
      } else {
        // Track nearest blocked enemy as fallback
        if (distance < nearestBlockedDistance) {
          nearestBlockedDistance = distance;
          nearestBlockedEnemy = e;
        }
      }
    });

    // Prefer visible enemies, fall back to blocked enemies if none visible
    const nearestEnemy = nearestVisibleEnemy ?? nearestBlockedEnemy;

    // Debug: Warn if enemies exist but none are targetable
    if (children.length > 0 && !nearestEnemy) {
      console.warn(
        `findNearestEnemy: No target found! Total: ${children.length}, Active: ${activeCount}, Inactive: ${inactiveCount}, No body: ${bodylessCount}`,
      );
      // Log details about each enemy in the group
      children.forEach((enemy, i) => {
        const e = enemy as Enemy;
        console.warn(
          `  Enemy[${i}]: active=${e.active}, body=${!!e.body}, x=${e.x?.toFixed(0)}, y=${e.y?.toFixed(0)}, constructor=${e.constructor.name}`,
        );
      });
    }

    return nearestEnemy;
  }

  /**
   * Calculate spawn position offset from player in firing direction
   */
  private getSpawnPos(bulletAngle: number): { x: number; y: number } {
    return {
      x: this.player.x + Math.cos(bulletAngle) * this.SPAWN_OFFSET,
      y: this.player.y + Math.sin(bulletAngle) * this.SPAWN_OFFSET,
    };
  }

  /**
   * Gather all ability options for bullets
   */
  private getBulletOptions(): Record<string, unknown> {
    return {
      maxPierces: this.player.getPiercingLevel(),
      maxBounces: this.player.getRicochetBounces(),
      fireDamage: this.player.getFireDamage(),
      isCrit: this.player.rollCrit(), // Roll crit for main projectile
      // New V1 ability options
      freezeChance: this.player.getFreezeChance(),
      poisonDamage: this.player.getPoisonDamage(),
      bleedDamage: this.player.getBleedDamage(),
      lightningChainCount: this.player.getLightningChainCount(),
      maxWallBounces: 0, // Wall bounce ability removed
      throughWall: this.player.isThroughWallEnabled(),
      // Weapon projectile options
      projectileSprite: this.weaponProjectileConfig?.sprite,
      projectileSizeMultiplier: this.weaponProjectileConfig?.sizeMultiplier,
      // Homing and explosive options
      homingStrength: this.player.getHomingStrength(),
      explosiveRadius: this.player.getExplosiveArrowRadius(),
      explosiveDamagePercent: this.player.getExplosiveArrowDamagePercent(),
      enemiesGroup: this.enemies,
      // Knockback option
      knockbackForce: this.player.getKnockbackForce(),
    };
  }

  /**
   * Shoot at an enemy, spawning all projectile types based on player abilities
   */
  private shootAtEnemy(enemy: Enemy, time: number): void {
    // Validate enemy position before shooting
    if (!isFinite(enemy.x) || !isFinite(enemy.y)) {
      console.warn(
        "shootAtEnemy: Invalid enemy position",
        enemy.x,
        enemy.y,
        enemy.constructor.name,
      );
      return;
    }

    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);

    // Validate calculated angle
    if (!isFinite(angle)) {
      console.warn(
        "shootAtEnemy: Invalid angle calculated",
        angle,
        "player:",
        this.player.x,
        this.player.y,
        "enemy:",
        enemy.x,
        enemy.y,
      );
      return;
    }

    // Gather ability options for bullets
    const bulletOptions = this.getBulletOptions();

    // Main projectile
    this.spawnMainProjectile(angle, bulletOptions);

    // Extra projectiles (Front Arrow ability)
    this.spawnExtraProjectiles(angle, bulletOptions);

    // Multishot (Side Arrow ability)
    this.spawnMultishotProjectiles(angle, bulletOptions);

    // Diagonal Arrows
    this.spawnDiagonalArrows(angle, bulletOptions);

    // Play shoot sound (once per attack, not per projectile)
    audioManager.playShoot();
    hapticManager.medium(); // Haptic feedback for shooting
    this.player.playShootAnimation(angle); // Visual feedback for shooting
    this.lastShotTime = time;

    // Notify GameScene
    this.eventHandlers.onShotFired();
  }

  /**
   * Spawn the main projectile
   */
  private spawnMainProjectile(angle: number, bulletOptions: Record<string, unknown>): void {
    const mainSpawn = this.getSpawnPos(angle);
    this.bulletPool.spawn(mainSpawn.x, mainSpawn.y, angle, this.BULLET_SPEED, bulletOptions);
  }

  /**
   * Spawn extra forward projectiles with slight spread (Front Arrow ability)
   */
  private spawnExtraProjectiles(angle: number, bulletOptions: Record<string, unknown>): void {
    const extraProjectiles = this.player.getExtraProjectiles();
    if (extraProjectiles <= 0) return;

    const spreadAngle = 0.1; // ~6 degrees spread between extra arrows
    for (let i = 0; i < extraProjectiles; i++) {
      // Alternate left and right
      const offset = (i % 2 === 0 ? 1 : -1) * Math.ceil((i + 1) / 2) * spreadAngle;
      const extraAngle = angle + offset;
      const extraSpawn = this.getSpawnPos(extraAngle);
      // Each extra projectile rolls its own crit
      const extraOptions = { ...bulletOptions, isCrit: this.player.rollCrit() };
      this.bulletPool.spawn(
        extraSpawn.x,
        extraSpawn.y,
        extraAngle,
        this.BULLET_SPEED,
        extraOptions,
      );
    }
  }

  /**
   * Spawn side projectiles at 45 degrees (Multishot ability)
   */
  private spawnMultishotProjectiles(angle: number, bulletOptions: Record<string, unknown>): void {
    const multishotCount = this.player.getMultishotCount();
    if (multishotCount <= 0) return;

    const sideAngle = Math.PI / 4; // 45 degrees
    for (let i = 0; i < multishotCount; i++) {
      // Add projectiles at increasing angles
      const angleOffset = sideAngle * (i + 1);
      const multiAngle1 = angle + angleOffset;
      const multiAngle2 = angle - angleOffset;
      const multiSpawn1 = this.getSpawnPos(multiAngle1);
      const multiSpawn2 = this.getSpawnPos(multiAngle2);
      // Each multishot projectile rolls its own crit
      const multishotOptions1 = { ...bulletOptions, isCrit: this.player.rollCrit() };
      const multishotOptions2 = { ...bulletOptions, isCrit: this.player.rollCrit() };
      this.bulletPool.spawn(
        multiSpawn1.x,
        multiSpawn1.y,
        multiAngle1,
        this.BULLET_SPEED,
        multishotOptions1,
      );
      this.bulletPool.spawn(
        multiSpawn2.x,
        multiSpawn2.y,
        multiAngle2,
        this.BULLET_SPEED,
        multishotOptions2,
      );
    }
  }

  /**
   * Spawn arrows at 30 degree angles (Diagonal Arrows ability - 80% damage)
   */
  private spawnDiagonalArrows(angle: number, bulletOptions: Record<string, unknown>): void {
    const diagonalArrows = this.player.getDiagonalArrows();
    if (diagonalArrows <= 0) return;

    const diagonalAngle = Math.PI / 6; // 30 degrees
    // diagonalArrows is in pairs (2 per level)
    const pairs = Math.floor(diagonalArrows / 2);
    for (let i = 0; i < pairs; i++) {
      const diagAngle1 = angle + diagonalAngle * (i + 1);
      const diagAngle2 = angle - diagonalAngle * (i + 1);
      const diagSpawn1 = this.getSpawnPos(diagAngle1);
      const diagSpawn2 = this.getSpawnPos(diagAngle2);
      // Each diagonal projectile rolls its own crit
      const diagOptions1 = { ...bulletOptions, isCrit: this.player.rollCrit() };
      const diagOptions2 = { ...bulletOptions, isCrit: this.player.rollCrit() };
      this.bulletPool.spawn(
        diagSpawn1.x,
        diagSpawn1.y,
        diagAngle1,
        this.BULLET_SPEED,
        diagOptions1,
      );
      this.bulletPool.spawn(
        diagSpawn2.x,
        diagSpawn2.y,
        diagAngle2,
        this.BULLET_SPEED,
        diagOptions2,
      );
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.cachedNearestEnemy = null;
  }
}

export default ShootingSystem;
