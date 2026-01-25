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
import EnemyBulletPool from "../../systems/EnemyBulletPool";
import BombPool from "../../systems/BombPool";
import { chapterManager } from "../../systems/ChapterManager";
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
 * Event handlers interface for EnemySpawnManager callbacks
 */
export interface EnemySpawnEventHandlers {
  onBossSpawned: (boss: Boss, bossType: BossType, bossName: string) => void;
  onShowBossHealth: (health: number, maxHealth: number, name: string) => void;
  onBombExplosion: (x: number, y: number, radius: number, damage: number) => void;
}

/**
 * Configuration for EnemySpawnManager initialization
 */
export interface EnemySpawnManagerConfig {
  scene: Phaser.Scene;
  player: Player;
  enemies: Phaser.Physics.Arcade.Group;
  enemyBulletPool: EnemyBulletPool;
  bombPool: BombPool;
  roomGenerator: RoomGenerator;
  wallGroup: WallGroup;
  runRng: SeededRandom;
  difficultyConfig: DifficultyConfig;
  eventHandlers: EnemySpawnEventHandlers;
}

/**
 * EnemySpawnManager - Handles all enemy spawning logic
 *
 * Extracted from RoomManager to provide focused enemy spawning functionality.
 * Manages regular enemy spawning, boss spawning, mini-boss spawning, and minion spawning.
 */
export class EnemySpawnManager {
  private scene: Phaser.Scene;
  private player: Player;
  private enemies: Phaser.Physics.Arcade.Group;
  private enemyBulletPool: EnemyBulletPool;
  private bombPool: BombPool;
  private roomGenerator: RoomGenerator;
  private wallGroup: WallGroup;
  private runRng: SeededRandom;
  private difficultyConfig: DifficultyConfig;
  private eventHandlers: EnemySpawnEventHandlers;

  // Boss state
  private boss: Boss | null = null;
  private currentBossType: BossType | null = null;
  private bossSpawnTime: number = 0;

  // Enemy spawning state
  private currentGeneratedRoom: GeneratedRoom | null = null;
  private pendingEnemySpawns: number = 0;
  private activeWaveTimers: Phaser.Time.TimerEvent[] = [];

  // Endless mode state (set by RoomManager)
  private isEndlessMode: boolean = false;
  private endlessWave: number = 1;
  private endlessDifficultyMultiplier: number = 1.0;

  // Door spawn configuration
  private readonly DOOR_SPAWN_CHANCE = 1.0;
  private readonly DOOR_SPAWN_Y = -30;
  private readonly STATIONARY_ENEMY_TYPES: string[] = ["spreader", "spawner"];

  constructor(config: EnemySpawnManagerConfig) {
    this.scene = config.scene;
    this.player = config.player;
    this.enemies = config.enemies;
    this.enemyBulletPool = config.enemyBulletPool;
    this.bombPool = config.bombPool;
    this.roomGenerator = config.roomGenerator;
    this.wallGroup = config.wallGroup;
    this.runRng = config.runRng;
    this.difficultyConfig = config.difficultyConfig;
    this.eventHandlers = config.eventHandlers;
  }

  // ========================================
  // State getters
  // ========================================

  getPendingSpawnCount(): number {
    return this.pendingEnemySpawns;
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

  // ========================================
  // State setters
  // ========================================

  /**
   * Set endless mode state from RoomManager
   */
  setEndlessMode(isEndless: boolean, wave: number, multiplier: number): void {
    this.isEndlessMode = isEndless;
    this.endlessWave = wave;
    this.endlessDifficultyMultiplier = multiplier;
  }

  /**
   * Clear boss reference (called when boss is killed)
   */
  clearBoss(): void {
    this.boss = null;
    this.currentBossType = null;
  }

  // ========================================
  // Enemy spawning
  // ========================================

  spawnEnemiesForRoom(roomNumber: number, totalRooms: number): void {
    // Always reset spawn state at the start of any room
    this.cancelWaveTimers();
    this.pendingEnemySpawns = 0;

    // Room 20 is the final boss room
    if (roomNumber === totalRooms) {
      this.spawnBoss(roomNumber);
      return;
    }

    // Room 10 is the mini-boss room - spawn an actual boss with reduced stats
    if (STANDARD_ROOM_LAYOUT.miniBossRooms.includes(roomNumber)) {
      this.spawnMiniBoss(roomNumber);
      return;
    }

    // Get current chapter and its configuration
    const selectedChapter = chapterManager.getSelectedChapter() as ChapterId;
    const chapterDef = getChapterDefinition(selectedChapter);

    // Calculate base enemy count (scales with room number and difficulty)
    // In endless mode, increase enemy count by 50% per wave
    const waveEnemyMultiplier = this.isEndlessMode ? 1 + (this.endlessWave - 1) * 0.5 : 1;
    const hordeMagnetMultiplier = this.player.getHordeMagnetEnemyMultiplier(); // +50% per level (stacks)
    const baseEnemies = Math.round(4 * waveEnemyMultiplier * hordeMagnetMultiplier);
    const scaledBase =
      Math.round(baseEnemies * this.difficultyConfig.enemySpawnMultiplier) +
      this.difficultyConfig.extraEnemyCount;

    // Use the RoomGenerator to create a procedurally generated room
    this.currentGeneratedRoom = this.roomGenerator.generateRoom(
      selectedChapter,
      roomNumber,
      this.player.x,
      this.player.y,
      scaledBase,
      chapterDef.scaling.extraEnemiesPerRoom,
    );

    // Log room generation details for debugging
    const layoutName = this.currentGeneratedRoom.layout.name;
    const comboName = this.currentGeneratedRoom.combination?.name || "Random Mix";
    console.log(
      `Room ${roomNumber}: Layout "${layoutName}", Combo "${comboName}", Enemies: ${this.currentGeneratedRoom.enemySpawns.length}`,
    );

    // Spawn enemies using the generated positions
    this.spawnEnemiesFromGeneration(this.currentGeneratedRoom, roomNumber);
  }

  /**
   * Spawn enemies using positions from the room generator
   */
  private spawnEnemiesFromGeneration(generatedRoom: GeneratedRoom, roomNumber: number): void {
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
      console.log(`Room ${roomNumber}: Created ${generatedRoom.layout.walls.length} walls`);
    } else {
      this.wallGroup.clearWalls();
    }

    // Get chapter for enemy modifiers
    const selectedChapter = chapterManager.getSelectedChapter() as ChapterId;
    const chapterDef = getChapterDefinition(selectedChapter);

    this.pendingEnemySpawns = generatedRoom.enemySpawns.length;
    if (this.pendingEnemySpawns === 0) {
      console.log(`Room ${roomNumber}: No enemies to spawn`);
      return;
    }

    const totalSpawns = generatedRoom.enemySpawns.length;
    const waveCount = totalSpawns <= 6 ? 2 : 3;
    const chunkSize = Math.ceil(totalSpawns / waveCount);
    // Scale wave delay by game speed so spawns feel consistent at any speed
    // At 5x speed, divide by 5 so waves come 5x faster in real-time
    const timeScale = this.scene.physics.world.timeScale;
    const gameSpeedMultiplier = timeScale > 0 ? 1 / timeScale : 1;
    const waveDelay = 1500 / gameSpeedMultiplier; // ms between waves (scaled)

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
          const roomScaling = getRoomProgressionScaling(roomNumber);

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
            speedMultiplier: Math.min(
              1.8,
              (chapterModifiers.speedMultiplier ?? 1) * (1 + (endlessMult - 1) * 0.15),
            ), // Speed scales gently, capped at 1.8x
            attackCooldownMultiplier: Math.max(
              0.5,
              (chapterModifiers.attackCooldownMultiplier ?? 1) / (1 + (endlessMult - 1) * 0.15),
            ), // Faster attacks, capped at 2x rate
            projectileSpeedMultiplier: Math.min(
              1.6,
              (chapterModifiers.projectileSpeedMultiplier ?? 1) * (1 + (endlessMult - 1) * 0.15),
            ), // Projectile speed capped at 1.6x
            abilityIntensityMultiplier: chapterModifiers.abilityIntensityMultiplier,
          };

          // Determine if this enemy spawns from the top of screen
          const spawnFromTop = waveTopFlags[index] ?? false;

          this.spawnEnemyFromPosition(spawn, enemyOptions, spawnFromTop);
          this.pendingEnemySpawns = Math.max(0, this.pendingEnemySpawns - 1);
        });
      });

      this.activeWaveTimers.push(timer);
    }

    console.log(
      `Room ${roomNumber}: Scheduled ${totalSpawns} enemies (${topSpawnCount} from top) across ${waveCount} waves`,
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
  spawnMinion(x: number, y: number, roomNumber: number): void {
    // Use the existing enemy spawning infrastructure
    const selectedChapter = chapterManager.getSelectedChapter() as ChapterId;
    const chapterDef = getChapterDefinition(selectedChapter);
    const roomScaling = getRoomProgressionScaling(roomNumber);

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

  private spawnBoss(roomNumber: number): void {
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
    const roomScaling = getRoomProgressionScaling(roomNumber);
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
      newBoss.setMinionSpawnCallback((x, y) => this.spawnMinion(x, y, roomNumber));
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

  private spawnMiniBoss(roomNumber: number): void {
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
    const roomScaling = getRoomProgressionScaling(roomNumber);
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
      newMiniBoss.setMinionSpawnCallback((x, y) => this.spawnMinion(x, y, roomNumber));
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

  cancelWaveTimers(): void {
    this.activeWaveTimers.forEach((timer) => timer.remove(false));
    this.activeWaveTimers = [];
  }

  /**
   * Clean up all resources when scene is shutting down
   */
  destroy(): void {
    this.cancelWaveTimers();
    this.boss = null;
    this.currentBossType = null;
    this.currentGeneratedRoom = null;
  }
}

export default EnemySpawnManager;
