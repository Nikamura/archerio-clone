import Phaser from "phaser";

export default class Bullet extends Phaser.Physics.Arcade.Sprite {
  private speed: number = 400;
  private lifetime: number = 10000; // 10 seconds - generous fallback, bullets should hit or go off-screen first
  private spawnTime: number = 0;

  // Ability tracking
  private hitCount: number = 0; // How many enemies this bullet has hit (for piercing)
  private bounceCount: number = 0; // How many times this bullet has ricocheted
  private maxPierces: number = 0; // Maximum number of enemies it can pierce through
  private maxBounces: number = 0; // Maximum number of ricochet bounces
  private fireDamage: number = 0; // Fire DOT damage to apply on hit
  private isCrit: boolean = false; // Whether this bullet is a critical hit

  // New V1 ability tracking
  private freezeChance: number = 0; // Chance to freeze enemies
  private poisonDamage: number = 0; // Poison DOT damage to apply on hit
  private lightningChainCount: number = 0; // Number of enemies lightning can chain to
  private maxWallBounces: number = 0; // Maximum number of wall bounces
  private wallBounceCount: number = 0; // Current wall bounce count
  private throughWallEnabled: boolean = false; // Arrows pass through walls
  private bleedDamage: number = 0; // Bleed DOT damage (deals more to moving enemies)

  // Homing and explosive properties
  private homingStrength: number = 0; // How strongly bullet tracks enemies (0-1)
  private explosiveRadius: number = 0; // Explosion radius on impact
  private explosiveDamagePercent: number = 0; // Explosion damage as percent of bullet damage

  // Reference to enemies group for homing behavior
  private enemiesGroup: Phaser.Physics.Arcade.Group | null = null;

  // Knockback on hit
  private knockbackForce: number = 0;
  private knockbackDuration: number = 0;

  // Track which enemies this bullet has already hit (for piercing)
  private hitEnemies: Set<Phaser.GameObjects.GameObject> = new Set();

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "bulletSprite");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Set display size for the arrow sprite - increase for better visibility
    this.setDisplaySize(24, 24);

    // Set circular hitbox centered on the sprite
    // Must sync body size with display size, then center the circle
    if (this.body) {
      const displaySize = 24;
      const radius = 6; // Slightly larger hitbox for better hit detection
      const offset = (displaySize - radius * 2) / 2;
      this.body.setSize(displaySize, displaySize);
      this.body.setCircle(radius, offset, offset);
    }

    this.setActive(false);
    this.setVisible(false);
  }

  fire(
    x: number,
    y: number,
    angle: number,
    speed: number = 400,
    options?: {
      maxPierces?: number;
      maxBounces?: number;
      fireDamage?: number;
      isCrit?: boolean;
      freezeChance?: number;
      poisonDamage?: number;
      lightningChainCount?: number;
      maxWallBounces?: number;
      throughWall?: boolean;
      bleedDamage?: number;
      projectileSprite?: string;
      projectileSizeMultiplier?: number;
      homingStrength?: number;
      explosiveRadius?: number;
      explosiveDamagePercent?: number;
      enemiesGroup?: Phaser.Physics.Arcade.Group;
      knockbackForce?: number;
      knockbackDuration?: number;
    },
  ) {
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);

    this.speed = speed;
    this.spawnTime = this.scene.time.now;

    // Reset ability tracking
    this.hitCount = 0;
    this.bounceCount = 0;
    this.hitEnemies.clear();
    this.maxPierces = options?.maxPierces ?? 0;
    this.maxBounces = options?.maxBounces ?? 0;
    this.fireDamage = options?.fireDamage ?? 0;
    this.isCrit = options?.isCrit ?? false;

    // Reset new V1 ability tracking
    this.freezeChance = options?.freezeChance ?? 0;
    this.poisonDamage = options?.poisonDamage ?? 0;
    this.lightningChainCount = options?.lightningChainCount ?? 0;
    this.maxWallBounces = options?.maxWallBounces ?? 0;
    this.wallBounceCount = 0;
    this.throughWallEnabled = options?.throughWall ?? false;
    this.bleedDamage = options?.bleedDamage ?? 0;

    // Reset homing and explosive properties
    this.homingStrength = options?.homingStrength ?? 0;
    this.explosiveRadius = options?.explosiveRadius ?? 0;
    this.explosiveDamagePercent = options?.explosiveDamagePercent ?? 0;
    this.enemiesGroup = options?.enemiesGroup ?? null;
    this.knockbackForce = options?.knockbackForce ?? 0;
    this.knockbackDuration = options?.knockbackDuration ?? 150;

    // Change texture based on equipped weapon
    if (options?.projectileSprite) {
      this.setTexture(options.projectileSprite);
    }

    // Set velocity based on angle
    const vx = Math.cos(angle) * this.speed;
    const vy = Math.sin(angle) * this.speed;
    this.setVelocity(vx, vy);

    // Rotate bullet to face direction
    this.setRotation(angle);

    // Base size multiplier from weapon
    const sizeMultiplier = options?.projectileSizeMultiplier ?? 1.0;

    // Visual indicator for critical hit (slightly larger and different color)
    if (this.isCrit) {
      this.setTint(0xffff00); // Yellow tint for crits
      this.setScale(1.3 * sizeMultiplier);
    } else if (this.freezeChance > 0) {
      this.setTint(0x66ccff); // Blue tint for ice
      this.setScale(sizeMultiplier);
    } else if (this.poisonDamage > 0) {
      this.setTint(0x66ff66); // Green tint for poison
      this.setScale(sizeMultiplier);
    } else if (this.lightningChainCount > 0) {
      this.setTint(0x9966ff); // Purple tint for lightning
      this.setScale(sizeMultiplier);
    } else if (this.bleedDamage > 0) {
      this.setTint(0xcc0000); // Dark red tint for bleed
      this.setScale(sizeMultiplier);
    } else {
      this.clearTint();
      this.setScale(sizeMultiplier);
    }
  }

  preUpdate(time: number, _delta: number) {
    super.preUpdate(time, _delta);
    if (!this.active) return;

    // Deactivate bullet after lifetime expires
    if (time - this.spawnTime > this.lifetime) {
      this.deactivate();
      return;
    }

    const gameWidth = this.scene.scale.width;
    const gameHeight = this.scene.scale.height;

    // Homing behavior - gently track nearest enemy
    if (this.homingStrength > 0 && this.enemiesGroup && this.body) {
      this.applyHomingBehavior();
    }

    // Through Wall: Bullets pass through walls but still deactivate off-screen
    // Wall collision is handled in CombatSystem.bulletHitWall (returns early if throughWallEnabled)

    // Handle wall bouncing (only if ability is active)
    if (this.maxWallBounces > 0 && this.wallBounceCount < this.maxWallBounces) {
      let bounced = false;
      const body = this.body as Phaser.Physics.Arcade.Body;

      // Check left/right walls
      if (this.x <= 0 || this.x >= gameWidth) {
        body.velocity.x *= -1;
        // Clamp position inside bounds
        this.x = Phaser.Math.Clamp(this.x, 1, gameWidth - 1);
        bounced = true;
      }

      // Check top/bottom walls
      if (this.y <= 0 || this.y >= gameHeight) {
        body.velocity.y *= -1;
        // Clamp position inside bounds
        this.y = Phaser.Math.Clamp(this.y, 1, gameHeight - 1);
        bounced = true;
      }

      if (bounced) {
        this.wallBounceCount++;
        // Update rotation to match new direction
        this.setRotation(Math.atan2(body.velocity.y, body.velocity.x));
      }
    } else {
      // Deactivate bullet if it goes off screen (with margin) - only if no wall bounces or all used
      const margin = 50;
      if (
        this.x < -margin ||
        this.x > gameWidth + margin ||
        this.y < -margin ||
        this.y > gameHeight + margin
      ) {
        this.deactivate();
      }
    }
  }

  deactivate() {
    this.setActive(false);
    this.setVisible(false);
    this.setVelocity(0, 0);
  }

  /**
   * Check if this bullet has already hit the given enemy (for piercing)
   * Prevents multiple collision callbacks from the same overlap
   */
  hasHitEnemy(enemy: Phaser.GameObjects.GameObject): boolean {
    return this.hitEnemies.has(enemy);
  }

  /**
   * Mark an enemy as hit to prevent duplicate damage in the same frame
   */
  markEnemyAsHit(enemy: Phaser.GameObjects.GameObject): void {
    this.hitEnemies.add(enemy);
  }

  /**
   * Called when bullet hits an enemy
   * @param enemy The enemy that was hit (for tracking pierced enemies)
   * @returns true if bullet should be deactivated (no piercing/ricochet)
   */
  onHit(enemy?: Phaser.GameObjects.GameObject): boolean {
    // Track this enemy as hit to prevent duplicate collisions
    if (enemy) {
      this.hitEnemies.add(enemy);
    }

    this.hitCount++;

    // Check if bullet can pierce through
    if (this.maxPierces > 0 && this.hitCount <= this.maxPierces) {
      return false; // Don't deactivate, keep going
    }

    // Check if bullet can ricochet
    if (this.maxBounces > 0 && this.bounceCount < this.maxBounces) {
      return false; // Don't deactivate yet, will ricochet
    }

    return true; // Deactivate bullet
  }

  /**
   * Redirect bullet to a new target (for ricochet)
   */
  redirectTo(targetX: number, targetY: number) {
    this.bounceCount++;

    // Calculate new angle to target
    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);

    // Set new velocity
    const vx = Math.cos(angle) * this.speed;
    const vy = Math.sin(angle) * this.speed;
    this.setVelocity(vx, vy);

    // Rotate to face new direction
    this.setRotation(angle);
  }

  // Getters for ability tracking
  getHitCount(): number {
    return this.hitCount;
  }

  getBounceCount(): number {
    return this.bounceCount;
  }

  getMaxPierces(): number {
    return this.maxPierces;
  }

  getMaxBounces(): number {
    return this.maxBounces;
  }

  getFireDamage(): number {
    return this.fireDamage;
  }

  isCriticalHit(): boolean {
    return this.isCrit;
  }

  // New V1 ability getters
  getFreezeChance(): number {
    return this.freezeChance;
  }

  /**
   * Roll for freeze based on bullet's freeze chance
   */
  rollFreeze(): boolean {
    return Math.random() < this.freezeChance;
  }

  getPoisonDamage(): number {
    return this.poisonDamage;
  }

  getLightningChainCount(): number {
    return this.lightningChainCount;
  }

  getMaxWallBounces(): number {
    return this.maxWallBounces;
  }

  getWallBounceCount(): number {
    return this.wallBounceCount;
  }

  isThroughWallEnabled(): boolean {
    return this.throughWallEnabled;
  }

  getBleedDamage(): number {
    return this.bleedDamage;
  }

  getSpawnTime(): number {
    return this.spawnTime;
  }

  // Homing and explosive getters
  getHomingStrength(): number {
    return this.homingStrength;
  }

  getExplosiveRadius(): number {
    return this.explosiveRadius;
  }

  getExplosiveDamagePercent(): number {
    return this.explosiveDamagePercent;
  }

  getKnockbackForce(): number {
    return this.knockbackForce;
  }

  getKnockbackDuration(): number {
    return this.knockbackDuration;
  }

  /**
   * Apply homing behavior - gently curve towards nearest enemy
   */
  private applyHomingBehavior(): void {
    if (!this.enemiesGroup || !this.body) return;

    // Find nearest enemy
    let nearestEnemy: Phaser.GameObjects.GameObject | null = null;
    let nearestDistance = Infinity;

    this.enemiesGroup.getChildren().forEach((enemy) => {
      if (!enemy.active) return;
      const e = enemy as Phaser.Physics.Arcade.Sprite;
      const dist = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestEnemy = enemy;
      }
    });

    if (!nearestEnemy) return;

    const target = nearestEnemy as Phaser.Physics.Arcade.Sprite;
    const body = this.body as Phaser.Physics.Arcade.Body;

    // Calculate current direction and target direction
    const currentAngle = Math.atan2(body.velocity.y, body.velocity.x);
    const targetAngle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);

    // Scale homing strength by game speed multiplier
    // At higher speeds, bullets travel further per frame, so we need stronger corrections
    const timeScale = this.scene.physics.world.timeScale;
    const gameSpeedMultiplier = timeScale > 0 ? 1 / timeScale : 1;
    const scaledHomingStrength = Math.min(1, this.homingStrength * gameSpeedMultiplier);

    // Smoothly interpolate towards target angle
    const angleDiff = Phaser.Math.Angle.Wrap(targetAngle - currentAngle);
    const newAngle = currentAngle + angleDiff * scaledHomingStrength;

    // Update velocity while maintaining speed
    body.velocity.x = Math.cos(newAngle) * this.speed;
    body.velocity.y = Math.sin(newAngle) * this.speed;

    // Update rotation to face direction
    this.setRotation(newAngle);
  }
}
