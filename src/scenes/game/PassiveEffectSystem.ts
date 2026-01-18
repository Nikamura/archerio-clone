import Phaser from "phaser";
import Player from "../../entities/Player";
import type SpiritCatPool from "../../systems/SpiritCatPool";
import type DamageNumberPool from "../../systems/DamageNumberPool";
import type { ParticleManager } from "../../systems/ParticleManager";
import type { EnemyDeathHandler } from "./EnemyDeathHandler";
import type { ShootingSystem } from "./ShootingSystem";
import type { CombatSystem } from "./CombatSystem";
import type { TalentBonuses } from "../../config/talentData";
import type { SpiritCatConfig } from "../../config/heroData";

/**
 * Event handlers for passive effect system events
 */
export interface PassiveEffectEventHandlers {
  /** Called when Iron Will is activated (bonus HP granted) */
  onIronWillActivated: (bonusHP: number) => void;
  /** Called when Iron Will is deactivated (bonus HP removed) */
  onIronWillDeactivated: (bonusHP: number) => void;
  /** Update health UI after Iron Will changes */
  onUpdateHealthUI: () => void;
}

/**
 * Configuration for PassiveEffectSystem
 * Note: Some properties are kept for API compatibility but not stored
 */
export interface PassiveEffectSystemConfig {
  scene: Phaser.Scene;
  player: Player;
  enemies: Phaser.Physics.Arcade.Group;
  spiritCatPool: SpiritCatPool | null;
  damageNumberPool: DamageNumberPool;
  particles: ParticleManager;
  getEnemyDeathHandler: () => EnemyDeathHandler;
  getShootingSystem: () => ShootingSystem;
  getCombatSystem: () => CombatSystem;
  talentBonuses: TalentBonuses;
  spiritCatConfig: SpiritCatConfig | null;
  eventHandlers: PassiveEffectEventHandlers;
}

/**
 * PassiveEffectSystem - Manages passive ability effects around the player
 *
 * Extracted from GameScene to provide focused passive effect handling.
 * Manages:
 * - Iron Will talent (bonus HP when low health)
 * - Spirit Cats (Meowgik hero ability - homing projectiles)
 */
export class PassiveEffectSystem {
  private player: Player;
  private spiritCatPool: SpiritCatPool | null;
  private getShootingSystem: () => ShootingSystem;
  private getCombatSystem: () => CombatSystem;
  private talentBonuses: TalentBonuses;
  private spiritCatConfig: SpiritCatConfig | null;
  private eventHandlers: PassiveEffectEventHandlers;

  // Iron Will state tracking (Epic talent: bonus HP when low health)
  private ironWillActive: boolean = false;
  private ironWillBonusHP: number = 0;

  // Spirit cat system (Meowgik hero ability)
  private lastSpiritCatSpawnTime: number = 0;

  constructor(config: PassiveEffectSystemConfig) {
    this.player = config.player;
    this.spiritCatPool = config.spiritCatPool;
    this.getShootingSystem = config.getShootingSystem;
    this.getCombatSystem = config.getCombatSystem;
    this.talentBonuses = config.talentBonuses;
    this.spiritCatConfig = config.spiritCatConfig;
    this.eventHandlers = config.eventHandlers;
  }

  /**
   * Initialize damage aura graphics (no-op, kept for API compatibility)
   * @param _playerDepth The depth of the player sprite (unused)
   */
  initializeDamageAuraGraphics(_playerDepth: number): void {
    // No-op: damage aura ability removed
  }

  /**
   * Main update loop for all passive effects
   * @param time Current game time
   * @param _delta Time since last frame
   * @param playerX Player X position
   * @param playerY Player Y position
   */
  update(time: number, _delta: number, playerX: number, playerY: number): void {
    // Spawn spirit cats if playing as Meowgik
    if (this.spiritCatPool && this.spiritCatConfig) {
      this.updateSpiritCats(time, playerX, playerY);
    }
  }

  /**
   * Check and update Iron Will talent status (Epic talent: bonus HP when low health)
   * Called after player takes damage or heals
   */
  checkIronWillStatus(): void {
    // Skip if player doesn't have Iron Will talent
    if (this.talentBonuses.percentHpWhenLow <= 0) return;

    const currentHealth = this.player.getHealth();
    const maxHealth = this.player.getMaxHealth();
    const healthPercent = currentHealth / maxHealth;
    const threshold = this.talentBonuses.lowHpThreshold / 100; // Convert from percentage

    const shouldBeActive = healthPercent <= threshold && healthPercent > 0;

    if (shouldBeActive && !this.ironWillActive) {
      // Activate Iron Will - grant bonus max HP
      this.ironWillActive = true;
      this.ironWillBonusHP = Math.round(maxHealth * (this.talentBonuses.percentHpWhenLow / 100));
      this.player.addMaxHealthBonus(this.ironWillBonusHP);
      console.log(`PassiveEffectSystem: Iron Will activated! +${this.ironWillBonusHP} max HP`);
      this.eventHandlers.onIronWillActivated(this.ironWillBonusHP);
      this.eventHandlers.onUpdateHealthUI();
    } else if (!shouldBeActive && this.ironWillActive) {
      // Deactivate Iron Will - remove bonus max HP
      this.ironWillActive = false;
      this.player.removeMaxHealthBonus(this.ironWillBonusHP);
      console.log(
        `PassiveEffectSystem: Iron Will deactivated, removed ${this.ironWillBonusHP} bonus HP`,
      );
      this.eventHandlers.onIronWillDeactivated(this.ironWillBonusHP);
      this.ironWillBonusHP = 0;
      this.eventHandlers.onUpdateHealthUI();
    }
  }

  /**
   * Handle spirit cat hitting an enemy (physics callback)
   */
  spiritCatHitEnemy(
    cat: Phaser.GameObjects.GameObject,
    enemy: Phaser.GameObjects.GameObject,
  ): void {
    // Delegate to CombatSystem
    this.getCombatSystem().spiritCatHitEnemy(cat, enemy);
  }

  /**
   * Clean up resources when scene shuts down
   */
  destroy(): void {
    // Reset Iron Will state
    this.ironWillActive = false;
    this.ironWillBonusHP = 0;
  }

  /**
   * Update spirit cat spawning for Meowgik hero
   */
  private updateSpiritCats(time: number, playerX: number, playerY: number): void {
    if (!this.spiritCatPool || !this.spiritCatConfig) return;

    // Calculate spawn interval from attack speed (attacks per second)
    const spawnInterval = 1000 / this.spiritCatConfig.attackSpeed;

    // Check spawn interval
    if (time - this.lastSpiritCatSpawnTime < spawnInterval) return;

    // Find nearest enemy to target
    const target = this.getShootingSystem().getCachedNearestEnemy();
    if (!target) return;

    // Spawn cats around the player
    const catCount = this.spiritCatConfig.count;
    // Cat damage scales with player's current attack (30% of player damage)
    // This includes equipment, talents, abilities, and difficulty scaling
    const catDamage = Math.floor(
      this.player.getDamage() * 0.3 * this.spiritCatConfig.damageMultiplier,
    );
    for (let i = 0; i < catCount; i++) {
      // Spawn in circular pattern around player
      const spawnAngle = (Math.PI * 2 * i) / catCount + time * 0.001; // Rotating pattern
      const spawnDistance = 40;
      const spawnX = playerX + Math.cos(spawnAngle) * spawnDistance;
      const spawnY = playerY + Math.sin(spawnAngle) * spawnDistance;

      this.spiritCatPool.spawn(spawnX, spawnY, target, catDamage, this.spiritCatConfig.canCrit);
    }

    this.lastSpiritCatSpawnTime = time;
  }
}
