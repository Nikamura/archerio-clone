import Phaser from "phaser";

/**
 * OrbitalShield - A shield that orbits around the player and blocks enemy projectiles
 */
export default class OrbitalShield extends Phaser.Physics.Arcade.Sprite {
  private orbitIndex: number = 0; // Which position in the orbit (0-2)
  private orbitRadius: number = 55;
  private orbitSpeed: number = 3; // Radians per second (faster than orbs)
  private blocksRemaining: number = 3; // Number of hits before breaking
  private maxBlocks: number = 3;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "orbitalShieldSprite");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Set display size (hexagonal shape, larger than orbs)
    this.setDisplaySize(28, 28);

    // Set circular hitbox
    if (this.body) {
      const displaySize = 28;
      const radius = 12;
      const offset = (displaySize - radius * 2) / 2;
      this.body.setSize(displaySize, displaySize);
      this.body.setCircle(radius, offset, offset);
    }

    // Blue/cyan tint
    this.setTint(0x00aaff);

    this.setActive(false);
    this.setVisible(false);
  }

  /**
   * Activate the shield
   */
  activate(orbitIndex: number): void {
    this.orbitIndex = orbitIndex;
    this.blocksRemaining = this.maxBlocks;
    this.setActive(true);
    this.setVisible(true);
    this.setAlpha(1);
  }

  /**
   * Update shield position based on player position and orbit angle
   */
  updateOrbitPosition(
    playerX: number,
    playerY: number,
    time: number,
    totalShields: number,
  ): void {
    if (!this.active) return;

    // Calculate orbit angle based on time and shield index
    // Shields orbit opposite direction to orbs for visual interest
    const baseAngle = -(time / 1000) * this.orbitSpeed;
    const angleOffset = (this.orbitIndex / totalShields) * Math.PI * 2;
    const angle = baseAngle + angleOffset;

    // Position shield around player
    this.x = playerX + Math.cos(angle) * this.orbitRadius;
    this.y = playerY + Math.sin(angle) * this.orbitRadius;

    // Rotate shield to face outward
    this.setRotation(angle + Math.PI / 2);
  }

  /**
   * Block a projectile - reduces durability
   * @returns true if shield broke after blocking
   */
  blockProjectile(): boolean {
    this.blocksRemaining--;

    // Flash effect on block
    this.setTint(0xffffff);
    this.scene.time.delayedCall(100, () => {
      if (this.active) {
        this.setTint(0x00aaff);
      }
    });

    // Update visual based on remaining blocks
    this.setAlpha(0.4 + (this.blocksRemaining / this.maxBlocks) * 0.6);

    if (this.blocksRemaining <= 0) {
      this.deactivate();
      return true;
    }
    return false;
  }

  /**
   * Get the orbit index
   */
  getOrbitIndex(): number {
    return this.orbitIndex;
  }

  /**
   * Get remaining blocks
   */
  getBlocksRemaining(): number {
    return this.blocksRemaining;
  }

  /**
   * Deactivate the shield
   */
  deactivate(): void {
    this.setActive(false);
    this.setVisible(false);
  }
}
