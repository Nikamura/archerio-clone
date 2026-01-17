import Phaser from "phaser";
import Player from "../../entities/Player";
import Enemy, { EnemyOptions } from "../../entities/Enemy";
import {
  RangedShooterEnemy,
  SpreaderEnemy,
  BomberEnemy,
  TankEnemy,
  ChargerEnemy,
  HealerEnemy,
  SpawnerEnemy,
} from "../../entities/enemies";
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
import {
  getChapterDefinition,
  getRandomBossForChapter,
  getRandomMiniBossForChapter,
  getEnemyModifiers,
  getRoomProgressionScaling,
  STANDARD_ROOM_LAYOUT,
  type BossType,
  type ChapterId,
  type EnemyType as ChapterEnemyType,
} from "../../config/chapterData";
import { BossId, getBossDefinition } from "../../config/bossData";
import type { DifficultyConfig } from "../../config/difficulty";
import { THEME_COLORS } from "../../config/themeData";
import {
  createBoss,
  getBossDisplaySize,
  getBossHitboxRadius,
} from "../../entities/bosses/BossFactory";
import BaseBoss from "../../entities/bosses/BaseBoss";
import type { RoomGenerator, GeneratedRoom, SpawnPosition } from "../../systems/RoomGenerator";
import type WallGroup from "../../systems/WallGroup";
import type { SeededRandom } from "../../systems/SeededRandom";

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

  // Config
  isEndlessMode: boolean;
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
  private bombPool: BombPool;
  private goldPool: GoldPool;
  private healthPool: HealthPool;
  private spiritCatPool: SpiritCatPool | null;

  // Systems
  private roomGenerator: RoomGenerator;
  private wallGroup: WallGroup;
  private runRng: SeededRandom;
  private difficultyConfig: DifficultyConfig;

  // Room state
  private currentRoom: number = 1;
  private totalRooms: number;
  private isRoomCleared: boolean = false;
  private doorSprite: Phaser.GameObjects.Sprite | null = null;
  private doorText: Phaser.GameObjects.Text | null = null;
  private isTransitioning: boolean = false;

  // Boss state
  private boss: Boss | null = null;
  private currentBossType: BossType | null = null;
  private bossSpawnTime: number = 0;

  // Endless mode state
  private isEndlessMode: boolean;
  private endlessWave: number = 1;
  private endlessDifficultyMultiplier: number = 1.0;

  // Enemy spawning state
  private currentGeneratedRoom: GeneratedRoom | null = null;
  private pendingEnemySpawns: number = 0;
  private activeWaveTimers: Phaser.Time.TimerEvent[] = [];

  // Game state flags (set by GameScene)
  private isGameOver: boolean = false;

  // Door spawn configuration
  private readonly DOOR_SPAWN_CHANCE = 1.0;
  private readonly DOOR_SPAWN_Y = -30;
  private readonly STATIONARY_ENEMY_TYPES: string[] = ["spreader", "spawner"];

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
    this.bombPool = config.bombPool;
    this.goldPool = config.goldPool;
    this.healthPool = config.healthPool;
    this.spiritCatPool = config.spiritCatPool;

    // Systems
    this.roomGenerator = config.roomGenerator;
    this.wallGroup = config.wallGroup;
    this.runRng = config.runRng;
    this.difficultyConfig = config.difficultyConfig;

    // Config
    this.isEndlessMode = config.isEndlessMode;
    this.totalRooms = config.totalRooms;

    this.eventHandlers = config.eventHandlers;
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
    return this.boss;
  }

  getCurrentBossType(): BossType | null {
    return this.currentBossType;
  }

  getBossSpawnTime(): number {
    return this.bossSpawnTime;
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
    this.boss = null;
    this.currentBossType = null;
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
    if (this.isEndlessMode) {
      this.eventHandlers.onUpdateRoomUI(this.currentRoom, this.totalRooms, this.endlessWave);
    } else {
      this.eventHandlers.onUpdateRoomUI(this.currentRoom, this.totalRooms);
    }
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

    // Check for victory or wave completion
    if (this.currentRoom > this.totalRooms) {
      if (this.isEndlessMode) {
        // Endless mode: Start next wave with increased difficulty
        this.startNextEndlessWave();
        return;
      } else {
        this.eventHandlers.onVictory();
        return;
      }
    }

    // Notify chapter manager of room advancement (only in normal mode)
    if (!this.isEndlessMode) {
      const advanced = chapterManager.advanceRoom();
      if (!advanced) {
        console.warn("RoomManager: Failed to advance room in chapter manager");
      }
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
    this.eventHandlers.onRoomEntered(
      this.currentRoom,
      this.isEndlessMode ? this.endlessWave : undefined,
    );

    // Fade back in
    this.scene.cameras.main.fadeIn(300, 0, 0, 0);

    console.log("Entered room", this.currentRoom);
  }

  /**
   * Start the next wave in endless mode
   * Increases difficulty and resets room counter
   */
  private startNextEndlessWave(): void {
    this.endlessWave++;
    this.currentRoom = 1;

    // Exponential scaling: difficulty increases 1.5x each wave
    this.endlessDifficultyMultiplier = Math.pow(1.5, this.endlessWave - 1);

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

    this.cancelWaveTimers();
    this.pendingEnemySpawns = 0;

    // Reset boss state
    this.boss = null;
    this.currentBossType = null;
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

  cancelWaveTimers(): void {
    this.activeWaveTimers.forEach((timer) => timer.remove(false));
    this.activeWaveTimers = [];
  }

  // ========================================
  // Room clearing check
  // ========================================

  checkRoomCleared(): void {
    if (this.isRoomCleared) return;

    const enemyCount = this.enemies.getChildren().filter((e) => e.active).length;
    if (enemyCount === 0 && this.pendingEnemySpawns === 0) {
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
  // Enemy spawning
  // ========================================

  spawnEnemiesForRoom(): void {
    // Room 20 is the final boss room
    if (this.currentRoom === this.totalRooms) {
      this.spawnBoss();
      return;
    }

    // Room 10 is the mini-boss room - spawn an actual boss with reduced stats
    if (STANDARD_ROOM_LAYOUT.miniBossRooms.includes(this.currentRoom)) {
      this.spawnMiniBoss();
      return;
    }

    this.cancelWaveTimers();
    this.pendingEnemySpawns = 0;

    // Get current chapter and its configuration
    const selectedChapter = chapterManager.getSelectedChapter() as ChapterId;
    const chapterDef = getChapterDefinition(selectedChapter);

    // Calculate base enemy count (scales with room number and difficulty)
    // In endless mode, increase enemy count by 50% per wave
    const waveEnemyMultiplier = this.isEndlessMode ? 1 + (this.endlessWave - 1) * 0.5 : 1;
    const baseEnemies = Math.round(4 * waveEnemyMultiplier);
    const scaledBase =
      Math.round(baseEnemies * this.difficultyConfig.enemySpawnMultiplier) +
      this.difficultyConfig.extraEnemyCount;

    // Use the RoomGenerator to create a procedurally generated room
    this.currentGeneratedRoom = this.roomGenerator.generateRoom(
      selectedChapter,
      this.currentRoom,
      this.player.x,
      this.player.y,
      scaledBase,
      chapterDef.scaling.extraEnemiesPerRoom,
    );

    // Log room generation details for debugging
    const layoutName = this.currentGeneratedRoom.layout.name;
    const comboName = this.currentGeneratedRoom.combination?.name || "Random Mix";
    console.log(
      `Room ${this.currentRoom}: Layout "${layoutName}", Combo "${comboName}", Enemies: ${this.currentGeneratedRoom.enemySpawns.length}`,
    );

    // Spawn enemies using the generated positions
    this.spawnEnemiesFromGeneration(this.currentGeneratedRoom);
  }

  /**
   * Spawn enemies using positions from the room generator
   */
  private spawnEnemiesFromGeneration(generatedRoom: GeneratedRoom): void {
    // Create enemy textures first (if needed)
    if (!this.scene.textures.exists("enemy")) {
      const graphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
      graphics.fillStyle(0xff4444, 1);
      graphics.fillCircle(0, 0, 15);
      graphics.generateTexture("enemy", 30, 30);
      graphics.destroy();
    }

    // Spawn walls for this room layout
    if (generatedRoom.layout.walls && generatedRoom.layout.walls.length > 0) {
      this.wallGroup.createWalls(generatedRoom.layout.walls);
      console.log(`Room ${this.currentRoom}: Created ${generatedRoom.layout.walls.length} walls`);
    } else {
      this.wallGroup.clearWalls();
    }

    // Get chapter for enemy modifiers
    const selectedChapter = chapterManager.getSelectedChapter() as ChapterId;
    const chapterDef = getChapterDefinition(selectedChapter);

    this.pendingEnemySpawns = generatedRoom.enemySpawns.length;
    if (this.pendingEnemySpawns === 0) {
      console.log(`Room ${this.currentRoom}: No enemies to spawn`);
      return;
    }

    const totalSpawns = generatedRoom.enemySpawns.length;
    const waveCount = totalSpawns <= 6 ? 2 : 3;
    const chunkSize = Math.ceil(totalSpawns / waveCount);
    const waveDelay = 1500; // ms between waves

    // Pre-determine which enemies will spawn from the top (for deterministic runs)
    // Skip stationary enemies (spreader, spawner) - they don't move toward player
    const topSpawnFlags: boolean[] = generatedRoom.enemySpawns.map((spawn) => {
      const isStationary = this.STATIONARY_ENEMY_TYPES.includes(spawn.enemyType);
      if (isStationary) return false;
      return this.runRng.random() < this.DOOR_SPAWN_CHANCE;
    });
    const topSpawnCount = topSpawnFlags.filter(Boolean).length;

    for (let i = 0; i < waveCount; i++) {
      const startIdx = i * chunkSize;
      const waveSpawns = generatedRoom.enemySpawns.slice(startIdx, (i + 1) * chunkSize);
      const waveTopFlags = topSpawnFlags.slice(startIdx, (i + 1) * chunkSize);
      if (waveSpawns.length === 0) continue;

      const delay = i === 0 ? 0 : waveDelay * i;
      const timer = this.scene.time.delayedCall(delay, () => {
        waveSpawns.forEach((spawn, index) => {
          // Get chapter-specific modifiers for this enemy type
          const chapterModifiers = getEnemyModifiers(
            selectedChapter,
            spawn.enemyType as ChapterEnemyType,
          );

          // Apply endless mode difficulty multiplier
          const endlessMult = this.isEndlessMode ? this.endlessDifficultyMultiplier : 1.0;

          // Apply progressive room scaling (enemies get stronger in later rooms)
          const roomScaling = getRoomProgressionScaling(this.currentRoom);

          // Combine difficulty config with chapter modifiers, chapter scaling, and room progression
          const enemyOptions = {
            healthMultiplier:
              this.difficultyConfig.enemyHealthMultiplier *
              chapterDef.scaling.enemyHpMultiplier *
              endlessMult *
              roomScaling.hpMultiplier,
            damageMultiplier:
              this.difficultyConfig.enemyDamageMultiplier *
              chapterDef.scaling.enemyDamageMultiplier *
              endlessMult *
              roomScaling.damageMultiplier,
            speedMultiplier:
              (chapterModifiers.speedMultiplier ?? 1) * (1 + (endlessMult - 1) * 0.5), // Speed scales less aggressively
            attackCooldownMultiplier:
              (chapterModifiers.attackCooldownMultiplier ?? 1) / (1 + (endlessMult - 1) * 0.3), // Faster attacks
            projectileSpeedMultiplier:
              (chapterModifiers.projectileSpeedMultiplier ?? 1) * (1 + (endlessMult - 1) * 0.3),
            abilityIntensityMultiplier: chapterModifiers.abilityIntensityMultiplier,
          };

          // Determine if this enemy spawns from the top of screen
          const spawnFromTop = waveTopFlags[index] ?? false;

          this.spawnEnemyFromPosition(spawn, enemyOptions, spawnFromTop);
          this.pendingEnemySpawns = Math.max(0, this.pendingEnemySpawns - 1);
        });
        this.checkRoomCleared();
      });

      this.activeWaveTimers.push(timer);
    }

    console.log(
      `Room ${this.currentRoom}: Scheduled ${totalSpawns} enemies (${topSpawnCount} from top) across ${waveCount} waves`,
    );
  }

  private spawnEnemyFromPosition(
    spawn: SpawnPosition,
    enemyOptions: EnemyOptions,
    spawnFromTop: boolean = false,
  ): void {
    const { x, y, enemyType } = spawn;

    // Determine spawn position
    // If spawning from top, use a random X position and spawn above screen
    // Enemy AI will naturally move them toward the player
    const width = this.scene.cameras.main.width;
    const margin = 50;
    const spawnX = spawnFromTop ? margin + this.runRng.random() * (width - margin * 2) : x;
    const spawnY = spawnFromTop ? this.DOOR_SPAWN_Y : y;

    let enemy: Enemy;

    // Include enemyType in options for kill tracking
    const optionsWithType: EnemyOptions = { ...enemyOptions, enemyType };

    switch (enemyType) {
      case "ranged":
        enemy = new RangedShooterEnemy(
          this.scene,
          spawnX,
          spawnY,
          this.enemyBulletPool,
          optionsWithType,
        );
        break;
      case "spreader":
        enemy = new SpreaderEnemy(
          this.scene,
          spawnX,
          spawnY,
          this.enemyBulletPool,
          optionsWithType,
        );
        break;
      case "bomber":
        enemy = new BomberEnemy(
          this.scene,
          spawnX,
          spawnY,
          this.bombPool,
          optionsWithType,
          (bx, by, radius, damage) => this.eventHandlers.onBombExplosion(bx, by, radius, damage),
        );
        break;
      case "tank":
        enemy = new TankEnemy(this.scene, spawnX, spawnY, this.enemyBulletPool, optionsWithType);
        break;
      case "charger":
        enemy = new ChargerEnemy(this.scene, spawnX, spawnY, optionsWithType);
        break;
      case "healer":
        enemy = new HealerEnemy(this.scene, spawnX, spawnY, optionsWithType);
        break;
      case "spawner":
        enemy = new SpawnerEnemy(this.scene, spawnX, spawnY, optionsWithType);
        break;
      default:
        enemy = new Enemy(this.scene, spawnX, spawnY, optionsWithType);
    }

    this.scene.add.existing(enemy);
    this.scene.physics.add.existing(enemy);

    // Set enemy group reference for healer and spawner enemies
    if (enemy instanceof HealerEnemy) {
      enemy.setEnemyGroup(this.enemies);
    }
    if (enemy instanceof SpawnerEnemy) {
      enemy.setEnemyGroup(this.enemies);
    }

    // Set wall group for all enemies (for wall avoidance pathfinding)
    enemy.setWallGroup(this.wallGroup);

    // Set up physics body with centered circular hitbox
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    if (body) {
      const displaySize = enemy.displayWidth;
      const radius = Math.floor(displaySize * 0.4);
      const offset = (displaySize - radius * 2) / 2;
      body.setSize(displaySize, displaySize);
      body.setCircle(radius, offset, offset);
      // Don't collide with world bounds if spawning from top - let them walk in
      body.setCollideWorldBounds(!spawnFromTop);
    }

    this.enemies.add(enemy);

    // If spawning from top, enable world bounds collision after they enter the screen
    if (spawnFromTop) {
      this.enableWorldBoundsWhenOnScreen(enemy);
    }
  }

  /**
   * Enable world bounds collision once enemy enters the visible screen area
   */
  private enableWorldBoundsWhenOnScreen(enemy: Enemy): void {
    const checkInterval = this.scene.time.addEvent({
      delay: 100,
      callback: () => {
        if (!enemy.active) {
          checkInterval.remove();
          return;
        }
        // Once enemy is on screen, enable world bounds
        if (enemy.y > 0) {
          const body = enemy.body as Phaser.Physics.Arcade.Body;
          if (body) {
            body.setCollideWorldBounds(true);
          }
          checkInterval.remove();
        }
      },
      loop: true,
    });
  }

  /**
   * Spawn a minion enemy at the given position (used by bosses that summon minions)
   * Minions are weaker versions of regular enemies
   */
  spawnMinion(x: number, y: number): void {
    // Use the existing enemy spawning infrastructure
    const selectedChapter = chapterManager.getSelectedChapter() as ChapterId;
    const chapterDef = getChapterDefinition(selectedChapter);
    const roomScaling = getRoomProgressionScaling(this.currentRoom);

    // Minions are weaker than regular enemies (40% HP, 60% damage)
    const minionOptions: EnemyOptions = {
      healthMultiplier:
        this.difficultyConfig.enemyHealthMultiplier *
        chapterDef.scaling.enemyHpMultiplier *
        roomScaling.hpMultiplier *
        0.4,
      damageMultiplier:
        this.difficultyConfig.enemyDamageMultiplier *
        chapterDef.scaling.enemyDamageMultiplier *
        roomScaling.damageMultiplier *
        0.6,
      speedMultiplier: 1.3, // Minions are faster
      enemyType: "charger",
    };

    // Spawn using existing method (charger type at specific position)
    this.spawnEnemyFromPosition({ x, y, enemyType: "charger" }, minionOptions, false);
  }

  // ========================================
  // Boss spawning
  // ========================================

  private spawnBoss(): void {
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;

    // Spawn boss at center-top of screen
    const bossX = width / 2;
    const bossY = height / 3;

    // Get current chapter and select a boss from its pool (using seeded RNG)
    const selectedChapter = chapterManager.getSelectedChapter() as ChapterId;
    const bossType: BossType = getRandomBossForChapter(selectedChapter, this.runRng);

    // Difficulty modifiers for boss (combine difficulty config with chapter scaling)
    const chapterDef = getChapterDefinition(selectedChapter);
    // Apply endless mode difficulty multiplier to boss
    const endlessMult = this.isEndlessMode ? this.endlessDifficultyMultiplier : 1.0;
    // Apply progressive room scaling (room 20 boss is tougher than earlier enemies)
    const roomScaling = getRoomProgressionScaling(this.currentRoom);
    const bossOptions = {
      healthMultiplier:
        this.difficultyConfig.bossHealthMultiplier *
        chapterDef.scaling.bossHpMultiplier *
        endlessMult *
        roomScaling.hpMultiplier,
      damageMultiplier:
        this.difficultyConfig.bossDamageMultiplier *
        chapterDef.scaling.bossDamageMultiplier *
        endlessMult *
        roomScaling.damageMultiplier,
    };

    // Create the appropriate boss using the factory
    const newBoss = createBoss(
      this.scene,
      bossX,
      bossY,
      bossType,
      this.enemyBulletPool,
      bossOptions,
    );
    this.boss = newBoss as Boss; // Type assertion for compatibility
    this.currentBossType = bossType; // Store for kill tracking
    this.bossSpawnTime = Date.now(); // Track spawn time for kill time metrics
    this.scene.add.existing(this.boss);
    this.scene.physics.add.existing(this.boss);

    // Set up physics body for boss with centered circular hitbox
    const body = this.boss.body as Phaser.Physics.Arcade.Body;
    if (body) {
      const displaySize = getBossDisplaySize(bossType);
      const radius = getBossHitboxRadius(bossType);
      const offset = (displaySize - radius * 2) / 2;
      body.setSize(displaySize, displaySize);
      body.setCircle(radius, offset, offset);
      body.setCollideWorldBounds(true);
    }

    this.enemies.add(this.boss);

    // Set up minion spawn callback only for bosses that need it
    if (newBoss instanceof BaseBoss && newBoss.needsMinionSpawnCallback()) {
      newBoss.setMinionSpawnCallback((x, y) => this.spawnMinion(x, y));
    }

    // Show dramatic boss name announcement
    this.showBossNameAnnouncement(bossType, false);

    // Get boss name for UI
    const bossDef = getBossDefinition(bossType as BossId);
    const bossName = bossDef?.name || bossType.replace(/_/g, " ");

    // Notify handlers
    this.eventHandlers.onBossSpawned(this.boss, bossType, bossName);
    this.eventHandlers.onShowBossHealth(this.boss.getHealth(), this.boss.getMaxHealth(), bossName);

    console.log(`Boss spawned: ${bossType} for chapter ${selectedChapter} at ${bossX}, ${bossY}`);
  }

  private spawnMiniBoss(): void {
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;

    // Spawn mini-boss at center-top of screen (same as boss)
    const bossX = width / 2;
    const bossY = height / 3;

    // Get current chapter and select a mini-boss from its pool
    const selectedChapter = chapterManager.getSelectedChapter() as ChapterId;
    const miniBossType: BossType = getRandomMiniBossForChapter(selectedChapter, this.runRng);

    // Mini-boss has reduced stats compared to final boss (50% health, 60% damage)
    const chapterDef = getChapterDefinition(selectedChapter);
    const endlessMult = this.isEndlessMode ? this.endlessDifficultyMultiplier : 1.0;
    // Apply progressive room scaling (room 10 mini-boss)
    const roomScaling = getRoomProgressionScaling(this.currentRoom);
    const miniBossOptions = {
      healthMultiplier:
        this.difficultyConfig.bossHealthMultiplier *
        chapterDef.scaling.bossHpMultiplier *
        endlessMult *
        roomScaling.hpMultiplier *
        0.5,
      damageMultiplier:
        this.difficultyConfig.bossDamageMultiplier *
        chapterDef.scaling.bossDamageMultiplier *
        endlessMult *
        roomScaling.damageMultiplier *
        0.6,
    };

    // Create the mini-boss using the factory
    const newMiniBoss = createBoss(
      this.scene,
      bossX,
      bossY,
      miniBossType,
      this.enemyBulletPool,
      miniBossOptions,
    );
    this.boss = newMiniBoss as Boss; // Type assertion for compatibility
    this.currentBossType = miniBossType; // Store for kill tracking
    this.bossSpawnTime = Date.now(); // Track spawn time for kill time metrics
    this.scene.add.existing(this.boss);
    this.scene.physics.add.existing(this.boss);

    // Set up physics body with centered circular hitbox (slightly smaller than full boss)
    const body = this.boss.body as Phaser.Physics.Arcade.Body;
    if (body) {
      const displaySize = getBossDisplaySize(miniBossType) * 0.85; // Slightly smaller
      const radius = getBossHitboxRadius(miniBossType) * 0.85;
      const offset = (displaySize - radius * 2) / 2;
      body.setSize(displaySize, displaySize);
      body.setCircle(radius, offset, offset);
      body.setCollideWorldBounds(true);
    }

    // Scale down the visual slightly to indicate mini-boss
    this.boss.setScale(0.85);

    this.enemies.add(this.boss);

    // Set up minion spawn callback only for bosses that need it
    if (newMiniBoss instanceof BaseBoss && newMiniBoss.needsMinionSpawnCallback()) {
      newMiniBoss.setMinionSpawnCallback((x, y) => this.spawnMinion(x, y));
    }

    // Show dramatic mini-boss name announcement
    this.showBossNameAnnouncement(miniBossType, true);

    // Get boss name for UI
    const miniBossDef = getBossDefinition(miniBossType as BossId);
    const miniBossName = miniBossDef?.name || miniBossType.replace(/_/g, " ");

    // Notify handlers
    this.eventHandlers.onBossSpawned(this.boss, miniBossType, miniBossName);
    this.eventHandlers.onShowBossHealth(
      this.boss.getHealth(),
      this.boss.getMaxHealth(),
      miniBossName,
    );

    console.log(
      `Mini-boss spawned: ${miniBossType} for chapter ${selectedChapter} at ${bossX}, ${bossY}`,
    );
  }

  /**
   * Display a dramatic boss name announcement before the fight
   */
  private showBossNameAnnouncement(bossType: BossType, isMiniBoss: boolean = false): void {
    const bossDef = getBossDefinition(bossType as BossId);
    const bossName = bossDef?.name || bossType.replace(/_/g, " ").toUpperCase();

    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;

    // Get colors for boss name
    const colors = THEME_COLORS;

    // Create container for the announcement
    const container = this.scene.add.container(width / 2, height / 2 - 40);
    container.setDepth(200);

    // "MINI-BOSS" or "BOSS" label above the name
    const labelText = isMiniBoss ? "MINI-BOSS" : "BOSS";
    const label = this.scene.add.text(0, -35, labelText, {
      fontSize: "16px",
      fontFamily: '"Times New Roman", Georgia, serif',
      color: colors.bossNameSecondary,
      fontStyle: "italic",
      letterSpacing: 8,
    });
    label.setOrigin(0.5, 0.5);
    label.setStroke(colors.bossNameStroke, 2);
    label.setAlpha(0);
    container.add(label);

    // Main boss name in pompous font
    const nameText = this.scene.add.text(0, 10, bossName.toUpperCase(), {
      fontSize: isMiniBoss ? "28px" : "36px",
      fontFamily: '"Times New Roman", Georgia, serif',
      color: colors.bossNamePrimary,
      fontStyle: "bold",
      letterSpacing: 4,
    });
    nameText.setOrigin(0.5, 0.5);
    nameText.setStroke(colors.bossNameStroke, 4);
    nameText.setShadow(2, 2, colors.bossNameSecondary, 8, true, true);
    nameText.setAlpha(0);
    nameText.setScale(0.5);
    container.add(nameText);

    // Decorative lines on sides
    const lineLength = Math.min(nameText.width + 40, width - 60);
    const lineY = 45;

    const leftLine = this.scene.add.graphics();
    leftLine.lineStyle(2, Phaser.Display.Color.HexStringToColor(colors.bossNameSecondary).color);
    leftLine.lineBetween(-lineLength / 2, lineY, -20, lineY);
    leftLine.setAlpha(0);
    container.add(leftLine);

    const rightLine = this.scene.add.graphics();
    rightLine.lineStyle(2, Phaser.Display.Color.HexStringToColor(colors.bossNameSecondary).color);
    rightLine.lineBetween(20, lineY, lineLength / 2, lineY);
    rightLine.setAlpha(0);
    container.add(rightLine);

    // Animate in with dramatic effect
    this.scene.tweens.add({
      targets: label,
      alpha: 1,
      duration: 400,
      ease: "Power2",
    });

    this.scene.tweens.add({
      targets: nameText,
      alpha: 1,
      scale: 1,
      duration: 600,
      ease: "Back.easeOut",
      delay: 200,
    });

    this.scene.tweens.add({
      targets: [leftLine, rightLine],
      alpha: 1,
      duration: 400,
      delay: 500,
    });

    // Subtle pulse effect on the name
    this.scene.tweens.add({
      targets: nameText,
      scale: 1.05,
      duration: 800,
      yoyo: true,
      repeat: 1,
      delay: 800,
      ease: "Sine.easeInOut",
    });

    // Fade out after display
    this.scene.time.delayedCall(2500, () => {
      this.scene.tweens.add({
        targets: container,
        alpha: 0,
        y: height / 2 - 60,
        duration: 500,
        ease: "Power2",
        onComplete: () => {
          container.destroy();
        },
      });
    });
  }

  // ========================================
  // Cleanup
  // ========================================

  /**
   * Clean up all resources when scene is shutting down
   */
  destroy(): void {
    this.cancelWaveTimers();

    if (this.doorSprite) {
      this.doorSprite.destroy();
      this.doorSprite = null;
    }

    if (this.doorText) {
      this.doorText.destroy();
      this.doorText = null;
    }

    this.boss = null;
    this.currentBossType = null;
    this.currentGeneratedRoom = null;
  }
}

export default RoomManager;
