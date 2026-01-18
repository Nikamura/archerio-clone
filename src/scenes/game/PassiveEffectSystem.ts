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
import { ShieldBarrierManager } from "../../systems/ShieldBarrierManager";
import { OrbitalManager } from "../../systems/OrbitalManager";
import SpiritPetPool from "../../systems/SpiritPetPool";

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

  // Shield barrier system
  private shieldBarrierManager: ShieldBarrierManager;

  // Orbital system (rotating orbs and shields)
  private orbitalManager: OrbitalManager;

  // Spirit pet system (Spirit Pets ability)
  private spiritPetPool: SpiritPetPool;
  private lastSpiritPetSpawnTime: Map<number, number> = new Map(); // Per-pet spawn times
  private spiritPetSpawnInterval: number = 1500; // 1.5s per pet

  constructor(config: PassiveEffectSystemConfig) {
    this.player = config.player;
    this.spiritCatPool = config.spiritCatPool;
    this.getShootingSystem = config.getShootingSystem;
    this.getCombatSystem = config.getCombatSystem;
    this.talentBonuses = config.talentBonuses;
    this.spiritCatConfig = config.spiritCatConfig;
    this.eventHandlers = config.eventHandlers;

    // Initialize shield barrier manager
    this.shieldBarrierManager = new ShieldBarrierManager(config.scene, config.player);

    // Initialize orbital manager
    this.orbitalManager = new OrbitalManager(config.scene, config.player);

    // Initialize spirit pet pool
    this.spiritPetPool = new SpiritPetPool(config.scene);
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
   * @param delta Time since last frame
   * @param playerX Player X position
   * @param playerY Player Y position
   */
  update(time: number, delta: number, playerX: number, playerY: number): void {
    // Spawn spirit cats if playing as Meowgik
    if (this.spiritCatPool && this.spiritCatConfig) {
      this.updateSpiritCats(time, playerX, playerY);
    }

    // Update shield barrier
    this.shieldBarrierManager.update(time, delta);

    // Update orbital entities (orbs and shields)
    this.orbitalManager.update(time, delta);

    // Spawn spirit pets if player has the ability
    const spiritPetCount = this.player.getSpiritPetCount();
    if (spiritPetCount > 0) {
      this.updateSpiritPets(time, playerX, playerY, spiritPetCount);
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
   * Update shield barrier stats when ability is acquired/upgraded
   */
  updateShieldBarrier(): void {
    this.shieldBarrierManager.updateShieldStats();
  }

  /**
   * Absorb damage through shield barrier
   * @returns remaining damage after shield absorption
   */
  absorbDamageWithShield(damage: number): number {
    return this.shieldBarrierManager.absorbDamage(damage);
  }

  /**
   * Get shield barrier manager for external access
   */
  getShieldBarrierManager(): ShieldBarrierManager {
    return this.shieldBarrierManager;
  }

  /**
   * Get orbital manager for external access (physics collisions)
   */
  getOrbitalManager(): OrbitalManager {
    return this.orbitalManager;
  }

  /**
   * Get spirit pet pool for external access (physics collisions)
   */
  getSpiritPetPool(): SpiritPetPool {
    return this.spiritPetPool;
  }

  /**
   * Clean up resources when scene shuts down
   */
  destroy(): void {
    // Reset Iron Will state
    this.ironWillActive = false;
    this.ironWillBonusHP = 0;

    // Clean up shield barrier
    this.shieldBarrierManager.destroy();

    // Clean up orbital manager
    this.orbitalManager.destroy();
  }

  /**
   * Update spirit pet spawning for Spirit Pets ability
   */
  private updateSpiritPets(
    time: number,
    playerX: number,
    playerY: number,
    petCount: number,
  ): void {
    // Find nearest enemy to target
    const target = this.getShootingSystem().getCachedNearestEnemy();
    if (!target) return;

    // Pet damage scales with player damage (25%)
    const petDamage = Math.floor(this.player.getDamage() * 0.25);

    // Spawn each pet independently based on their cooldown
    for (let i = 0; i < petCount; i++) {
      const lastSpawn = this.lastSpiritPetSpawnTime.get(i) || 0;
      if (time - lastSpawn < this.spiritPetSpawnInterval) continue;

      // Spawn pet in circular pattern around player
      const spawnAngle = (Math.PI * 2 * i) / petCount + time * 0.002; // Slower rotation
      const spawnDistance = 45;
      const spawnX = playerX + Math.cos(spawnAngle) * spawnDistance;
      const spawnY = playerY + Math.sin(spawnAngle) * spawnDistance;

      this.spiritPetPool.spawn(spawnX, spawnY, target, petDamage, i);
      this.lastSpiritPetSpawnTime.set(i, time);
    }
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
