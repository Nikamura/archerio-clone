import Phaser from "phaser";
import Player from "../../entities/Player";
import Boss from "../../entities/Boss";
import Enemy from "../../entities/Enemy";
import type { InputSystem } from "./InputSystem";
import type { LevelUpSystem } from "./LevelUpSystem";
import type { RoomManager } from "./RoomManager";
import type { AbilitySystem } from "./AbilitySystem";
import type { EnemyDeathHandler } from "./EnemyDeathHandler";
import type { PickupSystem } from "./PickupSystem";
import type EnemyBulletPool from "../../systems/EnemyBulletPool";
import type BombPool from "../../systems/BombPool";
import type { ParticleManager } from "../../systems/ParticleManager";
import type { DifficultyConfig } from "../../config/difficulty";
import { audioManager } from "../../systems/AudioManager";
import { hapticManager } from "../../systems/HapticManager";
import { chapterManager } from "../../systems/ChapterManager";
import { getBossDefinition, BossId } from "../../config/bossData";
import type { RespawnRoomState, EnemyRespawnState } from "../GameOverScene";

/**
 * Event handlers for respawn system events
 */
export interface RespawnEventHandlers {
  /** Called when respawn is complete and gameplay resumes */
  onRespawnComplete: (newInputSystem: InputSystem) => void;
  /** Update health UI after respawn */
  onUpdateHealthUI: () => void;
}

/**
 * Configuration for RespawnSystem
 * Note: Always endless mode
 */
export interface RespawnSystemConfig {
  scene: Phaser.Scene;
  game: Phaser.Game;
  player: Player;
  enemies: Phaser.Physics.Arcade.Group;
  getBoss: () => Boss | null;
  getInputSystem: () => InputSystem;
  getLevelUpSystem: () => LevelUpSystem;
  getRoomManager: () => RoomManager;
  getAbilitySystem: () => AbilitySystem;
  getEnemyDeathHandler: () => EnemyDeathHandler;
  getIsGameOver: () => boolean;
  setIsGameOver: (value: boolean) => void;
  createInputSystem: () => InputSystem;
  enemyBulletPool: EnemyBulletPool;
  bombPool: BombPool;
  particles: ParticleManager;
  difficultyConfig: DifficultyConfig;
  getPickupSystem: () => PickupSystem;
  runSeedString: string;
  eventHandlers: RespawnEventHandlers;
}

/**
 * RespawnSystem - Manages player death, respawn, and game over flow
 *
 * Extracted from GameScene to provide focused respawn/death handling.
 * Manages:
 * - Game over triggering and scene transitions
 * - Room state saving for respawn
 * - Respawn flow (health restore, immunity, enemy pushback)
 * - Visual effects (golden ring, enemy pushback)
 */
export class RespawnSystem {
  private scene: Phaser.Scene;
  private game: Phaser.Game;
  private player: Player;
  private enemies: Phaser.Physics.Arcade.Group;
  private getBoss: () => Boss | null;
  private getInputSystem: () => InputSystem;
  private getLevelUpSystem: () => LevelUpSystem;
  private getRoomManager: () => RoomManager;
  private getAbilitySystem: () => AbilitySystem;
  private getEnemyDeathHandler: () => EnemyDeathHandler;
  private gameOverGetter: () => boolean;
  private gameOverSetter: (value: boolean) => void;
  private createInputSystem: () => InputSystem;
  private enemyBulletPool: EnemyBulletPool;
  private bombPool: BombPool;
  private particles: ParticleManager;
  private difficultyConfig: DifficultyConfig;
  private getPickupSystem: () => PickupSystem;
  private runSeedString: string;
  private eventHandlers: RespawnEventHandlers;

  // Respawn tracking (one-time use per run)
  private respawnUsed: boolean = false;

  // Run timing
  private runStartTime: number = 0;

  constructor(config: RespawnSystemConfig) {
    this.scene = config.scene;
    this.game = config.game;
    this.player = config.player;
    this.enemies = config.enemies;
    this.getBoss = config.getBoss;
    this.getInputSystem = config.getInputSystem;
    this.getLevelUpSystem = config.getLevelUpSystem;
    this.getRoomManager = config.getRoomManager;
    this.getAbilitySystem = config.getAbilitySystem;
    this.getEnemyDeathHandler = config.getEnemyDeathHandler;
    this.gameOverGetter = config.getIsGameOver;
    this.gameOverSetter = config.setIsGameOver;
    this.createInputSystem = config.createInputSystem;
    this.enemyBulletPool = config.enemyBulletPool;
    this.bombPool = config.bombPool;
    this.particles = config.particles;
    this.difficultyConfig = config.difficultyConfig;
    this.getPickupSystem = config.getPickupSystem;
    this.runSeedString = config.runSeedString;
    this.eventHandlers = config.eventHandlers;
  }

  /**
   * Set the run start time (called from GameScene.create())
   */
  setRunStartTime(time: number): void {
    this.runStartTime = time;
  }

  /**
   * Check if respawn has been used this run
   */
  isRespawnUsed(): boolean {
    return this.respawnUsed;
  }

  /**
   * Reset respawn state for new run
   */
  resetRespawnState(): void {
    this.respawnUsed = false;
  }

  /**
   * Trigger game over - handles player death flow
   * Checks for Extra Life, shows game over screen, manages respawn option
   */
  triggerGameOver(): void {
    if (this.gameOverGetter()) return;

    const abilitySystem = this.getAbilitySystem();

    // Check for Extra Life before dying
    if (this.player.hasExtraLife()) {
      if (this.player.useExtraLife()) {
        console.log("Extra Life used! Reviving at 30% HP");
        // Remove extra life from skills bar
        abilitySystem.consumeAbility("extra_life");
        // Show revive effect
        this.player.clearTint();
        this.scene.cameras.main.flash(500, 255, 215, 0); // Golden flash
        audioManager.playLevelUp(); // Triumphant sound
        hapticManager.levelUp();
        // Update health UI
        this.eventHandlers.onUpdateHealthUI();
        // Brief invincibility after revive
        this.player.setTint(0xffffff);
        this.scene.time.delayedCall(100, () => {
          if (this.player && this.player.active) {
            this.player.clearTint();
          }
        });
        return; // Don't trigger game over
      }
    }

    this.gameOverSetter(true);
    audioManager.playDeath();
    hapticManager.death(); // Haptic feedback for player death
    console.log("Game Over! Enemies killed:", this.getEnemyDeathHandler().getEnemiesKilled());

    // Stop LevelUpScene if it's active (handles race condition edge cases)
    if (this.scene.scene.isActive("LevelUpScene")) {
      this.scene.scene.stop("LevelUpScene");
      this.game.events.off("abilitySelected"); // Clean up listener
    }

    // Check if respawn is available (one-time use per run)
    const canRespawn = !this.respawnUsed;

    // Save room state for respawn (enemy and boss HP)
    const respawnRoomState = canRespawn ? this.saveRoomStateForRespawn() : undefined;

    // Only end run if respawn is not available
    if (!canRespawn) {
      chapterManager.endRun(true);
    }

    // Stop player movement
    this.player.setVelocity(0, 0);

    // Flash player red and fade out
    this.player.setTint(0xff0000);

    // Only destroy input system if respawn is not available
    const inputSystem = this.getInputSystem();
    if (!canRespawn && inputSystem) {
      inputSystem.destroy();
    }

    // Calculate play time
    const playTimeMs = Date.now() - this.runStartTime;

    // Brief delay before showing game over screen
    this.scene.time.delayedCall(500, () => {
      // Stop UIScene first (but keep GameScene if respawn is available)
      this.scene.scene.stop("UIScene");

      const roomManager = this.getRoomManager();
      const enemyDeathHandler = this.getEnemyDeathHandler();
      const levelUpSystem = this.getLevelUpSystem();

      // Calculate total rooms cleared across all waves (always endless mode)
      const currentRoom = roomManager.getRoomNumber();
      const totalRooms = roomManager.getTotalRooms();
      const endlessWave = roomManager.getEndlessWave();
      const totalRoomsCleared = (endlessWave - 1) * totalRooms + currentRoom - 1;

      // Launch game over scene with stats
      this.scene.scene.launch("GameOverScene", {
        roomsCleared: totalRoomsCleared,
        enemiesKilled: enemyDeathHandler.getEnemiesKilled(),
        isVictory: false,
        playTimeMs,
        abilitiesGained: abilitySystem.getTotalAbilitiesGained(),
        goldEarned: this.getPickupSystem().getGoldEarned(),
        runSeed: this.runSeedString,
        acquiredAbilities: levelUpSystem.getAcquiredAbilitiesArray(),
        heroXPEarned: enemyDeathHandler.getHeroXPEarned(),
        isEndlessMode: true,
        endlessWave: endlessWave,
        chapterId: chapterManager.getSelectedChapter(),
        difficulty: this.difficultyConfig.label.toLowerCase(),
        canRespawn,
        respawnRoomState,
      });

      // Only stop GameScene if respawn is NOT available
      // When respawn is available, keep the scene running so we can resume
      if (!canRespawn) {
        this.scene.scene.stop("GameScene");
      }
    });
  }

  /**
   * Save current room state for respawn (enemy and boss HP)
   */
  saveRoomStateForRespawn(): RespawnRoomState {
    const enemies: EnemyRespawnState[] = [];
    const boss = this.getBoss();

    // Save all active enemies' HP and position
    this.enemies.getChildren().forEach((child) => {
      const enemy = child as Enemy;
      if (enemy.active) {
        enemies.push({
          x: enemy.x,
          y: enemy.y,
          health: enemy.getHealth(),
          maxHealth: enemy.getMaxHealth(),
          type: enemy.constructor.name,
        });
      }
    });

    // Save boss HP if present
    const bossHealth = boss?.getHealth();
    const bossMaxHealth = boss?.getMaxHealth();

    console.log(
      `RespawnSystem: Saved room state - ${enemies.length} enemies, boss HP: ${bossHealth ?? "N/A"}`,
    );

    return {
      enemies,
      bossHealth,
      bossMaxHealth,
    };
  }

  /**
   * Handle player respawn from GameOverScene (after watching ad)
   */
  handleRespawn(_roomState: RespawnRoomState): void {
    console.log("RespawnSystem: Handling respawn");

    // Mark respawn as used (one-time per run)
    this.respawnUsed = true;

    // Reset game over state
    this.gameOverSetter(false);

    const levelUpSystem = this.getLevelUpSystem();
    const roomManager = this.getRoomManager();

    // Grant temporary immunity (2 seconds to escape danger)
    levelUpSystem.setLevelingUp(true);
    this.scene.time.delayedCall(2000, () => {
      levelUpSystem.setLevelingUp(false);
    });

    // Restore player to 50% HP
    const maxHealth = this.player.getMaxHealth();
    const healAmount = Math.floor(maxHealth * 0.5);
    this.player.heal(healAmount);

    // Clear dead state visual
    this.player.clearTint();

    // Show respawn visual effect - expanding ring
    this.showRespawnEffect();

    // Push all enemies away from player
    this.pushEnemiesAway();

    // Show revive effect
    this.scene.cameras.main.flash(500, 255, 215, 0); // Golden flash
    audioManager.playLevelUp();
    hapticManager.levelUp();

    // Enemies and boss keep their current HP since we didn't destroy GameScene
    // The room state was passed for potential future use, but enemies are already in place

    // Restart UIScene
    this.scene.scene.launch("UIScene");

    // Re-show boss health bar if we're in a boss room
    const boss = roomManager.getBoss();
    const currentBossType = roomManager.getCurrentBossType();
    if (boss && boss.active) {
      const bossDef = getBossDefinition(currentBossType as BossId);
      const bossName = bossDef?.name || currentBossType?.replace(/_/g, " ") || "Boss";
      // Delay slightly to ensure UIScene is ready
      this.scene.time.delayedCall(50, () => {
        this.scene.scene
          .get("UIScene")
          .events.emit("showBossHealth", boss.getHealth(), boss.getMaxHealth(), bossName);
      });
    }

    // Re-initialize input system via callback
    const newInputSystem = this.createInputSystem();
    this.eventHandlers.onRespawnComplete(newInputSystem);

    // Update health UI
    this.eventHandlers.onUpdateHealthUI();

    console.log("RespawnSystem: Respawn complete - Player HP:", this.player.getHealth());
  }

  /**
   * Show visual effect for respawn (expanding golden ring)
   */
  private showRespawnEffect(): void {
    const graphics = this.scene.add.graphics();
    graphics.setDepth(50);

    const playerX = this.player.x;
    const playerY = this.player.y;
    const maxRadius = 150;
    const duration = 400;

    // Animate expanding ring
    let elapsed = 0;
    const timer = this.scene.time.addEvent({
      delay: 16, // ~60fps
      repeat: Math.floor(duration / 16),
      callback: () => {
        elapsed += 16;
        const progress = elapsed / duration;
        const radius = maxRadius * progress;
        const alpha = 1 - progress;

        graphics.clear();
        graphics.lineStyle(4, 0xffd700, alpha); // Gold color
        graphics.strokeCircle(playerX, playerY, radius);

        // Inner glow
        graphics.lineStyle(8, 0xffaa00, alpha * 0.5);
        graphics.strokeCircle(playerX, playerY, radius * 0.8);

        if (progress >= 1) {
          graphics.destroy();
          timer.destroy();
        }
      },
    });

    // Add particle burst effect
    if (this.particles) {
      this.particles.emitLevelUp(playerX, playerY);
    }
  }

  /**
   * Push all enemies away from player on respawn
   */
  private pushEnemiesAway(): void {
    const pushForce = 500;
    const minDistance = 150; // Minimum distance to push enemies to
    const boss = this.getBoss();

    // Push ALL regular enemies away
    this.enemies.getChildren().forEach((child) => {
      const enemy = child as Enemy;
      if (!enemy.active) return;

      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);

      // Calculate angle from player to enemy
      const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);

      // If enemy is too close, teleport them to minimum distance
      if (distance < minDistance) {
        enemy.x = this.player.x + Math.cos(angle) * minDistance;
        enemy.y = this.player.y + Math.sin(angle) * minDistance;
      }

      // Apply strong outward velocity
      const body = enemy.body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.setVelocity(Math.cos(angle) * pushForce, Math.sin(angle) * pushForce);
      }
    });

    // Push boss if present
    if (boss && boss.active) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, boss.x, boss.y);

      const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, boss.x, boss.y);

      // If boss is too close, teleport them to minimum distance
      if (distance < minDistance) {
        boss.x = this.player.x + Math.cos(angle) * minDistance;
        boss.y = this.player.y + Math.sin(angle) * minDistance;
      }

      const body = boss.body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.setVelocity(Math.cos(angle) * pushForce * 0.7, Math.sin(angle) * pushForce * 0.7);
      }
    }

    // Clear ALL flying bullets (both enemy and bomb projectiles)
    this.enemyBulletPool.getChildren().forEach((child) => {
      const bullet = child as Phaser.Physics.Arcade.Sprite;
      if (bullet.active) {
        bullet.setActive(false);
        bullet.setVisible(false);
        const body = bullet.body as Phaser.Physics.Arcade.Body;
        if (body) {
          body.stop();
          body.enable = false;
        }
      }
    });

    // Also clear bombs if present
    if (this.bombPool) {
      this.bombPool.getChildren().forEach((child) => {
        const bomb = child as Phaser.Physics.Arcade.Sprite;
        if (bomb.active) {
          bomb.setActive(false);
          bomb.setVisible(false);
        }
      });
    }
  }
}
