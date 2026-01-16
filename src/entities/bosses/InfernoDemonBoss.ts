import Phaser from "phaser";
import BaseBoss, { BossOptions } from "./BaseBoss";
import EnemyBulletPool from "../../systems/EnemyBulletPool";
import { EnemyUpdateResult } from "../Enemy";

type InfernoDemonPhase = "idle" | "flame_pillars" | "teleport_dash" | "enraged_combo";

interface FlamePillar {
  x: number;
  y: number;
  graphics: Phaser.GameObjects.Graphics;
  createdAt: number;
  active: boolean;
}

/**
 * Chapter 4 Boss 3: Inferno Demon
 * A demon lord that commands hellfire.
 *
 * Attack Patterns:
 * 1. Flame Pillar Summons - Creates pillars of fire that erupt
 * 2. Teleport Dash Attack - Teleports behind player and attacks
 * 3. Enrage Mode - At low HP, attacks become faster and more aggressive
 */
export default class InfernoDemonBoss extends BaseBoss {
  protected phase: InfernoDemonPhase = "idle";

  // Flame pillar tracking
  private flamePillars: FlamePillar[] = [];
  private pillarSpawnCount: number = 0;
  private maxPillars: number = 5;
  private pillarDuration: number = 3000;

  // Teleport dash tracking
  private teleportTargetX: number = 0;
  private teleportTargetY: number = 0;
  private hasTeleported: boolean = false;
  private hasDashed: boolean = false;

  // Enrage state
  private isEnraged: boolean = false;
  private enrageThreshold: number = 0.3; // Enrage at 30% HP
  private originalAttackCooldown: number = 0;
  private comboCount: number = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bulletPool: EnemyBulletPool,
    options?: BossOptions,
  ) {
    super(scene, x, y, bulletPool, "boss_inferno_demon", options);

    this.baseHealth = 350;
    this.bossMaxHealth = Math.round(this.baseHealth * (options?.healthMultiplier ?? 1.0));
    this.bossHealth = this.bossMaxHealth;
    this.attackCooldown = 2000;
    this.originalAttackCooldown = this.attackCooldown;
    this.attackPatternCount = 3;
    this.displaySize = 80;

    this.setDisplaySize(this.displaySize, this.displaySize);
  }

  protected getPlaceholderColor(): number {
    return 0x8b0000; // Dark red for demon
  }

  protected selectAttackPhase(pattern: number, playerX: number, playerY: number): void {
    // Check for enrage
    if (!this.isEnraged && this.bossHealth / this.bossMaxHealth <= this.enrageThreshold) {
      this.triggerEnrage();
    }

    // During enrage, use combo attack
    if (this.isEnraged && pattern === 2) {
      this.phase = "enraged_combo";
      this.comboCount = 0;
      return;
    }

    switch (pattern) {
      case 0:
        this.phase = "flame_pillars";
        this.pillarSpawnCount = 0;
        break;
      case 1:
        this.phase = "teleport_dash";
        this.calculateTeleportTarget(playerX, playerY);
        this.hasTeleported = false;
        this.hasDashed = false;
        break;
      case 2:
        // Regular attack - rapid fire
        this.phase = "flame_pillars";
        this.pillarSpawnCount = 0;
        break;
    }
  }

  private triggerEnrage(): void {
    this.isEnraged = true;
    this.attackCooldown = this.originalAttackCooldown * 0.6; // 40% faster attacks

    // Visual enrage effect
    this.setTint(0xff3300);

    // Burst of projectiles on enrage
    this.fireSpread(16, 200);

    console.log("Inferno Demon ENRAGED!");
  }

  private calculateTeleportTarget(playerX: number, playerY: number): void {
    // Teleport behind player
    const angleToPlayer = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY);
    const behindPlayerAngle = angleToPlayer + Math.PI;
    const distance = 80;

    this.teleportTargetX = Phaser.Math.Clamp(
      playerX + Math.cos(behindPlayerAngle) * distance,
      50,
      325,
    );
    this.teleportTargetY = Phaser.Math.Clamp(
      playerY + Math.sin(behindPlayerAngle) * distance,
      100,
      550,
    );
  }

  protected handleAttackPhase(time: number, playerX: number, playerY: number): void {
    const elapsed = time - this.phaseStartTime;

    switch (this.phase) {
      case "flame_pillars":
        this.handleFlamePillarsPhase(time, elapsed, playerX, playerY);
        break;
      case "teleport_dash":
        this.handleTeleportDashPhase(time, elapsed, playerX, playerY);
        break;
      case "enraged_combo":
        this.handleEnragedComboPhase(time, elapsed, playerX, playerY);
        break;
    }

    // Always update enrage visual
    if (this.isEnraged && this.phase === "idle") {
      this.setTint(0xff3300);
    }
  }

  private handleFlamePillarsPhase(
    time: number,
    elapsed: number,
    playerX: number,
    playerY: number,
  ): void {
    this.setVelocity(0, 0);

    // Spawn pillars sequentially
    const spawnInterval = 300;
    const expectedSpawns = Math.min(Math.floor(elapsed / spawnInterval), this.maxPillars);

    while (this.pillarSpawnCount < expectedSpawns) {
      this.spawnFlamePillar(playerX, playerY, this.pillarSpawnCount, time);
      this.pillarSpawnCount++;
    }

    // Telegraph where pillars will erupt
    for (const pillar of this.flamePillars) {
      if (pillar.active) {
        const age = time - pillar.createdAt;

        // Warning phase (first 500ms)
        if (age < 500) {
          const warningAlpha = 0.3 + (age / 500) * 0.5;
          pillar.graphics.clear();
          pillar.graphics.fillStyle(0xff4400, warningAlpha * 0.3);
          pillar.graphics.fillCircle(pillar.x, pillar.y, 30);
          pillar.graphics.lineStyle(2, 0xff6600, warningAlpha);
          pillar.graphics.strokeCircle(pillar.x, pillar.y, 30);
        }
        // Eruption phase
        else if (age < 800) {
          pillar.graphics.clear();
          pillar.graphics.fillStyle(0xff2200, 0.7);
          pillar.graphics.fillCircle(pillar.x, pillar.y, 35);
          pillar.graphics.lineStyle(4, 0xffaa00, 0.9);
          pillar.graphics.strokeCircle(pillar.x, pillar.y, 35);

          // Fire projectiles on eruption
          if (age < 550) {
            const angle = Math.random() * Math.PI * 2;
            this.bulletPool.spawn(pillar.x, pillar.y, angle, 150);
          }
        }
        // Fade out
        else if (age < 1200) {
          const fadeAlpha = 1 - (age - 800) / 400;
          pillar.graphics.clear();
          pillar.graphics.fillStyle(0xff4400, fadeAlpha * 0.4);
          pillar.graphics.fillCircle(pillar.x, pillar.y, 30 * fadeAlpha);
        } else {
          pillar.active = false;
          pillar.graphics.clear();
        }
      }
    }

    // Finish after all pillars done
    if (elapsed > this.maxPillars * spawnInterval + 1500) {
      this.cleanupPillars();
      this.finishAttack(time);
    }
  }

  private spawnFlamePillar(playerX: number, playerY: number, index: number, time: number): void {
    // Spawn pillars in a pattern around player
    const angle = (Math.PI * 2 * index) / this.maxPillars + Math.random() * 0.5;
    const distance = 60 + Math.random() * 40;

    const pillarX = Phaser.Math.Clamp(playerX + Math.cos(angle) * distance, 50, 325);
    const pillarY = Phaser.Math.Clamp(playerY + Math.sin(angle) * distance, 100, 550);

    const pillar: FlamePillar = {
      x: pillarX,
      y: pillarY,
      graphics: this.scene.add.graphics(),
      createdAt: time,
      active: true,
    };
    pillar.graphics.setDepth(0);

    this.flamePillars.push(pillar);
  }

  private handleTeleportDashPhase(
    time: number,
    elapsed: number,
    playerX: number,
    playerY: number,
  ): void {
    // Fade out phase
    if (elapsed < 300 && !this.hasTeleported) {
      const fadeProgress = elapsed / 300;
      this.setAlpha(1 - fadeProgress);
      this.pulseWarning(elapsed, 60);
      return;
    }

    // Teleport
    if (!this.hasTeleported && elapsed >= 300) {
      this.hasTeleported = true;
      this.x = this.teleportTargetX;
      this.y = this.teleportTargetY;
      this.setAlpha(0);

      // Show telegraph for dash
      this.clearTelegraphs();
    }

    // Appear phase
    if (elapsed < 600 && this.hasTeleported) {
      const appearProgress = (elapsed - 300) / 300;
      this.setAlpha(appearProgress);
      return;
    }

    // Dash at player
    if (elapsed >= 600 && !this.hasDashed) {
      this.hasDashed = true;
      this.setAlpha(1);
      this.clearTint();

      // Quick dash toward player
      const dashAngle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY);
      this.setVelocity(Math.cos(dashAngle) * 500, Math.sin(dashAngle) * 500);

      // Fire projectiles during dash
      this.fireAtPlayer(playerX, playerY, 5, 250, 0.2);
    }

    // Stop dash
    if (elapsed > 900) {
      this.setVelocity(0, 0);
    }

    if (elapsed > 1100) {
      this.finishAttack(time);
    }
  }

  private handleEnragedComboPhase(
    time: number,
    elapsed: number,
    playerX: number,
    playerY: number,
  ): void {
    // Rapid combo of attacks during enrage
    const comboInterval = 500;

    if (this.comboCount < 4) {
      if (
        elapsed >= this.comboCount * comboInterval &&
        elapsed < (this.comboCount + 1) * comboInterval
      ) {
        // Execute combo attack
        if (elapsed - this.comboCount * comboInterval < 50) {
          switch (this.comboCount % 3) {
            case 0:
              // Spread shot
              this.fireSpread(8, 220);
              break;
            case 1:
              // Aimed shot at player
              this.fireAtPlayer(playerX, playerY, 5, 280, 0.15);
              break;
            case 2:
              // Quick teleport
              this.x = Phaser.Math.Between(100, 275);
              this.y = Phaser.Math.Between(150, 400);
              this.fireSpread(6, 200);
              break;
          }
          this.comboCount++;
        }
      }
    }

    // Finish combo
    if (elapsed > 4 * comboInterval + 200) {
      this.finishAttack(time);
    }
  }

  private cleanupPillars(): void {
    for (const pillar of this.flamePillars) {
      pillar.graphics?.destroy();
    }
    this.flamePillars = [];
  }

  takeDamage(amount: number): boolean {
    const died = super.takeDamage(amount);

    // Check for enrage trigger
    if (!died && !this.isEnraged && this.bossHealth / this.bossMaxHealth <= this.enrageThreshold) {
      this.triggerEnrage();
    }

    return died;
  }

  update(time: number, delta: number, playerX: number, playerY: number): EnemyUpdateResult {
    const effectResult = super.update(time, delta, playerX, playerY);

    // Update pillar effects
    for (const pillar of this.flamePillars) {
      if (pillar.active) {
        const age = time - pillar.createdAt;
        if (age > this.pillarDuration) {
          pillar.active = false;
          pillar.graphics.clear();
        }
      }
    }

    return effectResult;
  }

  destroy(fromScene?: boolean): void {
    this.cleanupPillars();
    super.destroy(fromScene);
  }
}
