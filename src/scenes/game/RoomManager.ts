import Phaser from "phaser";
import Player from "../../entities/Player";
import Boss from "../../entities/Boss";
import BulletPool from "../../systems/BulletPool";
import EnemyBulletPool from "../../systems/EnemyBulletPool";
import BombPool from "../../systems/BombPool";
import GoldPool from "../../systems/GoldPool";
import HealthPool from "../../systems/HealthPool";
import SpiritCatPool from "../../systems/SpiritCatPool";
import { audioManager } from "../../systems/AudioManager";
import { chapterManager } from "../../systems/ChapterManager";
import { currencyManager } from "../../systems/CurrencyManager";
import { saveManager } from "../../systems/SaveManager";
import type { BossType, ChapterId } from "../../config/chapterData";
import type { DifficultyConfig } from "../../config/difficulty";
import type { RoomGenerator } from "../../systems/RoomGenerator";
import type WallGroup from "../../systems/WallGroup";
import type { SeededRandom } from "../../systems/SeededRandom";
import { EnemySpawnManager } from "./EnemySpawnManager";

/**
 * Calculate chapter based on endless wave number.
 * Progressive difficulty: chapter advances as waves increase.
 * - Wave 1-2: Chapter 1
 * - Wave 3-4: Chapter 2
 * - Wave 5-6: Chapter 3
 * - Wave 7-8: Chapter 4
 * - Wave 9+: Chapter 5
 */
export function getChapterForWave(wave: number): ChapterId {
  if (wave <= 2) return 1;
  if (wave <= 4) return 2;
  if (wave <= 6) return 3;
  if (wave <= 8) return 4;
  return 5;
}

/**
 * Event handlers interface for RoomManager callbacks
 */
export interface RoomEventHandlers {
  onRoomCleared: (roomNumber: number, collectedGold: number) => void;
  onRoomEntered: (roomNumber: number, endlessWave?: number) => void;
  onUpdateRoomUI: (currentRoom: number, totalRooms: number, endlessWave?: number) => void;
  onBossSpawned: (boss: Boss, bossType: BossType, bossName: string) => void;
  onShowBossHealth: (health: number, maxHealth: number, name: string) => void;
  onHideBossHealth: () => void;
  onVictory: () => void;
  onBombExplosion: (x: number, y: number, radius: number, damage: number) => void;
  onChapterChanged: (newChapter: ChapterId) => void;
}

/**
 * Configuration for RoomManager initialization
 */
export interface RoomManagerConfig {
  scene: Phaser.Scene;
  player: Player;
  enemies: Phaser.Physics.Arcade.Group;

  // Pools
  bulletPool: BulletPool;
  enemyBulletPool: EnemyBulletPool;
  bombPool: BombPool;
  goldPool: GoldPool;
  healthPool: HealthPool;
  spiritCatPool: SpiritCatPool | null;

  // Systems
  roomGenerator: RoomGenerator;
  wallGroup: WallGroup;
  runRng: SeededRandom;
  difficultyConfig: DifficultyConfig;

  // Config - always endless mode with 10 rooms per wave
  totalRooms: number;

  eventHandlers: RoomEventHandlers;
}

/**
 * RoomManager - Handles room progression, enemy spawning, and door management
 *
 * Extracted from GameScene to provide focused room management functionality.
 * Manages room transitions, enemy/boss spawning, door creation, and room clearing.
 */
export class RoomManager {
  private scene: Phaser.Scene;
  private player: Player;
  private enemies: Phaser.Physics.Arcade.Group;

  // Pools
  private bulletPool: BulletPool;
  private enemyBulletPool: EnemyBulletPool;
  private goldPool: GoldPool;
  private healthPool: HealthPool;
  private spiritCatPool: SpiritCatPool | null;

  // Systems
  private wallGroup: WallGroup;

  // Enemy spawning (delegated)
  private enemySpawnManager: EnemySpawnManager;

  // Room state
  private currentRoom: number = 1;
  private totalRooms: number;
  private isRoomCleared: boolean = false;
  private doorSprite: Phaser.GameObjects.Sprite | null = null;
  private doorText: Phaser.GameObjects.Text | null = null;
  private isTransitioning: boolean = false;

  // Endless mode state (always endless now)
  private endlessWave: number = 1;
  private endlessDifficultyMultiplier: number = 1.0;

  // Game state flags (set by GameScene)
  private isGameOver: boolean = false;

  // Event handlers
  private eventHandlers: RoomEventHandlers;

  // Gold tracking (shared with GameScene)
  private goldEarnedThisRoom: number = 0;

  constructor(config: RoomManagerConfig) {
    this.scene = config.scene;
    this.player = config.player;
    this.enemies = config.enemies;

    // Pools
    this.bulletPool = config.bulletPool;
    this.enemyBulletPool = config.enemyBulletPool;
    this.goldPool = config.goldPool;
    this.healthPool = config.healthPool;
    this.spiritCatPool = config.spiritCatPool;

    // Systems
    this.wallGroup = config.wallGroup;

    // Config - always 10 rooms per wave
    this.totalRooms = config.totalRooms;

    this.eventHandlers = config.eventHandlers;

    // Initialize enemy spawn manager
    this.enemySpawnManager = new EnemySpawnManager({
      scene: config.scene,
      player: config.player,
      enemies: config.enemies,
      enemyBulletPool: config.enemyBulletPool,
      bombPool: config.bombPool,
      roomGenerator: config.roomGenerator,
      wallGroup: config.wallGroup,
      runRng: config.runRng,
      difficultyConfig: config.difficultyConfig,
      eventHandlers: {
        onBossSpawned: config.eventHandlers.onBossSpawned,
        onShowBossHealth: config.eventHandlers.onShowBossHealth,
        onBombExplosion: config.eventHandlers.onBombExplosion,
      },
    });
  }

  // ========================================
  // State getters
  // ========================================

  getRoomNumber(): number {
    return this.currentRoom;
  }

  getTotalRooms(): number {
    return this.totalRooms;
  }

  isCleared(): boolean {
    return this.isRoomCleared;
  }

  isInTransition(): boolean {
    return this.isTransitioning;
  }

  getBoss(): Boss | null {
    return this.enemySpawnManager.getBoss();
  }

  getCurrentBossType(): BossType | null {
    return this.enemySpawnManager.getCurrentBossType();
  }

  getBossSpawnTime(): number {
    return this.enemySpawnManager.getBossSpawnTime();
  }

  getEndlessWave(): number {
    return this.endlessWave;
  }

  getEndlessDifficultyMultiplier(): number {
    return this.endlessDifficultyMultiplier;
  }

  getGoldEarnedThisRoom(): number {
    return this.goldEarnedThisRoom;
  }

  // ========================================
  // State setters
  // ========================================

  /**
   * Update game state flags from GameScene
   */
  setGameState(isGameOver: boolean, _isLevelingUp: boolean): void {
    this.isGameOver = isGameOver;
    // _isLevelingUp is passed for API consistency but not used by RoomManager
  }

  /**
   * Reset gold earned counter (called when gold is collected by GameScene)
   */
  resetGoldEarnedThisRoom(): void {
    this.goldEarnedThisRoom = 0;
  }

  /**
   * Clear boss reference (called when boss is killed)
   */
  clearBoss(): void {
    this.enemySpawnManager.clearBoss();
  }

  /**
   * Set transitioning state (for debug/reset level)
   */
  setTransitioning(value: boolean): void {
    this.isTransitioning = value;
  }

  /**
   * Set room cleared state (for debug/reset level)
   */
  setRoomCleared(value: boolean): void {
    this.isRoomCleared = value;
  }

  /**
   * Force transition to next room (for debug skip)
   */
  triggerTransitionToNextRoom(): void {
    this.transitionToNextRoom();
  }

  /**
   * Set room number directly (for respawn)
   */
  setRoomNumber(room: number): void {
    this.currentRoom = room;
  }

  /**
   * Set total rooms (for respawn with different wave counts)
   */
  setTotalRooms(total: number): void {
    this.totalRooms = total;
  }

  /**
   * Reset endless mode state (for respawn)
   */
  resetEndlessState(): void {
    this.endlessWave = 1;
    this.endlessDifficultyMultiplier = 1.0;
  }

  // ========================================
  // Room UI update
  // ========================================

  updateRoomUI(): void {
    // Always endless mode - pass wave number
    this.eventHandlers.onUpdateRoomUI(this.currentRoom, this.totalRooms, this.endlessWave);
  }

  // ========================================
  // Door management
  // ========================================

  spawnDoor(): void {
    if (this.doorSprite) return;

    const width = this.scene.cameras.main.width;

    // Create door at top center of the room
    const doorX = width / 2;
    const doorY = 70;

    // Create the door sprite directly (not in a container - containers break physics)
    // Portal image is 1408x768, scale to ~60px wide
    this.doorSprite = this.scene.add.sprite(doorX, doorY, "portal");
    const targetSize = 60;
    const scale = targetSize / this.doorSprite.width;
    this.doorSprite.setScale(scale);

    // Add physics body for collision detection
    this.scene.physics.add.existing(this.doorSprite, true); // static body
    const doorBody = this.doorSprite.body as Phaser.Physics.Arcade.StaticBody;
    // Set hitbox to match scaled size - offset to center the circle
    const hitboxRadius = 25;
    const offsetX = (this.doorSprite.width * scale) / 2 - hitboxRadius;
    const offsetY = (this.doorSprite.height * scale) / 2 - hitboxRadius;
    doorBody.setCircle(hitboxRadius, offsetX, offsetY);

    // Add overlap with player - this is the key collision
    this.scene.physics.add.overlap(
      this.player,
      this.doorSprite,
      this.enterDoor as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );

    // Add "ENTER" text below door
    this.doorText = this.scene.add
      .text(doorX, doorY + 45, "ENTER", {
        fontSize: "12px",
        color: "#00ff88",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Glow animation - pulse scale and alpha
    this.scene.tweens.add({
      targets: this.doorSprite,
      scale: { from: scale * 0.9, to: scale * 1.1 },
      alpha: { from: 0.8, to: 1 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Text pulse animation
    this.scene.tweens.add({
      targets: this.doorText,
      alpha: { from: 0.6, to: 1 },
      duration: 400,
      yoyo: true,
      repeat: -1,
    });

    console.log("Door spawned at", doorX, doorY);
  }

  enterDoor(): void {
    if (this.isTransitioning || this.isGameOver) return;

    this.isTransitioning = true;
    console.log("Entering door to room", this.currentRoom + 1);

    // Fade out
    this.scene.cameras.main.fadeOut(300, 0, 0, 0);

    this.scene.time.delayedCall(300, () => {
      this.transitionToNextRoom();
    });
  }

  // ========================================
  // Room transitions
  // ========================================

  private transitionToNextRoom(): void {
    this.currentRoom++;

    // Check for wave completion - always endless mode
    if (this.currentRoom > this.totalRooms) {
      this.startNextEndlessWave();
      return;
    }

    // Clean up current room
    this.cleanupRoom();

    // Spawn new enemies
    this.spawnEnemiesForRoom();

    // Reset room state
    this.isRoomCleared = false;
    this.isTransitioning = false;

    // Update UI
    this.updateRoomUI();

    // Notify handlers
    this.eventHandlers.onRoomEntered(this.currentRoom, this.endlessWave);

    // Fade back in
    this.scene.cameras.main.fadeIn(300, 0, 0, 0);

    console.log("Entered room", this.currentRoom);
  }

  /**
   * Start the next wave in endless mode
   * Increases difficulty, resets room counter, and updates chapter based on wave
   */
  private startNextEndlessWave(): void {
    this.endlessWave++;
    this.currentRoom = 1;

    // Exponential scaling: difficulty increases 1.5x each wave
    this.endlessDifficultyMultiplier = Math.pow(1.5, this.endlessWave - 1);

    // Update chapter based on wave number for progressive difficulty
    const newChapter = getChapterForWave(this.endlessWave);
    const currentChapter = chapterManager.getSelectedChapter();
    if (newChapter !== currentChapter) {
      chapterManager.selectChapter(newChapter);
      console.log(`Endless Mode: Chapter advanced to ${newChapter} at wave ${this.endlessWave}`);
      // Notify to update background and other chapter-specific elements
      this.eventHandlers.onChapterChanged(newChapter);
    }

    // Clean up current room
    this.cleanupRoom();

    // Show wave notification
    this.showEndlessWaveNotification();

    // Spawn new enemies with increased difficulty
    this.spawnEnemiesForRoom();

    // Reset room state
    this.isRoomCleared = false;
    this.isTransitioning = false;

    // Update UI
    this.updateRoomUI();

    // Notify handlers
    this.eventHandlers.onRoomEntered(this.currentRoom, this.endlessWave);

    // Fade back in
    this.scene.cameras.main.fadeIn(300, 0, 0, 0);

    console.log(
      `Endless Mode: Starting Wave ${this.endlessWave} (difficulty x${this.endlessDifficultyMultiplier.toFixed(2)})`,
    );
  }

  /**
   * Show wave notification in endless mode
   */
  private showEndlessWaveNotification(): void {
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;

    // Wave text
    const waveText = this.scene.add.text(width / 2, height / 2 - 50, `WAVE ${this.endlessWave}`, {
      fontSize: "48px",
      color: "#ffdd00",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 6,
    });
    waveText.setOrigin(0.5);
    waveText.setDepth(100);

    // Difficulty text
    const diffText = this.scene.add.text(
      width / 2,
      height / 2 + 10,
      `Difficulty x${this.endlessDifficultyMultiplier.toFixed(1)}`,
      {
        fontSize: "20px",
        color: "#ff6666",
        stroke: "#000000",
        strokeThickness: 3,
      },
    );
    diffText.setOrigin(0.5);
    diffText.setDepth(100);

    // Animate and destroy
    this.scene.tweens.add({
      targets: [waveText, diffText],
      alpha: 0,
      y: "-=30",
      duration: 1500,
      delay: 1000,
      ease: "Power2",
      onComplete: () => {
        waveText.destroy();
        diffText.destroy();
      },
    });
  }

  // ========================================
  // Room cleanup
  // ========================================

  cleanupRoom(): void {
    // Destroy door
    if (this.doorSprite) {
      this.doorSprite.destroy();
      this.doorSprite = null;
    }
    if (this.doorText) {
      this.doorText.destroy();
      this.doorText = null;
    }

    this.enemySpawnManager.cancelWaveTimers();
    this.enemySpawnManager.clearBoss();

    // Reset boss health UI
    this.eventHandlers.onHideBossHealth();

    // Destroy all enemies
    this.enemies.clear(true, true);

    // Clear all bullets
    this.bulletPool.clear(true, true);
    this.enemyBulletPool.clear(true, true);

    // Clear spirit cats
    if (this.spiritCatPool) {
      this.spiritCatPool.clear(true, true);
    }

    // Clear any remaining gold pickups (they stay collected in goldEarned)
    this.goldPool.cleanup();

    // Clear walls from previous room
    this.wallGroup.clearWalls();

    // Reset player position
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;
    this.player.setPosition(width / 2, height - 100);
    this.player.setVelocity(0, 0);
  }

  // ========================================
  // Room clearing check
  // ========================================

  checkRoomCleared(): void {
    if (this.isRoomCleared) return;

    const enemyCount = this.enemies.getChildren().filter((e) => e.active).length;
    const pendingSpawns = this.enemySpawnManager.getPendingSpawnCount();
    if (enemyCount === 0 && pendingSpawns === 0) {
      this.isRoomCleared = true;
      audioManager.playRoomClear();
      console.log("Room", this.currentRoom, "cleared!");

      // Clear enemy bullets immediately when room is cleared
      // This prevents bullets from getting stuck on screen during the transition
      this.enemyBulletPool.clear(true, true);

      // Notify chapter manager that room was cleared
      chapterManager.clearRoom();

      // Magnetically collect all remaining gold and health pickups
      const collectedGold = this.goldPool.collectAll(this.player.x, this.player.y);
      if (collectedGold > 0) {
        this.goldEarnedThisRoom += collectedGold;
        currencyManager.add("gold", collectedGold);
        saveManager.addGold(collectedGold);
      }
      this.healthPool.collectAll(this.player.x, this.player.y, (healAmount) => {
        this.player.heal(healAmount);
      });

      // Notify handlers with collected gold amount
      this.eventHandlers.onRoomCleared(this.currentRoom, this.goldEarnedThisRoom);

      // Show door OR auto-advance after brief delay
      this.scene.time.delayedCall(500, () => {
        if (!this.isGameOver) {
          if (saveManager.getAutoRoomAdvance()) {
            this.enterDoor();
          } else {
            this.spawnDoor();
          }
        }
      });
    }
  }

  // ========================================
  // Enemy spawning (delegated to EnemySpawnManager)
  // ========================================

  spawnEnemiesForRoom(): void {
    // Always endless mode with progressive difficulty
    this.enemySpawnManager.setEndlessMode(true, this.endlessWave, this.endlessDifficultyMultiplier);
    this.enemySpawnManager.spawnEnemiesForRoom(this.currentRoom, this.totalRooms);
  }

  /**
   * Spawn a minion enemy at the given position (used by bosses that summon minions)
   * Minions are weaker versions of regular enemies
   */
  spawnMinion(x: number, y: number): void {
    this.enemySpawnManager.spawnMinion(x, y, this.currentRoom);
  }

  // ========================================
  // Cleanup
  // ========================================

  /**
   * Clean up all resources when scene is shutting down
   */
  destroy(): void {
    this.enemySpawnManager.destroy();

    if (this.doorSprite) {
      this.doorSprite.destroy();
      this.doorSprite = null;
    }

    if (this.doorText) {
      this.doorText.destroy();
      this.doorText = null;
    }
  }
}

export default RoomManager;
