import Phaser from "phaser";
import Enemy from "./Enemy";

/**
 * SpiritPet - A homing wisp/fairy that attacks enemies
 * Available through the Spirit Pets ability (separate from Meowgik's Spirit Cats)
 */
export default class SpiritPet extends Phaser.Physics.Arcade.Sprite {
  private speed: number = 250;
  private lifetime: number = 4000; // 4 seconds max
  private spawnTime: number = 0;
  private damage: number = 0;
  private target: Enemy | null = null;
  private homingStrength: number = 0.12; // Slightly less aggressive than Spirit Cat
  private petIndex: number = 0; // Which pet number (0-4)

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "spiritPetSprite");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Set display size (smaller than Spirit Cat)
    this.setDisplaySize(28, 28);

    // Set circular hitbox centered on the sprite
    if (this.body) {
      const displaySize = 28;
      const radius = 8;
      const offset = (displaySize - radius * 2) / 2;
      this.body.setSize(displaySize, displaySize);
      this.body.setCircle(radius, offset, offset);
    }

    this.setActive(false);
    this.setVisible(false);
  }

  fire(x: number, y: number, target: Enemy, damage: number, petIndex: number): void {
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);

    this.target = target;
    this.damage = damage;
    this.petIndex = petIndex;
    this.spawnTime = this.scene.time.now;

    // Initial velocity toward target
    const angle = Phaser.Math.Angle.Between(x, y, target.x, target.y);
    this.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
    this.setRotation(angle);

    // Purple/pink glow for spirit wisps
    this.setTint(0xaa66ff);
    this.setScale(1.0);
  }

  update(time: number): void {
    if (!this.active) return;

    // Deactivate after lifetime expires
    if (time - this.spawnTime > this.lifetime) {
      this.deactivate();
      return;
    }

    // If target is gone, continue in current direction (will deactivate if off-screen)
    if (!this.target || !this.target.active) {
      this.target = null;
    }

    // Homing behavior toward target
    if (this.target && this.body) {
      const currentAngle = Math.atan2(this.body.velocity.y, this.body.velocity.x);
      const targetAngle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);

      // Smooth rotation toward target
      const angleDiff = Phaser.Math.Angle.Wrap(targetAngle - currentAngle);
      const newAngle = currentAngle + angleDiff * this.homingStrength;

      this.setVelocity(Math.cos(newAngle) * this.speed, Math.sin(newAngle) * this.speed);
      this.setRotation(newAngle);
    }

    // Deactivate if off screen
    const margin = 50;
    const gameWidth = this.scene.scale.width;
    const gameHeight = this.scene.scale.height;
    if (
      this.x < -margin ||
      this.x > gameWidth + margin ||
      this.y < -margin ||
      this.y > gameHeight + margin
    ) {
      this.deactivate();
    }

    // Gentle bobbing animation
    const bobAmount = Math.sin(time * 0.01 + this.petIndex) * 2;
    this.y += bobAmount * 0.02;
  }

  getDamage(): number {
    return this.damage;
  }

  getPetIndex(): number {
    return this.petIndex;
  }

  deactivate(): void {
    this.setActive(false);
    this.setVisible(false);
    this.setVelocity(0, 0);
    this.target = null;
    this.clearTint();
    this.setScale(1.0);
  }

  getSpawnTime(): number {
    return this.spawnTime;
  }
}
