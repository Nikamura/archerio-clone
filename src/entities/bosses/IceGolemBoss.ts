import Phaser from "phaser";
import BaseBoss, { BossOptions } from "./BaseBoss";
import EnemyBulletPool from "../../systems/EnemyBulletPool";
import { getBossDefinition } from "../../config/bossData";

/**
 * Ice Golem Boss - Chapter 3 Frozen Caves
 *
 * Attack Patterns:
 * 1. Ice Breath - Cone AOE that slows player if hit
 * 2. Ice Spikes - Ground pound creating ice spikes in a pattern
 * 3. Shield Reflect - Brief shield that reflects projectiles
 */
export default class IceGolemBoss extends BaseBoss {
  // Ice breath attack
  private breathCone: Phaser.GameObjects.Graphics | null = null;
  private breathAngle: number = 0;
  private readonly breathConeAngle = Math.PI / 3; // 60 degree cone
  private readonly breathRange = 180;
  private breathDamageApplied: boolean = false;

  // Ice spikes attack
  private iceSpikes: Phaser.GameObjects.Polygon[] = [];
  private readonly maxSpikes = 8;

  // Shield reflect attack
  private shield: Phaser.GameObjects.Arc | null = null;
  private isShieldActive: boolean = false;

  // Player slow callback
  private onSlowPlayer?: (duration: number) => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bulletPool: EnemyBulletPool,
    options?: BossOptions,
  ) {
    super(scene, x, y, bulletPool, getBossDefinition("ice_golem"), options);

    // Ice golem is bulkier and slower
    this.setDisplaySize(80, 80);
  }

  /**
   * Set callback for slowing player (called by GameScene)
   */
  setSlowPlayerCallback(callback: (duration: number) => void): void {
    this.onSlowPlayer = callback;
  }

  /**
   * Check if shield is active (for projectile reflection)
   */
  isShielded(): boolean {
    return this.isShieldActive;
  }

  protected selectAttackPhase(pattern: number, _playerX: number, _playerY: number): void {
    switch (pattern) {
      case 0:
        this.phase = "ice_breath";
        break;
      case 1:
        this.phase = "ice_spikes";
        break;
      case 2:
        this.phase = "shield_reflect";
        break;
    }
  }

  protected handleAttackPhase(time: number, playerX: number, playerY: number): void {
    this.handleCustomPhase(time, playerX, playerY);
  }

  private handleCustomPhase(time: number, playerX: number, playerY: number): void {
    switch (this.phase) {
      // Ice Breath Attack
      case "ice_breath":
        this.handleBreathWindup(time, playerX, playerY);
        break;
      case "ice_breath_active":
        this.handleBreathActive(time, playerX, playerY);
        break;

      // Ice Spikes Attack
      case "ice_spikes":
        this.handleSpikesWindup(time);
        break;
      case "ice_spikes_spawn":
        this.handleSpikesSpawn(time, playerX, playerY);
        break;
      case "ice_spikes_active":
        this.handleSpikesActive(time);
        break;

      // Shield Reflect Attack
      case "shield_reflect":
        this.handleShieldActivate(time);
        break;
      case "shield_active":
        this.handleShieldActive(time);
        break;

      default:
        this.finishAttack(time);
    }
  }

  // ==========================================
  // Ice Breath Attack
  // ==========================================

  private handleBreathWindup(time: number, playerX: number, playerY: number): void {
    this.setVelocity(0, 0);
    const windupDuration = 600;

    // Calculate breath direction toward player
    this.breathAngle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY);

    const elapsed = time - this.phaseStartTime;

    // Inhale effect - scale up slightly
    const scale = 1 + (elapsed / windupDuration) * 0.15;
    this.setScale(scale);

    // Create/update telegraph cone
    if (!this.breathCone) {
      this.breathCone = this.scene.add.graphics();
      this.breathCone.setDepth(0);
    }

    // Draw telegraph cone
    this.breathCone.clear();
    const alpha = 0.2 + (elapsed / windupDuration) * 0.3;
    this.breathCone.fillStyle(0x87ceeb, alpha);
    this.breathCone.beginPath();
    this.breathCone.moveTo(this.x, this.y);
    this.breathCone.arc(
      this.x,
      this.y,
      this.breathRange,
      this.breathAngle - this.breathConeAngle / 2,
      this.breathAngle + this.breathConeAngle / 2,
      false,
    );
    this.breathCone.closePath();
    this.breathCone.fill();

    // Frost particles gathering
    if (elapsed % 80 < 16) {
      this.createFrostParticle(
        this.x + Phaser.Math.Between(-40, 40),
        this.y + Phaser.Math.Between(-40, 40),
        true, // Gather toward boss
      );
    }

    if (elapsed >= windupDuration) {
      this.setScale(1);
      this.phase = "ice_breath_active";
      this.phaseStartTime = time;
      this.breathDamageApplied = false;
    }
  }

  private handleBreathActive(time: number, playerX: number, playerY: number): void {
    const breathDuration = 800;
    const elapsed = time - this.phaseStartTime;
    const progress = elapsed / breathDuration;

    // Draw active breath cone with more opacity
    if (this.breathCone) {
      this.breathCone.clear();
      const alpha = 0.6 - progress * 0.4;
      this.breathCone.fillStyle(0x87ceeb, alpha);
      this.breathCone.lineStyle(2, 0xffffff, 0.5);
      this.breathCone.beginPath();
      this.breathCone.moveTo(this.x, this.y);
      this.breathCone.arc(
        this.x,
        this.y,
        this.breathRange,
        this.breathAngle - this.breathConeAngle / 2,
        this.breathAngle + this.breathConeAngle / 2,
        false,
      );
      this.breathCone.closePath();
      this.breathCone.fill();
      this.breathCone.strokePath();
    }

    // Frost particles spreading outward
    if (elapsed % 40 < 16) {
      const particleAngle = this.breathAngle + Phaser.Math.Between(-30, 30) * (Math.PI / 180);
      const distance = progress * this.breathRange;
      this.createFrostParticle(
        this.x + Math.cos(particleAngle) * distance,
        this.y + Math.sin(particleAngle) * distance,
        false,
      );
    }

    // Check if player is in cone (damage/slow check)
    if (!this.breathDamageApplied) {
      if (this.isInBreathCone(playerX, playerY)) {
        this.breathDamageApplied = true;
        // Slow player for 2 seconds
        if (this.onSlowPlayer) {
          this.onSlowPlayer(2000);
        }
      }
    }

    if (elapsed >= breathDuration) {
      // Clean up
      if (this.breathCone) {
        this.breathCone.clear();
      }
      this.finishAttack(time);
    }
  }

  private isInBreathCone(playerX: number, playerY: number): boolean {
    const distance = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY);
    if (distance > this.breathRange) return false;

    const angleToPlayer = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY);
    let angleDiff = angleToPlayer - this.breathAngle;

    // Normalize angle difference
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    return Math.abs(angleDiff) <= this.breathConeAngle / 2;
  }

  private createFrostParticle(x: number, y: number, gather: boolean): void {
    const particle = this.scene.add.star(x, y, 6, 2, 5, 0x87ceeb, 0.8);
    particle.setDepth(5);
    particle.setScale(0.5);

    if (gather) {
      // Particle gathers toward boss
      this.scene.tweens.add({
        targets: particle,
        x: this.x,
        y: this.y,
        alpha: 0,
        scale: 0,
        duration: 300,
        onComplete: () => particle.destroy(),
      });
    } else {
      // Particle disperses
      this.scene.tweens.add({
        targets: particle,
        alpha: 0,
        scale: 1.5,
        duration: 400,
        onComplete: () => particle.destroy(),
      });
    }
  }

  /**
   * Check if player is in breath cone (for external damage calculation)
   */
  getBreathConeInfo(): {
    active: boolean;
    x: number;
    y: number;
    angle: number;
    range: number;
    coneAngle: number;
  } {
    return {
      active: this.phase === "ice_breath_active",
      x: this.x,
      y: this.y,
      angle: this.breathAngle,
      range: this.breathRange,
      coneAngle: this.breathConeAngle,
    };
  }

  // ==========================================
  // Ice Spikes Attack
  // ==========================================

  private handleSpikesWindup(time: number): void {
    this.setVelocity(0, 0);
    const windupDuration = 500;

    const elapsed = time - this.phaseStartTime;

    // Jump up animation
    const progress = elapsed / windupDuration;
    if (progress < 0.5) {
      this.y -= 2; // Rising
      this.setScale(0.9 + progress * 0.2);
    } else {
      this.setScale(1.1);
    }

    this.showWarningPulse(elapsed);

    if (elapsed >= windupDuration) {
      this.clearWarningPulse();
      this.setScale(1);
      this.phase = "ice_spikes_spawn";
      this.phaseStartTime = time;

      // Screen shake
      this.scene.cameras.main.shake(300, 0.015);
    }
  }

  private handleSpikesSpawn(time: number, playerX: number, playerY: number): void {
    const spawnDuration = 200; // Quick spawn

    // Create spikes around the player and boss
    if (this.iceSpikes.length === 0) {
      // Spawn pattern: circle around player + line toward player
      const positions: { x: number; y: number }[] = [];

      // Circle around player
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6;
        const distance = 60;
        positions.push({
          x: Phaser.Math.Clamp(playerX + Math.cos(angle) * distance, 40, 335),
          y: Phaser.Math.Clamp(playerY + Math.sin(angle) * distance, 40, 627),
        });
      }

      // Line from boss to player
      const lineAngle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY);
      for (let i = 1; i <= 2; i++) {
        const distance = i * 80;
        positions.push({
          x: this.x + Math.cos(lineAngle) * distance,
          y: this.y + Math.sin(lineAngle) * distance,
        });
      }

      // Spawn spikes at positions
      positions.slice(0, this.maxSpikes).forEach((pos, i) => {
        // Delay each spike slightly
        this.scene.time.delayedCall(i * 50, () => {
          this.createIceSpike(pos.x, pos.y);
        });
      });
    }

    const elapsed = time - this.phaseStartTime;
    if (elapsed >= spawnDuration) {
      this.phase = "ice_spikes_active";
      this.phaseStartTime = time;
    }
  }

  private createIceSpike(x: number, y: number): void {
    // Guard against being called after boss/scene destroyed (from delayed callback)
    if (!this.scene || !this.active) return;

    // Triangle shape for spike
    const height = 40;
    const width = 20;
    const points = [
      { x: 0, y: -height / 2 }, // Top point
      { x: -width / 2, y: height / 2 }, // Bottom left
      { x: width / 2, y: height / 2 }, // Bottom right
    ];

    const spike = this.scene.add.polygon(x, y, points, 0x87ceeb, 0.8);
    spike.setStrokeStyle(2, 0xffffff, 0.9);
    spike.setDepth(1);

    // Emerge from ground animation
    spike.setScale(0, 0);
    this.scene.tweens.add({
      targets: spike,
      scaleX: 1,
      scaleY: 1,
      duration: 150,
      ease: "Back.easeOut",
    });

    // Add physics body for collision
    this.scene.physics.add.existing(spike, true);

    this.iceSpikes.push(spike);
  }

  private handleSpikesActive(time: number): void {
    const activeDuration = 2000; // Spikes last 2 seconds
    const elapsed = time - this.phaseStartTime;

    // Slight shimmer effect
    this.iceSpikes.forEach((spike, i) => {
      const shimmer = 0.7 + Math.sin(time / 100 + i) * 0.2;
      spike.setAlpha(shimmer);
    });

    if (elapsed >= activeDuration) {
      // Retract spikes
      this.iceSpikes.forEach((spike, i) => {
        this.scene.time.delayedCall(i * 30, () => {
          this.scene.tweens.add({
            targets: spike,
            scaleY: 0,
            alpha: 0,
            duration: 150,
            onComplete: () => spike.destroy(),
          });
        });
      });
      this.iceSpikes = [];
      this.finishAttack(time);
    }
  }

  /**
   * Get ice spikes for external collision detection
   */
  getIceSpikes(): Phaser.GameObjects.Polygon[] {
    return this.iceSpikes;
  }

  // ==========================================
  // Shield Reflect Attack
  // ==========================================

  private handleShieldActivate(time: number): void {
    this.setVelocity(0, 0);
    const activateDuration = 300;

    const elapsed = time - this.phaseStartTime;

    // Create shield
    if (!this.shield) {
      this.shield = this.scene.add.arc(this.x, this.y, 50, 0, 360, false, 0x87ceeb, 0.3);
      this.shield.setStrokeStyle(4, 0xffffff, 0.8);
      this.shield.setDepth(6);
      this.shield.setScale(0);

      this.scene.tweens.add({
        targets: this.shield,
        scale: 1,
        duration: activateDuration,
        ease: "Back.easeOut",
      });
    }

    if (elapsed >= activateDuration) {
      this.isShieldActive = true;
      this.phase = "shield_active";
      this.phaseStartTime = time;
    }
  }

  private handleShieldActive(time: number): void {
    const shieldDuration = 2000; // Shield lasts 2 seconds
    const elapsed = time - this.phaseStartTime;

    // Update shield position
    if (this.shield) {
      this.shield.setPosition(this.x, this.y);

      // Pulsing effect
      const pulse = 1 + Math.sin(time / 80) * 0.1;
      this.shield.setScale(pulse);

      // Rotating sparkles
      if (elapsed % 100 < 16) {
        const sparkleAngle = (time / 200) % (Math.PI * 2);
        const sparkleX = this.x + Math.cos(sparkleAngle) * 50;
        const sparkleY = this.y + Math.sin(sparkleAngle) * 50;

        const sparkle = this.scene.add.star(sparkleX, sparkleY, 4, 2, 5, 0xffffff, 1);
        sparkle.setDepth(7);
        this.scene.tweens.add({
          targets: sparkle,
          alpha: 0,
          scale: 0,
          duration: 200,
          onComplete: () => sparkle.destroy(),
        });
      }
    }

    if (elapsed >= shieldDuration) {
      // Deactivate shield
      this.isShieldActive = false;
      if (this.shield) {
        this.scene.tweens.add({
          targets: this.shield,
          scale: 0,
          alpha: 0,
          duration: 200,
          onComplete: () => {
            this.shield?.destroy();
            this.shield = null;
          },
        });
      }
      this.finishAttack(time);
    }
  }

  /**
   * Called when a projectile is reflected by the shield
   */
  onProjectileReflected(projectileX: number, projectileY: number): void {
    // Visual feedback
    const flash = this.scene.add.circle(projectileX, projectileY, 15, 0xffffff, 0.8);
    flash.setDepth(8);
    this.scene.tweens.add({
      targets: flash,
      scale: 2,
      alpha: 0,
      duration: 150,
      onComplete: () => flash.destroy(),
    });
  }

  destroy(fromScene?: boolean): void {
    if (this.breathCone) {
      this.breathCone.destroy();
      this.breathCone = null;
    }
    this.iceSpikes.forEach((spike) => spike.destroy());
    this.iceSpikes = [];
    if (this.shield) {
      this.shield.destroy();
      this.shield = null;
    }
    super.destroy(fromScene);
  }
}
