import Phaser from "phaser";
import Player from "../entities/Player";
import Enemy from "../entities/Enemy";
import Boss from "../entities/Boss";
import { getCurrentDifficulty } from "../config/difficulty";
import { InputSystem } from "./game/InputSystem";
import { CombatSystem } from "./game/CombatSystem";
import { RoomManager } from "./game/RoomManager";
import { EnemyDeathHandler } from "./game/EnemyDeathHandler";
import { ShootingSystem } from "./game/ShootingSystem";
import { LevelUpSystem } from "./game/LevelUpSystem";
import { RespawnSystem } from "./game/RespawnSystem";
import { PassiveEffectSystem } from "./game/PassiveEffectSystem";
import { TutorialSystem } from "./game/TutorialSystem";
import { PickupSystem } from "./game/PickupSystem";
import { RunEndSystem } from "./game/RunEndSystem";
import { InitializationSystem, type InitializationResult } from "./game/InitializationSystem";
import { EventHandlerFactory } from "./game/EventHandlerFactory";
import BulletPool from "../systems/BulletPool";
import EnemyBulletPool from "../systems/EnemyBulletPool";
import SpiritCatPool from "../systems/SpiritCatPool";
import BombPool from "../systems/BombPool";
import GoldPool from "../systems/GoldPool";
import HealthPool from "../systems/HealthPool";
import DamageNumberPool from "../systems/DamageNumberPool";
import {
  saveManager,
  GraphicsQuality,
  ColorblindMode,
  type GameSpeedMultiplier,
} from "../systems/SaveManager";
import type { ParticleManager } from "../systems/ParticleManager";
import type { BackgroundAnimationManager } from "../systems/BackgroundAnimationManager";
import type { TalentBonuses } from "../config/talentData";
import { performanceMonitor } from "../systems/PerformanceMonitor";
import WallGroup from "../systems/WallGroup";
import type { RespawnRoomState } from "./GameOverScene";

export default class GameScene extends Phaser.Scene {
  private player!: Player;
  private inputSystem!: InputSystem;
  private combatSystem!: CombatSystem;
  private roomManager!: RoomManager;
  private enemyDeathHandler!: EnemyDeathHandler;
  private shootingSystem!: ShootingSystem;
  private levelUpSystem!: LevelUpSystem;
  private respawnSystem!: RespawnSystem;
  private passiveEffectSystem!: PassiveEffectSystem;
  private tutorialSystem!: TutorialSystem;
  private pickupSystem!: PickupSystem;
  private runEndSystem!: RunEndSystem;

  private bulletPool!: BulletPool;
  private enemyBulletPool!: EnemyBulletPool;
  private bombPool!: BombPool;
  private goldPool!: GoldPool;
  private healthPool!: HealthPool;
  private damageNumberPool!: DamageNumberPool;
  private enemies!: Phaser.Physics.Arcade.Group;

  // Visual effects systems
  private particles!: ParticleManager;
  private backgroundAnimations!: BackgroundAnimationManager;

  // Game state tracking
  private isGameOver: boolean = false;
  private boss: Boss | null = null;

  // Physics groups
  private wallGroup!: WallGroup;

  // Talent bonuses (cached for use throughout the game)
  private talentBonuses!: TalentBonuses;

  // Spirit cat pool (needed for physics setup)
  private spiritCatPool: SpiritCatPool | null = null;

  constructor() {
    super({ key: "GameScene" });
  }

  create() {
    // Register event listeners
    this.registerEventListeners();

    // Create event handlers for InitializationSystem using factory
    const eventHandlerFactory = new EventHandlerFactory({
      dependencies: {
        scene: this,
        getPlayer: () => this.player,
        getBoss: () => this.boss,
        setBoss: (boss) => {
          this.boss = boss;
        },
        getIsGameOver: () => this.isGameOver,
        setIsGameOver: (value) => {
          this.isGameOver = value;
        },
        getInputSystem: () => this.inputSystem,
        setInputSystem: (system) => {
          this.inputSystem = system!;
        },
        getLevelUpSystem: () => this.levelUpSystem,
        getPassiveEffectSystem: () => this.passiveEffectSystem,
        getRoomManager: () => this.roomManager,
        getEnemyDeathHandler: () => this.enemyDeathHandler,
        getCombatSystem: () => this.combatSystem,
        getShootingSystem: () => this.shootingSystem,
        getPickupSystem: () => this.pickupSystem,
        getRunEndSystem: () => this.runEndSystem,
        getRespawnSystem: () => this.respawnSystem,
        updatePlayerHealthUI: (player) => this.updatePlayerHealthUI(player),
        updateXPUI: () => this.updateXPUI(),
        resetJoystickState: () => this.resetJoystickState(),
        handleBombExplosion: (x, y, radius, damage) =>
          this.handleBombExplosion(x, y, radius, damage),
      },
    });
    const eventHandlers = eventHandlerFactory.createHandlers();

    // Initialize game using InitializationSystem
    const initSystem = new InitializationSystem({
      scene: this,
      game: this.game,
      eventHandlers,
    });

    const result = initSystem.initialize();

    // Store all initialized objects
    this.storeInitializationResult(result);

    // Set up physics collisions (uses private methods)
    this.setupPhysicsCollisions();

    // Apply graphics quality settings
    const settings = saveManager.getSettings();
    this.applyGraphicsQuality(settings.graphicsQuality);
    this.applyColorblindMode(settings.colorblindMode);
    this.applyGameSpeed(saveManager.getGameSpeedMultiplier());

    // Debug keyboard controls
    if (this.game.registry.get("debug")) {
      const nKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.N);
      nKey.on("down", () => {
        this.debugSkipLevel();
      });
    }

    // Update UIScene with room info
    this.roomManager.updateRoomUI();

    // Apply starting abilities from Glory talent
    if (this.talentBonuses.startingAbilities > 0) {
      console.log(
        `GameScene: ${this.talentBonuses.startingAbilities} starting abilities from Glory talent - launching selection UI`,
      );
      this.physics.pause();
      this.time.delayedCall(100, () => {
        this.levelUpSystem.launchStartingAbilitySelection();
      });
    } else {
      this.roomManager.spawnEnemiesForRoom();
    }

    // Send initial health to UIScene
    this.scene
      .get("UIScene")
      .events.emit("updateHealth", this.player.getHealth(), this.player.getMaxHealth());

    // Initialize score tracking with current difficulty
    this.scene.get("UIScene").events.emit("initScore", getCurrentDifficulty(this.game));

    // Show tutorial for first-time players
    if (!saveManager.isTutorialCompleted()) {
      this.tutorialSystem.showTutorial();
    }

    console.log("GameScene: Created");
  }

  /**
   * Register all event listeners for game events
   */
  private registerEventListeners(): void {
    // Register shutdown event
    this.events.once("shutdown", this.shutdown, this);

    // Debug skip level event
    if (this.game.registry.get("debug")) {
      this.game.events.on("debugSkipLevel", this.debugSkipLevel, this);
      this.events.once("shutdown", () => {
        this.game.events.off("debugSkipLevel", this.debugSkipLevel, this);
      });
    }

    // Skip run event (delegated to RunEndSystem)
    const handleSkipRun = () => this.runEndSystem?.handleSkipRun();
    this.game.events.on("skipRun", handleSkipRun);
    this.events.once("shutdown", () => {
      this.game.events.off("skipRun", handleSkipRun);
    });

    // Pause event (delegated to RunEndSystem)
    const handlePause = () => this.runEndSystem?.handlePause();
    this.game.events.on("pauseRequested", handlePause);
    this.events.once("shutdown", () => {
      this.game.events.off("pauseRequested", handlePause);
    });

    // Quit from pause event (delegated to RunEndSystem)
    const handleQuitFromPause = () => this.runEndSystem?.handleQuitFromPause();
    this.game.events.on("quitFromPause", handleQuitFromPause);
    this.events.once("shutdown", () => {
      this.game.events.off("quitFromPause", handleQuitFromPause);
    });

    // Respawn event
    this.game.events.on("playerRespawn", (roomState: RespawnRoomState) => {
      this.respawnSystem.handleRespawn(roomState);
    });
    this.events.once("shutdown", () => {
      this.game.events.off("playerRespawn");
    });

    // Game speed change event
    const handleSpeedChange = (speed: GameSpeedMultiplier) => {
      this.applyGameSpeed(speed);
    };
    this.game.events.on("gameSpeedChanged", handleSpeedChange);
    this.events.once("shutdown", () => {
      this.game.events.off("gameSpeedChanged", handleSpeedChange);
    });
  }

  /**
   * Store the initialization result in class properties
   */
  private storeInitializationResult(result: InitializationResult): void {
    // Player
    this.player = result.player;

    // Pools
    this.bulletPool = result.pools.bulletPool;
    this.enemyBulletPool = result.pools.enemyBulletPool;
    this.bombPool = result.pools.bombPool;
    this.goldPool = result.pools.goldPool;
    this.healthPool = result.pools.healthPool;
    this.damageNumberPool = result.pools.damageNumberPool;
    this.spiritCatPool = result.pools.spiritCatPool;

    // Visual effects (screenShake managed by subsystems)
    this.particles = result.visualEffects.particles;
    this.backgroundAnimations = result.visualEffects.backgroundAnimations;

    // Systems
    this.inputSystem = result.systems.inputSystem;
    this.combatSystem = result.systems.combatSystem;
    this.roomManager = result.systems.roomManager;
    this.enemyDeathHandler = result.systems.enemyDeathHandler;
    this.shootingSystem = result.systems.shootingSystem;
    this.levelUpSystem = result.systems.levelUpSystem;
    this.respawnSystem = result.systems.respawnSystem;
    this.passiveEffectSystem = result.systems.passiveEffectSystem;
    this.tutorialSystem = result.systems.tutorialSystem;
    this.pickupSystem = result.systems.pickupSystem;
    this.runEndSystem = result.systems.runEndSystem;

    // Physics
    this.enemies = result.physics.enemies;
    this.wallGroup = result.physics.wallGroup;

    // Game state
    this.talentBonuses = result.gameState.talentBonuses;

    // Reset game state
    this.isGameOver = false;
  }

  /**
   * Set up physics collisions between game objects
   */
  private setupPhysicsCollisions(): void {
    // Bullets hit enemies
    this.physics.add.overlap(
      this.bulletPool,
      this.enemies,
      this.bulletHitEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );

    // Enemy bullets hit player
    this.physics.add.overlap(
      this.player,
      this.enemyBulletPool,
      this.enemyBulletHitPlayer as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );

    // Enemies hit player (melee damage)
    this.physics.add.overlap(
      this.player,
      this.enemies,
      this.enemyHitPlayer as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );

    // Spirit cats hit enemies (Meowgik ability)
    if (this.spiritCatPool) {
      this.physics.add.overlap(
        this.spiritCatPool,
        this.enemies,
        ((cat: Phaser.GameObjects.GameObject, enemy: Phaser.GameObjects.GameObject) => {
          this.passiveEffectSystem.spiritCatHitEnemy(cat, enemy);
        }) as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
        undefined,
        this,
      );
    }

    // Rotating orbs hit enemies
    const orbitalManager = this.passiveEffectSystem.getOrbitalManager();
    this.physics.add.overlap(
      orbitalManager.getRotatingOrbPool(),
      this.enemies,
      ((orb: Phaser.GameObjects.GameObject, enemy: Phaser.GameObjects.GameObject) => {
        this.combatSystem.rotatingOrbHitEnemy(orb, enemy);
      }) as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );

    // Orbital shields block enemy bullets
    this.physics.add.overlap(
      orbitalManager.getOrbitalShieldPool(),
      this.enemyBulletPool,
      ((shield: Phaser.GameObjects.GameObject, bullet: Phaser.GameObjects.GameObject) => {
        this.combatSystem.orbitalShieldBlockBullet(shield, bullet);
      }) as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );

    // Spirit pets hit enemies (Spirit Pets ability)
    this.physics.add.overlap(
      this.passiveEffectSystem.getSpiritPetPool(),
      this.enemies,
      ((pet: Phaser.GameObjects.GameObject, enemy: Phaser.GameObjects.GameObject) => {
        this.combatSystem.spiritPetHitEnemy(pet, enemy);
      }) as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );

    // Wall collisions
    this.physics.add.collider(this.player, this.wallGroup);
    this.physics.add.collider(this.enemies, this.wallGroup);
    // NOTE: Enemy-to-enemy collision removed for performance (N² checks)
    // Most roguelikes allow enemy overlap - players don't notice

    // Bullets hit walls
    this.physics.add.overlap(
      this.bulletPool,
      this.wallGroup,
      this.bulletHitWall as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );

    // Enemy bullets hit walls
    this.physics.add.overlap(
      this.enemyBulletPool,
      this.wallGroup,
      this.enemyBulletHitWall as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );
  }

  /**
   * Handle bomb explosion damage to player
   */
  private handleBombExplosion(x: number, y: number, radius: number, damage: number): void {
    // Delegate to CombatSystem
    this.combatSystem.handleBombExplosion(x, y, radius, damage);
    // Check Iron Will talent (bonus HP when low health)
    this.passiveEffectSystem.checkIronWillStatus();
  }

  private bulletHitEnemy(
    bullet: Phaser.GameObjects.GameObject,
    enemy: Phaser.GameObjects.GameObject,
  ) {
    // Delegate to CombatSystem
    this.combatSystem.bulletHitEnemy(bullet, enemy);
  }

  private updateXPUI() {
    const xpPercentage = this.player.getXPPercentage();
    const level = this.player.getLevel();
    this.scene.get("UIScene").events.emit("updateXP", xpPercentage, level);
  }

  /**
   * Handle player bullets hitting walls
   * Bullets with through_wall ability pass through
   * Bullets with bouncy_wall ability bounce off
   * Other bullets are deactivated
   */
  private bulletHitWall(
    bullet: Phaser.GameObjects.GameObject,
    wall: Phaser.GameObjects.GameObject,
  ) {
    // Delegate to CombatSystem
    this.combatSystem.bulletHitWall(bullet, wall);
  }

  /**
   * Handle enemy bullets hitting walls - always destroyed
   */
  private enemyBulletHitWall(
    bullet: Phaser.GameObjects.GameObject,
    wall: Phaser.GameObjects.GameObject,
  ) {
    // Delegate to CombatSystem
    this.combatSystem.enemyBulletHitWall(bullet, wall);
  }

  private enemyBulletHitPlayer(
    player: Phaser.GameObjects.GameObject,
    bullet: Phaser.GameObjects.GameObject,
  ) {
    // Delegate to CombatSystem
    this.combatSystem.enemyBulletHitPlayer(player, bullet);
    // Check Iron Will talent (bonus HP when low health)
    this.passiveEffectSystem.checkIronWillStatus();
  }

  private enemyHitPlayer(
    player: Phaser.GameObjects.GameObject,
    enemy: Phaser.GameObjects.GameObject,
  ) {
    // Delegate to CombatSystem
    this.combatSystem.enemyHitPlayer(player, enemy);
    // Check Iron Will talent (bonus HP when low health)
    this.passiveEffectSystem.checkIronWillStatus();
  }

  private updatePlayerHealthUI(player: Player) {
    // Emit event to UIScene with current and max health
    this.scene
      .get("UIScene")
      .events.emit("updateHealth", player.getHealth(), player.getMaxHealth());

    // Also update shield bar if shield barrier is active
    this.updateShieldUI();
  }

  private updateShieldUI() {
    if (!this.passiveEffectSystem) return;
    const shieldManager = this.passiveEffectSystem.getShieldBarrierManager();
    this.scene
      .get("UIScene")
      .events.emit("updateShield", shieldManager.getCurrentShield(), shieldManager.getMaxShield());
  }

  /**
   * Debug functionality to skip the current level
   */
  private debugSkipLevel() {
    if (this.isGameOver || this.roomManager.isInTransition()) {
      console.log(
        "Debug: Skip ignored (GameOver:",
        this.isGameOver,
        "Transitioning:",
        this.roomManager.isInTransition(),
        ")",
      );
      return;
    }

    this.roomManager.setTransitioning(true);
    console.log("Debug: Skipping level", this.roomManager.getRoomNumber());

    // Magnetically collect all remaining gold and health pickups before skipping
    this.goldPool.collectAll(this.player.x, this.player.y);
    this.healthPool.collectAll(this.player.x, this.player.y, (healAmount) => {
      this.player.heal(healAmount);
      this.scene
        .get("UIScene")
        .events.emit("updateHealth", this.player.getHealth(), this.player.getMaxHealth());
    });

    // Reset transition flag just before calling the transition method
    // (transitionToNextRoom will set it to false when finished)
    this.roomManager.setTransitioning(false);
    this.roomManager.triggerTransitionToNextRoom();
  }

  /**
   * Handle enemy death from DOT (fire/poison damage)
   * Extracted for batch processing in update loop
   */
  private handleEnemyDOTDeath(e: Enemy): void {
    const isBoss = this.boss !== null && e === (this.boss as unknown as Enemy);
    this.enemyDeathHandler.handleEnemyDeath(e, isBoss, { emitFireParticles: true });
  }

  update(time: number, delta: number) {
    // Skip update if game is over
    if (this.isGameOver) return;

    // Sync game state to CombatSystem and RoomManager
    const isTransitioning = this.roomManager.isInTransition();
    const isLevelingUp = this.levelUpSystem.isLevelingUp;
    this.combatSystem.setGameState(this.isGameOver, isLevelingUp, isTransitioning);
    this.roomManager.setGameState(this.isGameOver, isLevelingUp);

    // Update performance monitor
    performanceMonitor.update(delta);

    if (this.player) {
      // Get input from InputSystem (handles keyboard + joystick, stuck state detection)
      const input = this.inputSystem.update();

      // Cache player position for this frame - avoids repeated property access
      const playerX = this.player.x;
      const playerY = this.player.y;

      // Calculate velocity from normalized input (-1 to 1)
      const baseVelocity = 400;
      const maxVelocity = baseVelocity * this.player.getMovementSpeedMultiplier();
      const vx = input.velocityX * maxVelocity;
      const vy = input.velocityY * maxVelocity;

      this.player.setVelocity(vx, vy);

      // Update player AFTER setting velocity so isMoving reflects current state
      this.player.update(time, delta);

      // CORE MECHANIC: Auto-fire when player is stationary
      // Player shoots when they have no active movement input AND velocity is low
      // Using both checks ensures shooting works correctly:
      // - input.isShooting: Immediate response to input release (no frame delay)
      // - isPlayerMoving: Accounts for momentum/sliding before shooting
      if (input.isShooting && !this.player.isPlayerMoving()) {
        this.shootingSystem.tryShoot(
          time,
          isTransitioning,
          this.tutorialSystem.isShowing,
          this.isGameOver,
        );
      }

      // Update enemies and handle fire DOT deaths
      // Use for loop (faster than forEach) with cached length
      const enemyChildren = this.enemies.getChildren();
      const enemyCount = enemyChildren.length;
      const enemiesToDestroy: Enemy[] = [];

      for (let i = 0; i < enemyCount; i++) {
        const e = enemyChildren[i] as Enemy;
        if (e && e.active) {
          const updateResult = e.update(time, delta, playerX, playerY);

          // Show DoT damage text bubble if damage was dealt
          if (updateResult.dotDamage > 0) {
            this.damageNumberPool.showDotDamage(e.x, e.y, updateResult.dotDamage);
          }

          if (updateResult.died) {
            enemiesToDestroy.push(e);
          }
        }
      }

      // Process dead enemies outside the main loop (batch processing)
      for (const e of enemiesToDestroy) {
        this.handleEnemyDOTDeath(e);
      }

      // Update all passive effects (damage aura, chainsaw orbit, spirit cats)
      this.passiveEffectSystem.update(time, delta, playerX, playerY);

      // Update shield bar UI (shield regenerates over time)
      this.updateShieldUI();

      // Update pickup collection (gold and health)
      this.pickupSystem.update(playerX, playerY);

      // Update performance monitor with entity counts
      performanceMonitor.updateEntityCounts(
        enemyCount,
        this.bulletPool.countActive(true) + this.enemyBulletPool.countActive(true),
        this.particles.getActiveEmitterCount(),
      );
    }
  }

  /**
   * Reset joystick state to prevent stuck input
   * Called when pausing, resuming, or when browser loses focus
   */
  private resetJoystickState() {
    console.log("GameScene: Resetting joystick state");

    // Reset input system (handles joystick reset internally)
    if (this.inputSystem) {
      this.inputSystem.reset();
    }

    // Stop player movement immediately
    if (this.player && this.player.body) {
      this.player.setVelocity(0, 0);
    }
  }

  shutdown() {
    // Stop all delayed calls to prevent callbacks on destroyed objects
    this.time.removeAllEvents();

    // Clean up input system when scene shuts down
    if (this.inputSystem) {
      this.inputSystem.destroy();
      this.inputSystem = null!;
    }

    // Clean up shooting system
    if (this.shootingSystem) {
      this.shootingSystem.destroy();
      this.shootingSystem = null!;
    }

    // Clean up level up system
    if (this.levelUpSystem) {
      this.levelUpSystem.destroy();
      this.levelUpSystem = null!;
    }

    // Clean up particles
    if (this.particles) {
      this.particles.destroy();
      this.particles = null!;
    }

    // Clean up background animations
    if (this.backgroundAnimations) {
      this.backgroundAnimations.destroy();
      this.backgroundAnimations = null!;
    }

    // Clean up passive effect system (handles damage aura graphics, chainsaw sprites, etc.)
    if (this.passiveEffectSystem) {
      this.passiveEffectSystem.destroy();
      this.passiveEffectSystem = null!;
    }

    // Clean up tutorial system
    if (this.tutorialSystem) {
      this.tutorialSystem.destroy();
      this.tutorialSystem = null!;
    }

    // Clean up pickup system
    if (this.pickupSystem) {
      this.pickupSystem.destroy();
      this.pickupSystem = null!;
    }

    // Clean up run end system
    if (this.runEndSystem) {
      this.runEndSystem.destroy();
      this.runEndSystem = null!;
    }

    // Clean up pools
    if (this.bulletPool) {
      this.bulletPool.destroy(true);
      this.bulletPool = null!;
    }
    if (this.enemyBulletPool) {
      this.enemyBulletPool.destroy(true);
      this.enemyBulletPool = null!;
    }
    if (this.bombPool) {
      this.bombPool.destroy(true);
      this.bombPool = null!;
    }
    if (this.goldPool) {
      this.goldPool.destroy(true);
      this.goldPool = null!;
    }
    if (this.healthPool) {
      this.healthPool.destroy(true);
      this.healthPool = null!;
    }
    if (this.damageNumberPool) {
      this.damageNumberPool.destroy();
      this.damageNumberPool = null!;
    }
    if (this.spiritCatPool) {
      this.spiritCatPool.destroy(true);
      this.spiritCatPool = null;
    }

    // Clean up enemies group
    if (this.enemies) {
      this.enemies.destroy(true);
      this.enemies = null!;
    }

    // Clean up boss
    if (this.boss) {
      this.boss.destroy();
      this.boss = null;
    }

    // Clean up player
    if (this.player) {
      this.player.destroy();
      this.player = null!;
    }

    // Clean up room manager
    if (this.roomManager) {
      this.roomManager.destroy();
    }
  }

  /**
   * Apply graphics quality settings to particle and effect systems
   */
  private applyGraphicsQuality(quality: GraphicsQuality): void {
    switch (quality) {
      case GraphicsQuality.LOW:
        this.particles.setQuality(0.3); // 30% particles
        break;
      case GraphicsQuality.MEDIUM:
        this.particles.setQuality(0.6); // 60% particles
        break;
      case GraphicsQuality.HIGH:
      default:
        this.particles.setQuality(1.0); // Full particles
        break;
    }

    // Update background animation quality
    if (this.backgroundAnimations) {
      this.backgroundAnimations.setQuality(quality);
    }
  }

  /**
   * Apply colorblind mode filter to the camera
   * Uses color matrix transformations to simulate how colors appear to colorblind users
   * and shifts problematic colors to be more distinguishable
   */
  private applyColorblindMode(mode: ColorblindMode): void {
    const camera = this.cameras.main;

    // Reset any existing post pipeline
    camera.resetPostPipeline();

    if (mode === ColorblindMode.NONE) {
      return;
    }

    // Apply colorblind-friendly color adjustment using Phaser's built-in ColorMatrix
    // These matrices shift colors to be more distinguishable for each type of colorblindness
    const pipeline = camera.postFX?.addColorMatrix();
    if (!pipeline) {
      console.warn("ColorMatrix post FX not available");
      return;
    }

    switch (mode) {
      case ColorblindMode.PROTANOPIA:
        // Protanopia (red-blind): Shift reds toward blue, enhance blue-yellow contrast
        pipeline.set([
          0.567, 0.433, 0, 0, 0, 0.558, 0.442, 0, 0, 0, 0, 0.242, 0.758, 0, 0, 0, 0, 0, 1, 0,
        ]);
        break;

      case ColorblindMode.DEUTERANOPIA:
        // Deuteranopia (green-blind): Shift greens toward blue, enhance contrast
        pipeline.set([0.625, 0.375, 0, 0, 0, 0.7, 0.3, 0, 0, 0, 0, 0.3, 0.7, 0, 0, 0, 0, 0, 1, 0]);
        break;

      case ColorblindMode.TRITANOPIA:
        // Tritanopia (blue-blind): Shift blues toward red, enhance red-green contrast
        pipeline.set([
          0.95, 0.05, 0, 0, 0, 0, 0.433, 0.567, 0, 0, 0, 0.475, 0.525, 0, 0, 0, 0, 0, 1, 0,
        ]);
        break;
    }
  }

  /**
   * Apply game speed multiplier to the physics world
   * Higher values make the game run faster (2x, 3x, 5x)
   */
  private applyGameSpeed(multiplier: GameSpeedMultiplier): void {
    // Phaser's physics timeScale is inverted: lower values = faster simulation
    // To achieve 2x speed, we use timeScale = 0.5 (1/2)
    this.physics.world.timeScale = 1 / multiplier;
    console.log(`GameScene: Applied game speed ${multiplier}x`);
  }
}
