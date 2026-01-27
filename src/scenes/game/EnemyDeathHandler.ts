import Phaser from "phaser";
import Player from "../../entities/Player";
import Enemy from "../../entities/Enemy";
import Boss from "../../entities/Boss";
import { RangedShooterEnemy, SpreaderEnemy } from "../../entities/enemies";
import type { ScreenShake } from "../../systems/ScreenShake";
import type { ParticleManager } from "../../systems/ParticleManager";
import type GoldPool from "../../systems/GoldPool";
import type HealthPool from "../../systems/HealthPool";
import type DamageNumberPool from "../../systems/DamageNumberPool";
import type { RoomManager } from "./RoomManager";
import type { DifficultyConfig } from "../../config/difficulty";
import type { EnemyType } from "../../systems/CurrencyManager";
import { BossId } from "../../config/bossData";
import type { BossType } from "../../config/chapterData";
import { getXpMultiplierForChapter } from "../../config/chapterData";
import { chapterManager } from "../../systems/ChapterManager";
import { saveManager } from "../../systems/SaveManager";
import { errorReporting } from "../../systems/ErrorReportingManager";
import { hapticManager } from "../../systems/HapticManager";

/**
 * Event handlers that GameScene provides for death-related side effects
 */
export interface EnemyDeathEventHandlers {
  onKillRecorded: () => void;
  onPlayerHealthUpdated: () => void;
  onXPUIUpdated: () => void;
  onLevelUp: () => void;
  onBossKilled: () => void;
  onEnemyCacheInvalidated: () => void;
}

/**
 * Configuration for EnemyDeathHandler
 */
export interface EnemyDeathHandlerConfig {
  scene: Phaser.Scene;
  player: Player;
  roomManager: RoomManager;
  particles: ParticleManager;
  screenShake: ScreenShake;
  goldPool: GoldPool;
  healthPool: HealthPool;
  damageNumberPool: DamageNumberPool;
  difficultyConfig: DifficultyConfig;
  bonusXPMultiplier: number;
  eventHandlers: EnemyDeathEventHandlers;
}

/**
 * Options for handling individual enemy deaths
 */
export interface EnemyDeathOptions {
  emitFireParticles?: boolean;
  skipRoomClearedCheck?: boolean;
}

/**
 * EnemyDeathHandler - Handles all enemy death consequences
 *
 * Consolidates the duplicated death handling logic from:
 * - applyDamageAura()
 * - applyChainsawDamage()
 * - handleEnemyDOTDeath()
 * - handleCombatEnemyKilled()
 *
 * Single source of truth for:
 * - Kill tracking and statistics
 * - Bloodthirst healing
 * - Death particles and screen shake
 * - Drop spawning (gold, health)
 * - XP calculation and level ups
 * - Hero XP accumulation
 * - Boss reference cleanup
 */
export class EnemyDeathHandler {
  private scene: Phaser.Scene;
  private player: Player;
  private roomManager: RoomManager;
  private particles: ParticleManager;
  private screenShake: ScreenShake;
  private goldPool: GoldPool;
  private healthPool: HealthPool;
  private damageNumberPool: DamageNumberPool;
  private difficultyConfig: DifficultyConfig;
  private bonusXPMultiplier: number;
  private eventHandlers: EnemyDeathEventHandlers;

  // Tracks kills and XP earned during this run
  private enemiesKilled: number = 0;
  private heroXPEarned: number = 0;

  // Boss reference (set by GameScene when boss spawns)
  private boss: Boss | null = null;

  constructor(config: EnemyDeathHandlerConfig) {
    this.scene = config.scene;
    this.player = config.player;
    this.roomManager = config.roomManager;
    this.particles = config.particles;
    this.screenShake = config.screenShake;
    this.goldPool = config.goldPool;
    this.healthPool = config.healthPool;
    this.damageNumberPool = config.damageNumberPool;
    this.difficultyConfig = config.difficultyConfig;
    this.bonusXPMultiplier = config.bonusXPMultiplier;
    this.eventHandlers = config.eventHandlers;
  }

  /**
   * Update boss reference (called when boss spawns or dies)
   */
  setBoss(boss: Boss | null): void {
    this.boss = boss;
  }

  /**
   * Get current boss reference
   */
  getBoss(): Boss | null {
    return this.boss;
  }

  /**
   * Get total enemies killed this run
   */
  getEnemiesKilled(): number {
    return this.enemiesKilled;
  }

  /**
   * Get total hero XP earned this run
   */
  getHeroXPEarned(): number {
    return this.heroXPEarned;
  }

  /**
   * Reset counters for a new run
   */
  resetCounters(): void {
    this.enemiesKilled = 0;
    this.heroXPEarned = 0;
  }

  /**
   * Handle a single enemy death with all consequences
   *
   * @param enemy - The enemy that died
   * @param isBoss - Whether this enemy is a boss
   * @param options - Optional death handling options
   */
  handleEnemyDeath(enemy: Enemy, isBoss: boolean, options: EnemyDeathOptions = {}): void {
    // 1. Increment kill counter and record stats
    this.enemiesKilled++;
    this.recordKill(enemy, isBoss);
    this.eventHandlers.onKillRecorded();

    // 1.5 Death Nova: AOE damage on enemy kill
    if (this.player.getDeathNovaLevel() > 0) {
      this.triggerDeathNova(enemy);
    }

    // 2. Bloodthirst healing on kill
    const bloodthirstHeal = this.player.getBloodthirstHeal();
    if (bloodthirstHeal > 0) {
      this.player.heal(bloodthirstHeal);
      this.eventHandlers.onPlayerHealthUpdated();
    }

    // 3. Death visual effects
    this.particles.emitDeath(enemy.x, enemy.y);
    if (options.emitFireParticles) {
      this.particles.emitFire(enemy.x, enemy.y);
    }
    this.screenShake.onExplosion();
    hapticManager.light();

    // 4. Spawn drops (gold, health potion)
    this.spawnDrops(enemy);

    // 5. Calculate and add XP
    const baseXpGain = isBoss ? 10 : 2;
    const chapterXpMultiplier = getXpMultiplierForChapter(chapterManager.getSelectedChapter());
    const modifierXpMultiplier = this.player.getXPMultiplier(); // Ascetic (3x) and/or Horde Magnet (2x)
    const xpGain = Math.round(
      baseXpGain * this.bonusXPMultiplier * chapterXpMultiplier * modifierXpMultiplier,
    );
    const leveledUp = this.player.addXP(xpGain);
    this.damageNumberPool.showExpGain(enemy.x, enemy.y, xpGain);
    this.eventHandlers.onXPUIUpdated();

    // 6. Accumulate hero XP (boss gives 25, regular enemy gives 1)
    this.heroXPEarned += isBoss ? 25 : 1;

    // 7. Handle level up if XP threshold reached
    if (leveledUp) {
      this.eventHandlers.onLevelUp();
    }

    // 8. Clear boss reference if boss died
    if (isBoss) {
      this.boss = null;
      this.scene.scene.get("UIScene").events.emit("hideBossHealth");
      this.eventHandlers.onBossKilled();
    }

    // 9. Destroy enemy
    enemy.destroy();

    // 10. Invalidate nearest enemy cache
    this.eventHandlers.onEnemyCacheInvalidated();

    // 11. Check if room cleared (unless skipped for batch processing)
    if (!options.skipRoomClearedCheck) {
      this.roomManager.checkRoomCleared();
    }
  }

  /**
   * Handle multiple enemy deaths efficiently (batch processing)
   *
   * Used by applyDamageAura() and applyChainsawDamage() where multiple
   * enemies can die in a single frame.
   *
   * @param enemies - Array of enemies that died
   */
  handleMultipleDeaths(enemies: Enemy[]): void {
    if (enemies.length === 0) return;

    // Process each death, skipping room cleared check until the end
    for (const enemy of enemies) {
      const isBoss = this.boss !== null && enemy === (this.boss as unknown as Enemy);
      this.handleEnemyDeath(enemy, isBoss, { skipRoomClearedCheck: true });
    }

    // Check room cleared once after all deaths processed
    this.roomManager.checkRoomCleared();
  }

  /**
   * Handle enemy death from CombatSystem (bullet collision)
   * This is a simplified version that doesn't include visual effects
   * since CombatSystem handles those
   *
   * @param enemy - The enemy that died
   * @param isBoss - Whether this enemy is a boss
   */
  handleCombatDeath(enemy: Enemy, isBoss: boolean): void {
    // 1. Increment kill counter and record stats
    this.enemiesKilled++;
    this.recordKill(enemy, isBoss);
    this.eventHandlers.onKillRecorded();

    // Update score display
    this.scene.scene.get("UIScene").events.emit("scoreKill");

    // 2. Bloodthirst healing is handled by CombatSystem

    // 3. Spawn drops
    this.spawnDrops(enemy);

    // 4. Accumulate hero XP (boss gives 25, regular enemy gives 1)
    this.heroXPEarned += isBoss ? 25 : 1;

    // 5. Clear boss reference if boss died (CombatSystem handles UI)
    if (isBoss && this.boss !== null) {
      this.boss = null;
    }

    // 6. Destroy enemy
    enemy.destroy();

    // 7. Invalidate nearest enemy cache
    this.eventHandlers.onEnemyCacheInvalidated();

    // 8. Check if room cleared
    this.roomManager.checkRoomCleared();
  }

  /**
   * Spawn drops at enemy death position
   * - 50% chance to drop gold
   * - 5% chance to drop health potion
   */
  private spawnDrops(enemy: Enemy): void {
    const enemyType = this.getEnemyType(enemy);

    // 50% chance to drop gold
    if (Math.random() < 0.5) {
      const goldValue = this.goldPool.spawnForEnemy(enemy.x, enemy.y, enemyType);
      console.log(`Gold spawned: ${goldValue} from ${enemyType}`);
    }

    // 5% chance to drop health potion (scales with difficulty)
    if (Math.random() < 0.05) {
      const healValue = this.calculateHealthPotionValue();
      this.healthPool.spawn(enemy.x, enemy.y, healValue);
      console.log(`Health potion spawned: ${healValue} HP`);
    }
  }

  /**
   * Calculate health potion heal value based on player stats and difficulty
   * - Scales with player's max health (10% of max HP)
   * - Reduced slightly on higher difficulties (more enemy damage = less healing)
   * - Clamped between 15 and 100 HP
   */
  private calculateHealthPotionValue(): number {
    // Base: 10% of player's max health
    const maxHealth = this.player.getMaxHealth();
    const baseHeal = Math.round(maxHealth * 0.1);

    // Scale down slightly on harder difficulties (enemyDamage is higher)
    // Normal difficulty has enemyDamage around 1.0, hard has 1.5+
    const difficultyMod = Math.max(0.6, 1.0 / this.difficultyConfig.enemyDamageMultiplier);
    const scaledHeal = Math.round(baseHeal * difficultyMod);

    // Clamp between min 15 and max 100 HP
    return Math.min(100, Math.max(15, scaledHeal));
  }

  /**
   * Record a kill for statistics tracking
   * Note: Only boss kills are tracked in Sentry. Regular enemy kills are
   * tracked in aggregate via trackRunCompleted() to avoid excessive events.
   */
  private recordKill(enemy: Enemy, isBoss: boolean): void {
    const currentBossType = this.roomManager.getCurrentBossType();
    if (isBoss && currentBossType) {
      const bossId = this.normalizeBossType(currentBossType);
      saveManager.recordBossKill(bossId);

      // Track boss kill in Sentry metrics (boss kills are rare, so worth tracking individually)
      const timeToKillMs = Date.now() - this.roomManager.getBossSpawnTime();
      errorReporting.trackBossKill(bossId, timeToKillMs, chapterManager.getSelectedChapter());
    } else {
      const enemyType = enemy.getEnemyType();
      saveManager.recordEnemyKill(enemyType);
      // Per-enemy Sentry events removed - aggregate tracked in trackRunCompleted()
    }
  }

  /**
   * Convert BossType to BossId for kill tracking
   * Handles aliases like 'treant' -> 'tree_guardian' and 'frost_giant' -> 'ice_golem'
   */
  private normalizeBossType(bossType: BossType): BossId {
    switch (bossType) {
      case "treant":
        return "tree_guardian";
      case "frost_giant":
        return "ice_golem";
      default:
        return bossType as BossId;
    }
  }

  /**
   * Get enemy type for drop calculations
   */
  private getEnemyType(enemy: Enemy): EnemyType {
    if (enemy instanceof Boss) {
      return "boss";
    }
    if (enemy instanceof SpreaderEnemy) {
      return "spreader";
    }
    if (enemy instanceof RangedShooterEnemy) {
      return "ranged";
    }
    return "melee";
  }

  /**
   * Trigger Death Nova AOE damage around killed enemy
   * Damages nearby enemies based on nova level
   */
  private triggerDeathNova(dyingEnemy: Enemy): void {
    const novaRadius = this.player.getDeathNovaRadius();
    const novaDamagePercent = this.player.getDeathNovaDamagePercent();
    const baseDamage = this.player.getDamage();
    const novaDamage = Math.floor(baseDamage * novaDamagePercent);

    if (novaDamage <= 0 || novaRadius <= 0) return;

    // Visual effect - purple/dark explosion circle
    const graphics = this.scene.add.graphics();
    graphics.lineStyle(3, 0x660066, 1);
    graphics.strokeCircle(dyingEnemy.x, dyingEnemy.y, novaRadius);
    graphics.fillStyle(0x660066, 0.3);
    graphics.fillCircle(dyingEnemy.x, dyingEnemy.y, novaRadius);

    // Fade out effect
    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 300,
      ease: "Quad.easeOut",
      onComplete: () => graphics.destroy(),
    });

    // Find and damage nearby enemies
    const enemyChildren = this.roomManager.getEnemyGroup().getChildren();
    const killedEnemies: Enemy[] = [];

    for (const child of enemyChildren) {
      const enemy = child as Enemy;
      if (!enemy.active || enemy === dyingEnemy) continue;

      const distance = Phaser.Math.Distance.Between(dyingEnemy.x, dyingEnemy.y, enemy.x, enemy.y);

      if (distance <= novaRadius) {
        const killed = enemy.takeDamage(novaDamage);
        this.particles.emitHit(enemy.x, enemy.y);

        if (killed) {
          killedEnemies.push(enemy);
        }
      }
    }

    // Handle chain deaths (but don't trigger nova recursively to avoid infinite loops)
    for (const killed of killedEnemies) {
      const isBoss = this.boss !== null && killed === (this.boss as unknown as Enemy);
      // Use handleCombatDeath to avoid nova recursion
      this.handleCombatDeath(killed, isBoss);
    }
  }
}
