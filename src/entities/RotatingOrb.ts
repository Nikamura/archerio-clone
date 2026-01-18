import Phaser from "phaser";
import Enemy from "./Enemy";

/**
 * RotatingOrb - An orb that orbits around the player and damages enemies on contact
 */
export default class RotatingOrb extends Phaser.Physics.Arcade.Sprite {
  private damage: number = 0;
  private orbitIndex: number = 0; // Which position in the orbit (0-4)
  private orbitRadius: number = 60;
  private orbitSpeed: number = 2; // Radians per second
  private hitCooldowns: Map<Enemy, number> = new Map(); // Track cooldown per enemy
  private static readonly HIT_COOLDOWN = 500; // 500ms cooldown per enemy

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "rotatingOrbSprite");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Set display size
    this.setDisplaySize(24, 24);

    // Set circular hitbox
    if (this.body) {
      const displaySize = 24;
      const radius = 10;
      const offset = (displaySize - radius * 2) / 2;
      this.body.setSize(displaySize, displaySize);
      this.body.setCircle(radius, offset, offset);
    }

    // Orange/fiery tint
    this.setTint(0xff8800);

    this.setActive(false);
    this.setVisible(false);
  }

  /**
   * Activate the orb
   */
  activate(orbitIndex: number, damage: number): void {
    this.orbitIndex = orbitIndex;
    this.damage = damage;
    this.hitCooldowns.clear();
    this.setActive(true);
    this.setVisible(true);
  }

  /**
   * Update orb position based on player position and orbit angle
   */
  updateOrbitPosition(
    playerX: number,
    playerY: number,
    time: number,
    totalOrbs: number,
  ): void {
    if (!this.active) return;

    // Calculate orbit angle based on time and orb index
    const baseAngle = (time / 1000) * this.orbitSpeed;
    const angleOffset = (this.orbitIndex / totalOrbs) * Math.PI * 2;
    const angle = baseAngle + angleOffset;

    // Position orb around player
    this.x = playerX + Math.cos(angle) * this.orbitRadius;
    this.y = playerY + Math.sin(angle) * this.orbitRadius;

    // Clean up old cooldowns
    const now = time;
    for (const [enemy, cooldownTime] of this.hitCooldowns.entries()) {
      if (now > cooldownTime || !enemy.active) {
        this.hitCooldowns.delete(enemy);
      }
    }
  }

  /**
   * Check if this orb can hit the given enemy (not on cooldown)
   */
  canHitEnemy(enemy: Enemy, time: number): boolean {
    const cooldownTime = this.hitCooldowns.get(enemy);
    if (cooldownTime && time < cooldownTime) {
      return false;
    }
    return true;
  }

  /**
   * Mark that this orb hit an enemy (start cooldown)
   */
  markHit(enemy: Enemy, time: number): void {
    this.hitCooldowns.set(enemy, time + RotatingOrb.HIT_COOLDOWN);
  }

  /**
   * Get the damage this orb deals
   */
  getDamage(): number {
    return this.damage;
  }

  /**
   * Get the orbit index
   */
  getOrbitIndex(): number {
    return this.orbitIndex;
  }

  /**
   * Deactivate the orb
   */
  deactivate(): void {
    this.setActive(false);
    this.setVisible(false);
    this.hitCooldowns.clear();
  }
}
