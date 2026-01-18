import Phaser from "phaser";
import Player from "../../entities/Player";
import Enemy from "../../entities/Enemy";
import type SpiritCatPool from "../../systems/SpiritCatPool";
import type DamageNumberPool from "../../systems/DamageNumberPool";
import type { ParticleManager } from "../../systems/ParticleManager";
import type { EnemyDeathHandler } from "./EnemyDeathHandler";
import type { ShootingSystem } from "./ShootingSystem";
import type { CombatSystem } from "./CombatSystem";
import type { TalentBonuses } from "../../config/talentData";
import type { SpiritCatConfig } from "../../config/heroData";
import { hapticManager } from "../../systems/HapticManager";

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
 * - Damage Aura ability (visual + DPS to nearby enemies)
 * - Chainsaw Orbit ability (orbiting sprites + contact damage)
 * - Spirit Cats (Meowgik hero ability - homing projectiles)
 */
export class PassiveEffectSystem {
  private scene: Phaser.Scene;
  private player: Player;
  private enemies: Phaser.Physics.Arcade.Group;
  private spiritCatPool: SpiritCatPool | null;
  private damageNumberPool: DamageNumberPool;
  private particles: ParticleManager;
  private getEnemyDeathHandler: () => EnemyDeathHandler;
  private getShootingSystem: () => ShootingSystem;
  private getCombatSystem: () => CombatSystem;
  private talentBonuses: TalentBonuses;
  private spiritCatConfig: SpiritCatConfig | null;
  private eventHandlers: PassiveEffectEventHandlers;

  // Iron Will state tracking (Epic talent: bonus HP when low health)
  private ironWillActive: boolean = false;
  private ironWillBonusHP: number = 0;

  // Damage aura tracking
  private damageAuraGraphics: Phaser.GameObjects.Graphics | null = null;
  private lastAuraDamageTime: number = 0;
  private readonly AURA_DAMAGE_INTERVAL = 500; // Apply damage every 500ms (2x per second)
  private lastAuraRadius: number = 0; // Cache aura state to avoid redundant operations

  // Chainsaw orbit system
  private chainsawSprites: Phaser.GameObjects.Sprite[] = [];
  private chainsawOrbitAngle: number = 0;
  private lastChainsawDamageTime: number = 0;
  private readonly CHAINSAW_DAMAGE_INTERVAL = 200; // 5 damage ticks per second
  private readonly CHAINSAW_ORBIT_RADIUS = 100;
  private readonly CHAINSAW_ORBIT_PERIOD = 2000; // 2 seconds per full rotation
  private readonly CHAINSAW_HITBOX_RADIUS = 24;

  // Spirit cat system (Meowgik hero ability)
  private lastSpiritCatSpawnTime: number = 0;

  constructor(config: PassiveEffectSystemConfig) {
    this.scene = config.scene;
    this.player = config.player;
    this.enemies = config.enemies;
    this.spiritCatPool = config.spiritCatPool;
    this.damageNumberPool = config.damageNumberPool;
    this.particles = config.particles;
    this.getEnemyDeathHandler = config.getEnemyDeathHandler;
    this.getShootingSystem = config.getShootingSystem;
    this.getCombatSystem = config.getCombatSystem;
    this.talentBonuses = config.talentBonuses;
    this.spiritCatConfig = config.spiritCatConfig;
    this.eventHandlers = config.eventHandlers;
  }

  /**
   * Initialize damage aura graphics (should be called after player is created)
   * @param playerDepth The depth of the player sprite (aura renders below player)
   */
  initializeDamageAuraGraphics(playerDepth: number): void {
    this.damageAuraGraphics = this.scene.add.graphics();
    this.damageAuraGraphics.setDepth(playerDepth - 1);
  }

  /**
   * Main update loop for all passive effects
   * @param time Current game time
   * @param delta Time since last frame
   * @param playerX Player X position
   * @param playerY Player Y position
   */
  update(time: number, delta: number, playerX: number, playerY: number): void {
    // Update damage aura visual and apply damage if player has the ability
    this.updateDamageAuraVisual(time, playerX, playerY);
    this.applyDamageAura(time, playerX, playerY);

    // Update chainsaw orbit visual and apply damage
    this.updateChainsawOrbit(time, delta, playerX, playerY);

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
    // Clean up damage aura graphics
    if (this.damageAuraGraphics) {
      this.damageAuraGraphics.destroy();
      this.damageAuraGraphics = null;
    }

    // Clean up chainsaw orbit sprites
    for (const sprite of this.chainsawSprites) {
      sprite.destroy();
    }
    this.chainsawSprites = [];
    this.chainsawOrbitAngle = 0;
    this.lastChainsawDamageTime = 0;

    // Reset Iron Will state
    this.ironWillActive = false;
    this.ironWillBonusHP = 0;
  }

  /**
   * Update the damage aura visual effect around the player
   * Shows a pulsing circle when damage aura ability is active
   * Optimized: Early exit when inactive, avoids redundant operations
   */
  private updateDamageAuraVisual(time: number, playerX: number, playerY: number): void {
    if (!this.damageAuraGraphics) return;

    const auraRadius = this.player.getDamageAuraRadius();

    // Early exit: if aura is inactive and was already cleared, do nothing
    if (auraRadius <= 0) {
      if (this.lastAuraRadius > 0) {
        // Aura just became inactive, clear once
        this.damageAuraGraphics.clear();
        this.lastAuraRadius = 0;
      }
      return;
    }

    // Track that aura is active
    this.lastAuraRadius = auraRadius;

    // Clear and redraw (needed because aura moves with player)
    this.damageAuraGraphics.clear();

    // Create pulsing effect
    const pulseSpeed = 0.003; // Pulse speed
    const pulsePhase = (Math.sin(time * pulseSpeed) + 1) / 2; // 0 to 1
    const pulseAlpha = 0.15 + pulsePhase * 0.2; // 0.15 to 0.35

    // Outer ring - main aura boundary
    this.damageAuraGraphics.lineStyle(3, 0xff4400, 0.5 + pulsePhase * 0.3);
    this.damageAuraGraphics.strokeCircle(playerX, playerY, auraRadius);

    // Inner glow - fills the aura area
    this.damageAuraGraphics.fillStyle(0xff4400, pulseAlpha * 0.4);
    this.damageAuraGraphics.fillCircle(playerX, playerY, auraRadius);

    // Inner ring for depth effect
    this.damageAuraGraphics.lineStyle(2, 0xff6600, 0.3 + pulsePhase * 0.2);
    this.damageAuraGraphics.strokeCircle(playerX, playerY, auraRadius * 0.7);
  }

  /**
   * Apply damage aura to nearby enemies
   * Deals DPS damage every AURA_DAMAGE_INTERVAL ms to enemies within radius
   */
  private applyDamageAura(time: number, playerX: number, playerY: number): void {
    const auraDPS = this.player.getDamageAuraDPS();
    if (auraDPS <= 0) return;

    // Only apply damage at intervals
    if (time - this.lastAuraDamageTime < this.AURA_DAMAGE_INTERVAL) return;
    this.lastAuraDamageTime = time;

    const auraRadius = this.player.getDamageAuraRadius();
    // Calculate damage per tick (DPS / 2 since we apply 2x per second)
    const damagePerTick = Math.floor(auraDPS / 2);

    const enemiesToDestroy: Enemy[] = [];

    // Find and damage all enemies within aura radius
    this.enemies.getChildren().forEach((enemy) => {
      const e = enemy as Enemy;
      if (!e.active) return;

      const distance = Phaser.Math.Distance.Between(playerX, playerY, e.x, e.y);
      if (distance <= auraRadius) {
        const killed = e.takeDamage(damagePerTick);

        // Show damage number
        this.damageNumberPool.showEnemyDamage(e.x, e.y, damagePerTick, false);

        // Visual feedback - emit particles
        this.particles.emitHit(e.x, e.y);

        if (killed) {
          enemiesToDestroy.push(e);
        }
      }
    });

    // Handle deaths from aura damage
    this.getEnemyDeathHandler().handleMultipleDeaths(enemiesToDestroy);
  }

  /**
   * Update chainsaw orbit visual and damage
   * Chainsaws orbit the player at fixed radius, spinning on their own axis
   * Each chainsaw level adds +1 chainsaw evenly spaced around orbit
   */
  private updateChainsawOrbit(time: number, delta: number, playerX: number, playerY: number): void {
    const chainsawCount = this.player.getChainsawOrbitCount();
    if (chainsawCount <= 0) {
      // No chainsaws, hide any existing sprites
      this.chainsawSprites.forEach((sprite) => sprite.setVisible(false));
      return;
    }

    // Ensure we have enough sprites for current chainsaw count
    while (this.chainsawSprites.length < chainsawCount) {
      const sprite = this.scene.add.sprite(0, 0, "chainsawOrbit");
      sprite.setDisplaySize(48, 48);
      sprite.setDepth(this.player.depth + 1);
      this.chainsawSprites.push(sprite);
    }

    // Update orbital angle (2s per full rotation)
    this.chainsawOrbitAngle += ((Math.PI * 2) / this.CHAINSAW_ORBIT_PERIOD) * delta;

    // Position and rotate each chainsaw
    for (let i = 0; i < chainsawCount; i++) {
      const sprite = this.chainsawSprites[i];
      if (!sprite) continue;

      sprite.setVisible(true);

      // Calculate orbital position (evenly spaced)
      const angle = this.chainsawOrbitAngle + (Math.PI * 2 * i) / chainsawCount;
      const x = playerX + Math.cos(angle) * this.CHAINSAW_ORBIT_RADIUS;
      const y = playerY + Math.sin(angle) * this.CHAINSAW_ORBIT_RADIUS;

      sprite.setPosition(x, y);

      // Spin on own axis (fast rotation for blur effect)
      sprite.rotation += 0.3;
    }

    // Hide any extra sprites (from previous higher levels if ability was lost)
    for (let i = chainsawCount; i < this.chainsawSprites.length; i++) {
      this.chainsawSprites[i].setVisible(false);
    }

    // Apply damage to enemies within chainsaw hitbox
    this.applyChainsawDamage(time, playerX, playerY, chainsawCount);
  }

  /**
   * Apply chainsaw damage to enemies within hitbox radius of any chainsaw
   */
  private applyChainsawDamage(
    time: number,
    playerX: number,
    playerY: number,
    chainsawCount: number,
  ): void {
    // Only apply damage at intervals
    if (time - this.lastChainsawDamageTime < this.CHAINSAW_DAMAGE_INTERVAL) return;
    this.lastChainsawDamageTime = time;

    const damage = this.player.getChainsawOrbitDamage();
    if (damage <= 0) return;

    const enemiesToDestroy: Enemy[] = [];
    const hitEnemies = new Set<Enemy>(); // Track hit enemies to prevent double damage from multiple chainsaws

    // Check each chainsaw position for enemy collisions
    for (let i = 0; i < chainsawCount; i++) {
      const angle = this.chainsawOrbitAngle + (Math.PI * 2 * i) / chainsawCount;
      const chainsawX = playerX + Math.cos(angle) * this.CHAINSAW_ORBIT_RADIUS;
      const chainsawY = playerY + Math.sin(angle) * this.CHAINSAW_ORBIT_RADIUS;

      // Find enemies within chainsaw hitbox
      this.enemies.getChildren().forEach((enemy) => {
        const e = enemy as Enemy;
        if (!e.active || hitEnemies.has(e)) return;

        const distance = Phaser.Math.Distance.Between(chainsawX, chainsawY, e.x, e.y);
        if (distance <= this.CHAINSAW_HITBOX_RADIUS + 16) {
          // +16 for enemy hitbox
          hitEnemies.add(e);

          const killed = e.takeDamage(damage);

          // Visual feedback
          this.damageNumberPool.showEnemyDamage(e.x, e.y, damage, false);
          this.particles.emitHit(e.x, e.y);
          hapticManager.light();

          if (killed) {
            enemiesToDestroy.push(e);
          }
        }
      });
    }

    // Handle deaths from chainsaw damage
    this.getEnemyDeathHandler().handleMultipleDeaths(enemiesToDestroy);
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
