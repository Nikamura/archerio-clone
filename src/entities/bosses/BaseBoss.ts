import Phaser from "phaser";
import Enemy, { EnemyUpdateResult } from "../Enemy";
import EnemyBulletPool from "../../systems/EnemyBulletPool";
import { BossDefinition } from "../../config/bossData";

export interface BossOptions {
  healthMultiplier?: number;
  damageMultiplier?: number;
}

export type BossPhase = "idle" | "attacking" | string;

/**
 * Base class for all boss enemies.
 * Provides common functionality like health management, attack cycling,
 * and visual effects. Individual bosses extend this to implement unique attacks.
 */
export default abstract class BaseBoss extends Enemy {
  protected bulletPool: EnemyBulletPool;
  protected phase: BossPhase = "idle";
  protected phaseStartTime: number = 0;
  protected lastAttackTime: number = 0;
  protected attackCooldown: number = 2000; // Base 2 seconds between attacks
  protected attackPattern: number = 0;
  protected attackPatternCount: number = 3; // Override in subclasses

  // Boss-specific health tracking (separate from Enemy health)
  protected bossHealth: number;
  protected bossMaxHealth: number;
  protected baseHealth: number = 200;

  // Display size
  protected displaySize: number = 64;

  // World bounds for clamping
  protected worldBounds: Phaser.Geom.Rectangle | null = null;

  // Telegraph graphics for attacks
  protected telegraphGraphics: Phaser.GameObjects.Graphics | null = null;

  // Minion spawn callback (for bosses that summon minions)
  protected onSpawnMinion?: (x: number, y: number) => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bulletPool: EnemyBulletPool,
    textureKeyOrDefinition: string | BossDefinition,
    options?: BossOptions,
  ) {
    super(scene, x, y, options);

    this.bulletPool = bulletPool;

    // Handle both string texture key and BossDefinition
    let textureKey: string;
    if (typeof textureKeyOrDefinition === "string") {
      textureKey = textureKeyOrDefinition;
    } else {
      // It's a BossDefinition
      const bossDef = textureKeyOrDefinition;
      textureKey = bossDef.visuals.textureKey;
      this.baseHealth = bossDef.stats.baseHealth;
      this.displaySize = bossDef.visuals.displaySize;
      this.attackCooldown = bossDef.stats.attackCooldown;
      this.attackPatternCount = bossDef.attackPatterns.length;
    }

    // Calculate boss health with multipliers
    this.bossMaxHealth = Math.round(this.baseHealth * (options?.healthMultiplier ?? 1.0));
    this.bossHealth = this.bossMaxHealth;

    // Set texture
    if (scene.textures.exists(textureKey)) {
      this.setTexture(textureKey);
    } else {
      // Create a placeholder texture if not found
      this.createPlaceholderTexture(textureKey);
    }
    this.setDisplaySize(this.displaySize, this.displaySize);

    // Set up centered circular hitbox for boss
    // Hitbox is ~40% of display size for fair collision detection
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      const hitboxRadius = Math.floor(this.displaySize * 0.4);
      body.setSize(this.displaySize, this.displaySize);
      const offset = (this.displaySize - hitboxRadius * 2) / 2;
      body.setCircle(hitboxRadius, offset, offset);
    }

    // Cache world bounds
    this.worldBounds = scene.physics.world.bounds;

    // Create telegraph graphics for visual warnings
    this.telegraphGraphics = scene.add.graphics();
    this.telegraphGraphics.setDepth(0);

    console.log(`${this.constructor.name} created at ${x}, ${y} with ${this.bossHealth} HP`);
  }

  /**
   * Create a placeholder colored circle texture for bosses without sprites
   */
  protected createPlaceholderTexture(textureKey: string): void {
    const graphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(this.getPlaceholderColor(), 1);
    graphics.fillCircle(32, 32, 30);
    graphics.lineStyle(3, 0xffffff, 0.8);
    graphics.strokeCircle(32, 32, 30);
    graphics.generateTexture(textureKey, 64, 64);
    graphics.destroy();
    this.setTexture(textureKey);
  }

  /**
   * Override in subclasses to set placeholder color
   */
  protected getPlaceholderColor(): number {
    return 0xff0000; // Default red
  }

  getHealth(): number {
    return this.bossHealth;
  }

  getMaxHealth(): number {
    return this.bossMaxHealth;
  }

  takeDamage(amount: number): boolean {
    this.bossHealth -= amount;

    // Flash effect
    this.setTint(0xff0000);
    this.scene.time.delayedCall(100, () => {
      this.clearTint();
    });

    if (this.bossHealth <= 0) {
      return true; // Boss died
    }
    return false;
  }

  /**
   * Whether this boss needs a minion spawn callback.
   * Override in subclasses that spawn minions to return true.
   */
  needsMinionSpawnCallback(): boolean {
    return false;
  }

  /**
   * Set callback for spawning minions (called by GameScene via factory)
   * Override in subclasses that spawn minions to use this callback
   */
  setMinionSpawnCallback(callback: (x: number, y: number) => void): void {
    this.onSpawnMinion = callback;
  }

  /**
   * Main update loop - handles phase transitions and attack cycling
   */
  update(time: number, delta: number, playerX: number, playerY: number): EnemyUpdateResult {
    if (!this.active || !this.body) {
      return { died: false, dotDamage: 0 };
    }

    // Update status effects (fire, poison, bleed) from parent class
    const effectResult = super.update(time, delta, playerX, playerY);
    if (effectResult.died) {
      return effectResult;
    }

    // Handle current phase
    this.handlePhase(time, playerX, playerY);

    // Keep boss within world bounds
    this.clampToWorldBounds();

    return effectResult;
  }

  /**
   * Handle the current phase of the boss fight
   */
  protected handlePhase(time: number, playerX: number, playerY: number): void {
    if (this.phase === "idle") {
      this.handleIdlePhase(time, playerX, playerY);
    } else {
      this.handleAttackPhase(time, playerX, playerY);
    }
  }

  /**
   * Idle phase - move toward center and wait for next attack
   */
  protected handleIdlePhase(time: number, playerX: number, playerY: number): void {
    if (!this.worldBounds) return;

    // Move toward center of core gameplay area
    const centerX = this.worldBounds.centerX;
    const centerY = this.worldBounds.centerY - 50;

    const distToCenter = Phaser.Math.Distance.Between(this.x, this.y, centerX, centerY);

    if (distToCenter > 50) {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, centerX, centerY);
      this.setVelocity(Math.cos(angle) * 40, Math.sin(angle) * 40);
    } else {
      this.setVelocity(0, 0);
    }

    // Start next attack after cooldown
    if (time - this.lastAttackTime > this.attackCooldown) {
      this.startNextAttack(time, playerX, playerY);
    }
  }

  /**
   * Start the next attack in the pattern cycle
   */
  protected startNextAttack(time: number, playerX: number, playerY: number): void {
    this.phaseStartTime = time;
    this.selectAttackPhase(this.attackPattern, playerX, playerY);
    this.attackPattern = (this.attackPattern + 1) % this.attackPatternCount;
  }

  /**
   * Override to implement attack pattern selection
   */
  protected abstract selectAttackPhase(pattern: number, playerX: number, playerY: number): void;

  /**
   * Override to implement attack phase handling
   */
  protected abstract handleAttackPhase(time: number, playerX: number, playerY: number): void;

  /**
   * Return to idle phase after an attack
   */
  protected finishAttack(time: number): void {
    this.phase = "idle";
    this.lastAttackTime = time;
    this.setVelocity(0, 0);
    this.clearTelegraphs();
  }

  /**
   * Clear any visual telegraph effects
   */
  protected clearTelegraphs(): void {
    if (this.telegraphGraphics) {
      this.telegraphGraphics.clear();
    }
  }

  /**
   * Keep boss within world bounds
   */
  protected clampToWorldBounds(): void {
    if (!this.worldBounds) return;

    const margin = this.displaySize / 2;
    this.x = Phaser.Math.Clamp(
      this.x,
      this.worldBounds.left + margin,
      this.worldBounds.right - margin,
    );
    this.y = Phaser.Math.Clamp(
      this.y,
      this.worldBounds.top + margin,
      this.worldBounds.bottom - margin,
    );
  }

  /**
   * Fire projectiles in a circular spread pattern
   */
  protected fireSpread(numProjectiles: number, speed: number, offset: number = 0): void {
    for (let i = 0; i < numProjectiles; i++) {
      const angle = (Math.PI * 2 * i) / numProjectiles + offset;
      this.bulletPool.spawn(this.x, this.y, angle, speed);
    }
  }

  /**
   * Fire projectiles aimed at the player with optional spread
   */
  protected fireAtPlayer(
    playerX: number,
    playerY: number,
    count: number,
    speed: number,
    spreadAngle: number = 0,
  ): void {
    const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY);

    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : (i - (count - 1) / 2) * spreadAngle;
      this.bulletPool.spawn(this.x, this.y, baseAngle + offset, speed);
    }
  }

  /**
   * Draw a telegraph line showing attack direction
   */
  protected drawTelegraphLine(
    startX: number,
    startY: number,
    angle: number,
    length: number,
    alpha: number = 0.7,
  ): void {
    if (!this.telegraphGraphics) return;

    const endX = startX + Math.cos(angle) * length;
    const endY = startY + Math.sin(angle) * length;

    this.telegraphGraphics.lineStyle(3, 0xff0000, alpha);
    this.telegraphGraphics.beginPath();
    this.telegraphGraphics.moveTo(startX, startY);
    this.telegraphGraphics.lineTo(endX, endY);
    this.telegraphGraphics.strokePath();
  }

  /**
   * Draw a telegraph circle for AOE attacks
   */
  protected drawTelegraphCircle(x: number, y: number, radius: number, alpha: number = 0.5): void {
    if (!this.telegraphGraphics) return;

    this.telegraphGraphics.lineStyle(2, 0xff0000, alpha);
    this.telegraphGraphics.strokeCircle(x, y, radius);
    this.telegraphGraphics.fillStyle(0xff0000, alpha * 0.3);
    this.telegraphGraphics.fillCircle(x, y, radius);
  }

  /**
   * Create pulsing warning effect on the boss
   */
  protected pulseWarning(elapsed: number, interval: number = 100): void {
    if (Math.floor(elapsed / interval) % 2 === 0) {
      this.setTint(0xff0000);
    } else {
      this.clearTint();
    }
  }

  /**
   * Alias for pulseWarning for backwards compatibility
   */
  protected showWarningPulse(elapsed: number, interval: number = 100): void {
    this.pulseWarning(elapsed, interval);
  }

  /**
   * Clear the warning pulse tint
   */
  protected clearWarningPulse(): void {
    this.clearTint();
  }

  /**
   * Create a telegraph line game object
   */
  protected createTelegraphLine(alpha: number = 0.7): Phaser.GameObjects.Line {
    const line = this.scene.add.line(0, 0, 0, 0, 0, 0, 0xff0000, alpha);
    line.setOrigin(0, 0);
    line.setVisible(false);
    line.setDepth(0);
    line.setLineWidth(3);
    return line;
  }

  /**
   * Fire projectiles at a target position with optional spread
   */
  protected fireAtTarget(
    targetX: number,
    targetY: number,
    speed: number,
    spreadAngle: number = 0,
    count: number = 1,
  ): void {
    this.fireAtPlayer(targetX, targetY, count, speed, spreadAngle);
  }

  destroy(fromScene?: boolean): void {
    if (this.telegraphGraphics) {
      this.telegraphGraphics.destroy();
      this.telegraphGraphics = null;
    }
    super.destroy(fromScene);
  }
}
