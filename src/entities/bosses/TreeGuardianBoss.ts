import Phaser from "phaser";
import BaseBoss, { BossOptions } from "./BaseBoss";
import EnemyBulletPool from "../../systems/EnemyBulletPool";

type TreeGuardianPhase = "idle" | "vine_whip" | "root_trap" | "leaf_storm";

/**
 * Tree Guardian Boss - Chapter 2 Forest Ruins
 *
 * Attack Patterns:
 * 1. Vine Whip - Extends a line of damage toward the player
 * 2. Root Trap - Creates damage zones that hurt if player stands in them
 * 3. Leaf Storm - Fires many slow projectiles in a spiral pattern
 */
export default class TreeGuardianBoss extends BaseBoss {
  protected phase: TreeGuardianPhase = "idle";

  // Vine whip attack
  private vineWhipTarget: { x: number; y: number } = { x: 0, y: 0 };

  // Root trap attack
  private rootTraps: Phaser.GameObjects.Ellipse[] = [];
  private readonly maxRootTraps = 3;
  private rootTrapDuration = 3000;

  // Leaf storm attack
  private leafStormAngle = 0;
  private leafStormProjectiles = 0;
  private readonly leafStormMaxProjectiles = 24;
  private leafStormInterval = 100;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bulletPool: EnemyBulletPool,
    options?: BossOptions,
  ) {
    super(scene, x, y, bulletPool, "boss_tree_guardian", options);

    this.baseHealth = 250;
    this.bossMaxHealth = Math.round(this.baseHealth * (options?.healthMultiplier ?? 1.0));
    this.bossHealth = this.bossMaxHealth;
    this.attackCooldown = 2200;
    this.attackPatternCount = 3;
    this.displaySize = 72;

    this.setDisplaySize(this.displaySize, this.displaySize);
  }

  protected getPlaceholderColor(): number {
    return 0x228b22; // Forest green
  }

  protected selectAttackPhase(pattern: number, playerX: number, playerY: number): void {
    switch (pattern) {
      case 0:
        this.phase = "vine_whip";
        this.vineWhipTarget = { x: playerX, y: playerY };
        break;
      case 1:
        this.phase = "root_trap";
        break;
      case 2:
        this.phase = "leaf_storm";
        this.leafStormAngle = 0;
        this.leafStormProjectiles = 0;
        break;
    }
  }

  protected handleAttackPhase(time: number, playerX: number, playerY: number): void {
    const elapsed = time - this.phaseStartTime;

    switch (this.phase) {
      case "vine_whip":
        this.handleVineWhipPhase(elapsed, playerX, playerY, time);
        break;
      case "root_trap":
        this.handleRootTrapPhase(elapsed, playerX, playerY, time);
        break;
      case "leaf_storm":
        this.handleLeafStormPhase(elapsed, time);
        break;
      default:
        this.finishAttack(time);
    }
  }

  private handleVineWhipPhase(
    elapsed: number,
    playerX: number,
    playerY: number,
    time: number,
  ): void {
    this.setVelocity(0, 0);
    const windupDuration = 600;
    const attackDuration = 200;

    // Track player during windup
    this.vineWhipTarget = { x: playerX, y: playerY };

    if (elapsed < windupDuration) {
      // Telegraph phase
      const lineLength = 300;
      const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY);
      const alpha = 0.3 + (elapsed / windupDuration) * 0.5;

      this.clearTelegraphs();
      this.drawTelegraphLine(this.x, this.y, angle, lineLength, alpha);
      this.pulseWarning(elapsed, 100);
    } else if (elapsed < windupDuration + attackDuration) {
      // Attack phase - draw thicker vine
      this.clearTint();
      const angle = Phaser.Math.Angle.Between(
        this.x,
        this.y,
        this.vineWhipTarget.x,
        this.vineWhipTarget.y,
      );
      this.clearTelegraphs();
      if (this.telegraphGraphics) {
        this.telegraphGraphics.lineStyle(6, 0x228b22, 1);
        this.telegraphGraphics.beginPath();
        this.telegraphGraphics.moveTo(this.x, this.y);
        this.telegraphGraphics.lineTo(
          this.x + Math.cos(angle) * 300,
          this.y + Math.sin(angle) * 300,
        );
        this.telegraphGraphics.strokePath();
      }
      // Fire projectiles along vine path
      if (elapsed === Math.floor(windupDuration + 50)) {
        this.fireAtPlayer(this.vineWhipTarget.x, this.vineWhipTarget.y, 3, 200, 0.1);
      }
    } else {
      this.clearTelegraphs();
      this.finishAttack(time);
    }
  }

  private handleRootTrapPhase(
    elapsed: number,
    playerX: number,
    playerY: number,
    time: number,
  ): void {
    this.setVelocity(0, 0);
    const windupDuration = 400;

    if (elapsed < windupDuration) {
      this.pulseWarning(elapsed, 100);
    } else if (this.rootTraps.length === 0) {
      this.clearTint();
      this.spawnRootTraps(playerX, playerY);
    } else if (elapsed > windupDuration + this.rootTrapDuration) {
      // Remove traps
      this.rootTraps.forEach((trap) => {
        this.scene.tweens.add({
          targets: trap,
          scaleX: 0,
          scaleY: 0,
          alpha: 0,
          duration: 200,
          onComplete: () => trap.destroy(),
        });
      });
      this.rootTraps = [];
      this.finishAttack(time);
    } else {
      // Pulse traps
      this.rootTraps.forEach((trap) => {
        const pulseScale = 1 + Math.sin(time / 100) * 0.1;
        trap.setScale(pulseScale);
      });
    }
  }

  private spawnRootTraps(playerX: number, playerY: number): void {
    this.rootTraps.forEach((trap) => trap.destroy());
    this.rootTraps = [];

    for (let i = 0; i < this.maxRootTraps; i++) {
      const offsetX = Phaser.Math.Between(-80, 80);
      const offsetY = Phaser.Math.Between(-80, 80);
      const trapX = Phaser.Math.Clamp(playerX + offsetX, 50, 325);
      const trapY = Phaser.Math.Clamp(playerY + offsetY, 50, 617);

      const trap = this.scene.add.ellipse(trapX, trapY, 60, 50, 0x8b4513, 0.6);
      trap.setStrokeStyle(2, 0x228b22, 1);
      this.scene.physics.add.existing(trap, true);

      trap.setScale(0);
      this.scene.tweens.add({
        targets: trap,
        scaleX: 1,
        scaleY: 1,
        duration: 300,
        ease: "Back.easeOut",
      });

      this.rootTraps.push(trap);
    }
  }

  private handleLeafStormPhase(elapsed: number, time: number): void {
    this.setVelocity(0, 0);

    const expectedProjectiles = Math.floor(elapsed / this.leafStormInterval);

    while (
      this.leafStormProjectiles < expectedProjectiles &&
      this.leafStormProjectiles < this.leafStormMaxProjectiles
    ) {
      const speed = 120;
      const angle = this.leafStormAngle;

      this.bulletPool.spawn(this.x, this.y, angle, speed);

      this.leafStormAngle += 0.4;
      this.leafStormProjectiles++;
    }

    this.rotation = this.leafStormAngle * 0.5;

    if (this.leafStormProjectiles >= this.leafStormMaxProjectiles) {
      this.rotation = 0;
      this.finishAttack(time);
    }
  }

  getRootTraps(): Phaser.GameObjects.Ellipse[] {
    return this.rootTraps;
  }

  destroy(fromScene?: boolean): void {
    this.rootTraps.forEach((trap) => trap.destroy());
    this.rootTraps = [];
    super.destroy(fromScene);
  }
}
