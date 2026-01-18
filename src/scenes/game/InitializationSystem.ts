import Phaser from "phaser";
import Player from "../../entities/Player";
import Boss from "../../entities/Boss";
import { InputSystem } from "./InputSystem";
import { AbilitySystem } from "./AbilitySystem";
import { CombatSystem } from "./CombatSystem";
import { RoomManager } from "./RoomManager";
import { EnemyDeathHandler } from "./EnemyDeathHandler";
import { ShootingSystem } from "./ShootingSystem";
import { LevelUpSystem } from "./LevelUpSystem";
import { RespawnSystem } from "./RespawnSystem";
import { PassiveEffectSystem } from "./PassiveEffectSystem";
import { TutorialSystem } from "./TutorialSystem";
import { PickupSystem } from "./PickupSystem";
import { RunEndSystem } from "./RunEndSystem";
import BulletPool from "../../systems/BulletPool";
import EnemyBulletPool from "../../systems/EnemyBulletPool";
import SpiritCatPool from "../../systems/SpiritCatPool";
import { getSpiritCatConfig, type SpiritCatConfig } from "../../config/heroData";
import BombPool from "../../systems/BombPool";
import GoldPool from "../../systems/GoldPool";
import HealthPool from "../../systems/HealthPool";
import DamageNumberPool from "../../systems/DamageNumberPool";
import { getDifficultyConfig, type DifficultyConfig } from "../../config/difficulty";
import { chapterManager } from "../../systems/ChapterManager";
import { getChapterDefinition } from "../../config/chapterData";
import { saveManager } from "../../systems/SaveManager";
import { ScreenShake, createScreenShake } from "../../systems/ScreenShake";
import { ParticleManager, createParticleManager } from "../../systems/ParticleManager";
import {
  BackgroundAnimationManager,
  createBackgroundAnimationManager,
} from "../../systems/BackgroundAnimationManager";
import { heroManager } from "../../systems/HeroManager";
import { equipmentManager } from "../../systems/EquipmentManager";
import { THEME_ASSETS } from "../../config/themeData";
import { talentManager } from "../../systems/TalentManager";
import type { TalentBonuses } from "../../config/talentData";
import { performanceMonitor } from "../../systems/PerformanceMonitor";
import { getRoomGenerator, type RoomGenerator } from "../../systems/RoomGenerator";
import WallGroup from "../../systems/WallGroup";
import { SeededRandom } from "../../systems/SeededRandom";
import { errorReporting } from "../../systems/ErrorReportingManager";
import {
  calculatePlayerStats,
  getWeaponMultipliers,
  getWeaponProjectileConfig,
  type ProjectileConfig,
} from "../../systems/StatCalculator";

/**
 * Event handlers for GameScene callbacks
 */
export interface GameSceneEventHandlers {
  // Combat events
  onEnemyKilled: (enemy: Phaser.GameObjects.GameObject, isBoss: boolean) => void;
  onPlayerDamaged: (damage: number) => void;
  onPlayerHealed: (amount: number) => void;
  onPlayerDeath: () => void;
  onBossHealthUpdate: (health: number, maxHealth: number) => void;
  onBossKilled: () => void;
  onLevelUp: () => void;
  onXPGained: (xp: number) => void;

  // Room events
  onRoomCleared: (roomNumber: number, collectedGold: number) => void;
  onRoomEntered: (roomNumber: number, endlessWave?: number) => void;
  onUpdateRoomUI: (currentRoom: number, totalRooms: number, endlessWave?: number) => void;
  onBossSpawned: (boss: Boss, bossType: string, bossName: string) => void;
  onShowBossHealth: (health: number, maxHealth: number, name: string) => void;
  onHideBossHealth: () => void;
  onVictory: () => void;
  onBombExplosion: (x: number, y: number, radius: number, damage: number) => void;

  // Level up events
  onLevelUpStarted: () => void;
  onLevelUpCompleted: () => void;
  onAbilityApplied: (abilityId: string) => void;
  onStartingAbilitiesComplete: () => void;
  onAutoLevelUp: (ability: unknown) => void;
  onCheckIronWill: () => void;

  // Enemy death events
  onKillRecorded: () => void;
  onPlayerHealthUpdated: () => void;
  onXPUIUpdated: () => void;
  onEnemyCacheInvalidated: () => void;

  // Respawn events
  onRespawnComplete: (newInputSystem: InputSystem) => void;
  onUpdateHealthUI: () => void;

  // Passive effects events
  onIronWillActivated: (bonusHP: number) => void;
  onIronWillDeactivated: (bonusHP: number) => void;

  // Tutorial events
  onTutorialShown: () => void;
  onTutorialDismissed: () => void;

  // Ability events
  onAbilitiesUpdated: (abilities: unknown[]) => void;
  onHealthUpdated: (current: number, max: number) => void;
  onGiantLevelChanged: () => void;

  // Run end events
  onInputDestroyed: () => void;

  // Game state
  getIsGameOver: () => boolean;
  setIsGameOver: (value: boolean) => void;
}

/**
 * Configuration for InitializationSystem
 */
export interface InitializationSystemConfig {
  scene: Phaser.Scene;
  game: Phaser.Game;
  eventHandlers: GameSceneEventHandlers;
}

/**
 * Pools created during initialization
 */
export interface InitializationPools {
  bulletPool: BulletPool;
  enemyBulletPool: EnemyBulletPool;
  bombPool: BombPool;
  goldPool: GoldPool;
  healthPool: HealthPool;
  damageNumberPool: DamageNumberPool;
  spiritCatPool: SpiritCatPool | null;
}

/**
 * Visual effects created during initialization
 */
export interface InitializationVisualEffects {
  screenShake: ScreenShake;
  particles: ParticleManager;
  backgroundAnimations: BackgroundAnimationManager;
}

/**
 * All systems created during initialization
 */
export interface InitializationSystems {
  inputSystem: InputSystem;
  abilitySystem: AbilitySystem;
  combatSystem: CombatSystem;
  roomManager: RoomManager;
  enemyDeathHandler: EnemyDeathHandler;
  shootingSystem: ShootingSystem;
  levelUpSystem: LevelUpSystem;
  respawnSystem: RespawnSystem;
  passiveEffectSystem: PassiveEffectSystem;
  tutorialSystem: TutorialSystem;
  pickupSystem: PickupSystem;
  runEndSystem: RunEndSystem;
}

/**
 * Physics groups created during initialization
 */
export interface InitializationPhysics {
  enemies: Phaser.Physics.Arcade.Group;
  wallGroup: WallGroup;
}

/**
 * Game state created during initialization
 */
export interface InitializationGameState {
  difficultyConfig: DifficultyConfig;
  talentBonuses: TalentBonuses;
  bonusXPMultiplier: number;
  goldBonusMultiplier: number;
  runRng: SeededRandom;
  runSeedString: string;
  weaponProjectileConfig: ProjectileConfig;
  spiritCatConfig: SpiritCatConfig | null;
  roomGenerator: RoomGenerator;
  isEndlessMode: boolean;
  totalRooms: number;
  runStartTime: number;
  selectedHeroId: string | null;
}

/**
 * Complete result from initialization
 */
export interface InitializationResult {
  player: Player;
  pools: InitializationPools;
  visualEffects: InitializationVisualEffects;
  systems: InitializationSystems;
  physics: InitializationPhysics;
  gameState: InitializationGameState;
}

/**
 * InitializationSystem - Orchestrates GameScene initialization
 *
 * Extracts the 703-line create() method from GameScene into a focused,
 * testable system. Handles:
 * - Game state initialization
 * - Player creation with calculated stats
 * - Pool creation (bullets, enemies, gold, health, etc.)
 * - Physics group and collision setup
 * - All subsystem creation in dependency order
 */
export class InitializationSystem {
  private scene: Phaser.Scene;
  private game: Phaser.Game;
  private eventHandlers: GameSceneEventHandlers;

  // Cached references for physics callbacks
  private boss: Boss | null = null;

  constructor(config: InitializationSystemConfig) {
    this.scene = config.scene;
    this.game = config.game;
    this.eventHandlers = config.eventHandlers;
  }

  /**
   * Set the current boss reference (for physics callbacks)
   */
  setBoss(boss: Boss | null): void {
    this.boss = boss;
  }

  /**
   * Initialize the entire game scene
   * Returns all created objects for GameScene to store
   */
  initialize(): InitializationResult {
    // Load difficulty configuration
    const difficultyConfig = getDifficultyConfig(this.game);
    console.log("Starting game with difficulty:", difficultyConfig.label);

    // Initialize game state
    const gameState = this.initializeGameState(difficultyConfig);

    // Set up background
    const { bg, backgroundAnimations } = this.initializeBackground(
      gameState.selectedChapter,
      gameState.chapterDef,
    );

    // Calculate player stats and create player
    const { player, spiritCatPool, spiritCatConfig, weaponProjectileConfig } = this.createPlayer(
      difficultyConfig,
      gameState.talentBonuses,
      gameState.heroStats,
      gameState.equipStats,
      gameState.selectedHeroId,
    );

    // Create pools
    const pools = this.createPools(difficultyConfig, spiritCatPool);

    // Create ability system (needed before other systems)
    const abilitySystem = new AbilitySystem(player, {
      onAbilitiesUpdated: this.eventHandlers.onAbilitiesUpdated,
      onHealthUpdated: this.eventHandlers.onHealthUpdated,
      onGiantLevelChanged: this.eventHandlers.onGiantLevelChanged,
    });

    // Create physics groups
    const physics = this.createPhysicsGroups(gameState.selectedChapter, gameState.chapterDef);

    // Create visual effects
    const visualEffects = this.createVisualEffects(backgroundAnimations, bg);

    // Initialize seeded RNG and room generator
    const { runRng, runSeedString, roomGenerator } = this.initializeRngAndRoomGenerator();

    // Create all systems
    const systems = this.createSystems(
      player,
      pools,
      physics,
      visualEffects,
      abilitySystem,
      difficultyConfig,
      gameState.talentBonuses,
      runRng,
      runSeedString,
      weaponProjectileConfig,
      spiritCatConfig,
      roomGenerator,
      gameState.isEndlessMode,
      gameState.totalRooms,
      gameState.runStartTime,
    );

    // Initialize passive effect graphics
    systems.passiveEffectSystem.initializeDamageAuraGraphics(player.depth);

    // Set respawn run start time
    systems.respawnSystem.setRunStartTime(gameState.runStartTime);

    // Debug keyboard controls
    if (this.game.registry.get("debug")) {
      performanceMonitor.createOverlay(this.scene);
    }

    return {
      player,
      pools,
      visualEffects,
      systems,
      physics,
      gameState: {
        difficultyConfig,
        talentBonuses: gameState.talentBonuses,
        bonusXPMultiplier: gameState.bonusXPMultiplier,
        goldBonusMultiplier: gameState.goldBonusMultiplier,
        runRng,
        runSeedString,
        weaponProjectileConfig,
        spiritCatConfig,
        roomGenerator,
        isEndlessMode: gameState.isEndlessMode,
        totalRooms: gameState.totalRooms,
        runStartTime: gameState.runStartTime,
        selectedHeroId: gameState.selectedHeroId,
      },
    };
  }

  /**
   * Initialize game state: mode, timing, error reporting, physics bounds
   */
  private initializeGameState(difficultyConfig: DifficultyConfig) {
    const isEndlessMode = this.game.registry.get("isEndlessMode") === true;
    const totalRooms = isEndlessMode ? 10 : chapterManager.getTotalRooms();
    const runStartTime = Date.now();

    // Update error reporting context
    const selectedHeroId = heroManager.getSelectedHeroId();
    errorReporting.setScene("GameScene");
    errorReporting.setProgress(chapterManager.getSelectedChapter(), 1);
    errorReporting.setPlayerStats(1, 100, selectedHeroId || undefined);
    errorReporting.addBreadcrumb("game", "Game started", {
      chapter: chapterManager.getSelectedChapter(),
      hero: selectedHeroId,
    });

    // Track game start in Sentry metrics
    const gameMode = isEndlessMode ? "endless" : "normal";
    errorReporting.trackGameStart(
      gameMode,
      chapterManager.getSelectedChapter(),
      difficultyConfig.label,
    );
    if (selectedHeroId) {
      errorReporting.trackHeroUsed(selectedHeroId);
    }

    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;

    // Set physics world bounds
    this.scene.physics.world.setBounds(0, 0, width, height);

    // Get selected chapter
    const selectedChapter = chapterManager.getSelectedChapter();
    const chapterDef = getChapterDefinition(selectedChapter);

    // Start the chapter run
    const started = chapterManager.startChapter(selectedChapter);
    if (!started) {
      console.error(`GameScene: Failed to start chapter ${selectedChapter}`);
    } else {
      console.log(`GameScene: Started chapter ${selectedChapter} run`);
    }

    // Get hero and equipment stats
    const heroStats = heroManager.getSelectedHeroStats();
    const equipStats = equipmentManager.getEquippedStats();

    // Get talent bonuses
    const talentBonuses = talentManager.calculateTotalBonuses();

    // Calculate bonus multipliers
    const equipmentStatMultiplier = 1 + talentBonuses.percentEquipmentStats / 100;
    const bonusXPMultiplier = 1 + (equipStats.bonusXPPercent ?? 0);
    const goldBonusMultiplier = 1 + (equipStats.goldBonusPercent ?? 0);

    console.log(`GameScene: Selected hero ${selectedHeroId} with stats:`, heroStats);
    console.log("GameScene: Equipment stats:", equipStats);
    console.log("GameScene: Talent bonuses:", talentBonuses);
    console.log(
      "GameScene: Bonus multipliers - XP:",
      bonusXPMultiplier,
      "Gold:",
      goldBonusMultiplier,
    );

    return {
      isEndlessMode,
      totalRooms,
      runStartTime,
      selectedHeroId,
      selectedChapter,
      chapterDef,
      heroStats,
      equipStats,
      talentBonuses,
      bonusXPMultiplier,
      goldBonusMultiplier,
      equipmentStatMultiplier,
    };
  }

  /**
   * Initialize background with chapter-specific theme
   */
  private initializeBackground(
    selectedChapter: number,
    chapterDef: ReturnType<typeof getChapterDefinition>,
  ) {
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;

    // Use background key
    const backgroundKeyName = `chapter${selectedChapter}Bg` as keyof typeof THEME_ASSETS;
    const backgroundKey = THEME_ASSETS[backgroundKeyName] as string;

    // Add chapter-specific background image
    const bgKey = this.scene.textures.exists(backgroundKey) ? backgroundKey : "dungeonFloor";
    const bg = this.scene.add.image(0, 0, bgKey).setOrigin(0);
    bg.setDisplaySize(width, height);

    console.log(
      `GameScene: Using background '${bgKey}' for chapter ${selectedChapter} (${chapterDef.name})`,
    );

    // Initialize background animations
    const backgroundAnimations = createBackgroundAnimationManager(this.scene);
    backgroundAnimations.initialize(selectedChapter, saveManager.getSettings().graphicsQuality, bg);

    return { bg, backgroundAnimations };
  }

  /**
   * Create player with calculated stats
   */
  private createPlayer(
    difficultyConfig: DifficultyConfig,
    talentBonuses: TalentBonuses,
    heroStats: ReturnType<typeof heroManager.getSelectedHeroStats>,
    equipStats: ReturnType<typeof equipmentManager.getEquippedStats>,
    selectedHeroId: string | null,
  ) {
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;

    // Get weapon multipliers and projectile config
    const weaponMultipliers = getWeaponMultipliers(equipStats.weaponType);
    const weaponProjectileConfig = getWeaponProjectileConfig(equipStats.weaponType);

    // Calculate player stats
    const calculatedStats = calculatePlayerStats(
      heroStats,
      equipStats,
      talentBonuses,
      weaponMultipliers,
      difficultyConfig,
    );

    console.log(
      "GameScene: Final player stats - damage:",
      calculatedStats.baseDamage,
      "attackSpeed:",
      calculatedStats.baseAttackSpeed,
      "maxHealth:",
      calculatedStats.maxHealth,
      "critChance:",
      calculatedStats.critChance,
    );

    // Create player at bottom center
    const player = new Player(
      this.scene,
      width / 2,
      height - 100,
      {
        maxHealth: calculatedStats.maxHealth,
        baseDamage: calculatedStats.baseDamage,
        baseAttackSpeed: calculatedStats.baseAttackSpeed,
        critChance: calculatedStats.critChance,
        critDamage: calculatedStats.critDamage,
      },
      selectedHeroId ?? undefined,
    );

    // Set dodge chance from equipment
    player.setDodgeChance(calculatedStats.dodgeChance);

    // Apply Helix rage passive
    if (selectedHeroId === "helix") {
      player.addRage();
      console.log("GameScene: Helix passive - Rage level 1 applied automatically");
    }

    // Initialize spirit cat system if Meowgik
    let spiritCatPool: SpiritCatPool | null = null;
    let spiritCatConfig: SpiritCatConfig | null = null;
    if (selectedHeroId === "meowgik") {
      spiritCatPool = new SpiritCatPool(this.scene);
      const heroLevel = heroManager.getLevel("meowgik");
      const unlockedPerks = new Set(heroManager.getUnlockedPerkLevels("meowgik"));
      spiritCatConfig = getSpiritCatConfig(heroLevel, unlockedPerks, heroStats.attack);
      console.log("GameScene: Meowgik spirit cats initialized:", spiritCatConfig);
    }

    return { player, spiritCatPool, spiritCatConfig, weaponProjectileConfig };
  }

  /**
   * Create all object pools
   */
  private createPools(
    difficultyConfig: DifficultyConfig,
    spiritCatPool: SpiritCatPool | null,
  ): InitializationPools {
    const bulletPool = new BulletPool(this.scene);
    const enemyBulletPool = new EnemyBulletPool(this.scene);
    const bombPool = new BombPool(this.scene);
    const goldPool = new GoldPool(this.scene);
    goldPool.setGoldMultiplier(difficultyConfig.goldMultiplier);
    const healthPool = new HealthPool(this.scene);
    const damageNumberPool = new DamageNumberPool(this.scene);

    return {
      bulletPool,
      enemyBulletPool,
      bombPool,
      goldPool,
      healthPool,
      damageNumberPool,
      spiritCatPool,
    };
  }

  /**
   * Create physics groups
   */
  private createPhysicsGroups(
    selectedChapter: number,
    chapterDef: ReturnType<typeof getChapterDefinition>,
  ): InitializationPhysics {
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;

    // Create wall group
    const wallGroup = new WallGroup(this.scene, width, height);
    wallGroup.setTexture(selectedChapter);
    wallGroup.setColor(chapterDef.theme.primaryColor);

    // Create enemy physics group
    const enemies = this.scene.physics.add.group();

    return { enemies, wallGroup };
  }

  /**
   * Create visual effects systems
   */
  private createVisualEffects(
    backgroundAnimations: BackgroundAnimationManager,
    _bg: Phaser.GameObjects.Image,
  ): InitializationVisualEffects {
    const screenShake = createScreenShake(this.scene);
    const particles = createParticleManager(this.scene);
    particles.prewarm(10);

    // Apply graphics quality settings
    const settings = saveManager.getSettings();
    screenShake.setEnabled(settings.screenShakeEnabled);

    return { screenShake, particles, backgroundAnimations };
  }

  /**
   * Initialize seeded RNG and room generator
   */
  private initializeRngAndRoomGenerator() {
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;

    // Initialize seeded random
    const passedSeed = this.game.registry.get("runSeed");
    let runRng: SeededRandom;
    if (passedSeed) {
      runRng = new SeededRandom(SeededRandom.parseSeed(passedSeed));
      this.game.registry.remove("runSeed");
    } else {
      runRng = new SeededRandom();
    }
    const runSeedString = runRng.getSeedString();
    console.log(`GameScene: Run seed: ${runSeedString}`);

    // Initialize room generator
    const roomGenerator = getRoomGenerator(width, height);
    roomGenerator.setRng(runRng);

    return { runRng, runSeedString, roomGenerator };
  }

  /**
   * Create all game systems in dependency order
   */
  private createSystems(
    player: Player,
    pools: InitializationPools,
    physics: InitializationPhysics,
    visualEffects: InitializationVisualEffects,
    abilitySystem: AbilitySystem,
    difficultyConfig: DifficultyConfig,
    talentBonuses: TalentBonuses,
    runRng: SeededRandom,
    runSeedString: string,
    weaponProjectileConfig: ProjectileConfig,
    spiritCatConfig: SpiritCatConfig | null,
    roomGenerator: RoomGenerator,
    isEndlessMode: boolean,
    totalRooms: number,
    runStartTime: number,
  ): InitializationSystems {
    // Input system
    const gameContainer = this.game.canvas.parentElement;
    const inputSystem = new InputSystem({
      scene: this.scene,
      joystickContainer: gameContainer ?? undefined,
    });

    // Combat system
    const combatSystem = new CombatSystem({
      scene: this.scene,
      player,
      enemies: physics.enemies,
      boss: this.boss,
      screenShake: visualEffects.screenShake,
      particles: visualEffects.particles,
      damageNumberPool: pools.damageNumberPool,
      talentBonuses,
      difficultyConfig,
      bonusXPMultiplier: 1 + (equipmentManager.getEquippedStats().bonusXPPercent ?? 0),
      eventHandlers: {
        onEnemyKilled: this.eventHandlers.onEnemyKilled,
        onPlayerDamaged: this.eventHandlers.onPlayerDamaged,
        onPlayerHealed: this.eventHandlers.onPlayerHealed,
        onPlayerDeath: this.eventHandlers.onPlayerDeath,
        onBossHealthUpdate: this.eventHandlers.onBossHealthUpdate,
        onBossKilled: this.eventHandlers.onBossKilled,
        onLevelUp: this.eventHandlers.onLevelUp,
        onXPGained: this.eventHandlers.onXPGained,
      },
    });

    // Shooting system
    const shootingSystem = new ShootingSystem({
      scene: this.scene,
      player,
      enemies: physics.enemies,
      bulletPool: pools.bulletPool,
      wallGroup: physics.wallGroup,
      baseFireRate: 500,
      weaponProjectileConfig,
      eventHandlers: {
        onShotFired: () => {},
      },
    });

    // Room manager (needs enemy death handler ref, will be set later)
    const roomManager = new RoomManager({
      scene: this.scene,
      player,
      enemies: physics.enemies,
      bulletPool: pools.bulletPool,
      enemyBulletPool: pools.enemyBulletPool,
      bombPool: pools.bombPool,
      goldPool: pools.goldPool,
      healthPool: pools.healthPool,
      spiritCatPool: pools.spiritCatPool,
      roomGenerator,
      wallGroup: physics.wallGroup,
      runRng,
      difficultyConfig,
      isEndlessMode,
      totalRooms,
      eventHandlers: {
        onRoomCleared: this.eventHandlers.onRoomCleared,
        onRoomEntered: this.eventHandlers.onRoomEntered,
        onUpdateRoomUI: this.eventHandlers.onUpdateRoomUI,
        onBossSpawned: (boss, bossType, bossName) => {
          this.boss = boss;
          combatSystem.setBoss(boss);
          this.eventHandlers.onBossSpawned(boss, bossType, bossName);
        },
        onShowBossHealth: this.eventHandlers.onShowBossHealth,
        onHideBossHealth: this.eventHandlers.onHideBossHealth,
        onVictory: this.eventHandlers.onVictory,
        onBombExplosion: this.eventHandlers.onBombExplosion,
      },
    });

    // Enemy death handler
    const enemyDeathHandler = new EnemyDeathHandler({
      scene: this.scene,
      player,
      roomManager,
      particles: visualEffects.particles,
      screenShake: visualEffects.screenShake,
      goldPool: pools.goldPool,
      healthPool: pools.healthPool,
      difficultyConfig,
      bonusXPMultiplier: 1 + (equipmentManager.getEquippedStats().bonusXPPercent ?? 0),
      eventHandlers: {
        onKillRecorded: this.eventHandlers.onKillRecorded,
        onPlayerHealthUpdated: this.eventHandlers.onPlayerHealthUpdated,
        onXPUIUpdated: this.eventHandlers.onXPUIUpdated,
        onLevelUp: this.eventHandlers.onLevelUp,
        onBossKilled: () => {
          this.boss = null;
          roomManager.clearBoss();
        },
        onEnemyCacheInvalidated: () => shootingSystem.invalidateTargetCache(),
      },
    });

    // Level up system
    const levelUpSystem = new LevelUpSystem({
      scene: this.scene,
      game: this.game,
      player,
      abilitySystem,
      inputSystem,
      roomManager,
      enemyBulletPool: pools.enemyBulletPool,
      particles: visualEffects.particles,
      talentBonuses,
      runRng,
      eventHandlers: {
        onLevelUpStarted: this.eventHandlers.onLevelUpStarted,
        onLevelUpCompleted: this.eventHandlers.onLevelUpCompleted,
        onAbilityApplied: this.eventHandlers.onAbilityApplied,
        onStartingAbilitiesComplete: this.eventHandlers.onStartingAbilitiesComplete,
        onAutoLevelUp: this.eventHandlers.onAutoLevelUp,
        onCheckIronWill: this.eventHandlers.onCheckIronWill,
      },
    });

    // Passive effect system (declared first, assigned after respawn system)
    let passiveEffectSystem!: PassiveEffectSystem;

    // Respawn system
    const goldEarnedRef = { value: 0 };
    const respawnSystem = new RespawnSystem({
      scene: this.scene,
      game: this.game,
      player,
      enemies: physics.enemies,
      getBoss: () => this.boss,
      getInputSystem: () => inputSystem,
      getLevelUpSystem: () => levelUpSystem,
      getRoomManager: () => roomManager,
      getAbilitySystem: () => abilitySystem,
      getEnemyDeathHandler: () => enemyDeathHandler,
      getIsGameOver: this.eventHandlers.getIsGameOver,
      setIsGameOver: this.eventHandlers.setIsGameOver,
      createInputSystem: () => {
        const container = this.game.canvas.parentElement;
        return new InputSystem({
          scene: this.scene,
          joystickContainer: container ?? undefined,
        });
      },
      enemyBulletPool: pools.enemyBulletPool,
      bombPool: pools.bombPool,
      particles: visualEffects.particles,
      difficultyConfig,
      goldEarnedRef,
      runSeedString,
      isEndlessMode,
      eventHandlers: {
        onRespawnComplete: this.eventHandlers.onRespawnComplete,
        onUpdateHealthUI: this.eventHandlers.onUpdateHealthUI,
      },
    });

    // Now create passive effect system
    passiveEffectSystem = new PassiveEffectSystem({
      scene: this.scene,
      player,
      enemies: physics.enemies,
      spiritCatPool: pools.spiritCatPool,
      damageNumberPool: pools.damageNumberPool,
      particles: visualEffects.particles,
      getEnemyDeathHandler: () => enemyDeathHandler,
      getShootingSystem: () => shootingSystem,
      getCombatSystem: () => combatSystem,
      talentBonuses,
      spiritCatConfig,
      eventHandlers: {
        onIronWillActivated: this.eventHandlers.onIronWillActivated,
        onIronWillDeactivated: this.eventHandlers.onIronWillDeactivated,
        onUpdateHealthUI: this.eventHandlers.onUpdateHealthUI,
      },
    });

    // Tutorial system
    const tutorialSystem = new TutorialSystem({
      scene: this.scene,
      eventHandlers: {
        onTutorialShown: this.eventHandlers.onTutorialShown,
        onTutorialDismissed: this.eventHandlers.onTutorialDismissed,
      },
    });

    // Pickup system
    const pickupSystem = new PickupSystem({
      player,
      goldPool: pools.goldPool,
      healthPool: pools.healthPool,
      particles: visualEffects.particles,
      goldBonusMultiplier: 1 + (equipmentManager.getEquippedStats().goldBonusPercent ?? 0),
      getPassiveEffectSystem: () => passiveEffectSystem,
      eventHandlers: {
        onGoldCollected: () => {},
        onHealthCollected: () => {},
        onUpdateHealthUI: this.eventHandlers.onUpdateHealthUI,
      },
    });

    // Wire up enemy death handler boss reference
    enemyDeathHandler.setBoss(this.boss);

    // Run end system (handles victory, skip, pause, quit)
    const runEndSystem = new RunEndSystem({
      scene: this.scene,
      player,
      getInputSystem: () => inputSystem,
      getRoomManager: () => roomManager,
      getAbilitySystem: () => abilitySystem,
      getEnemyDeathHandler: () => enemyDeathHandler,
      getLevelUpSystem: () => levelUpSystem,
      getPickupSystem: () => pickupSystem,
      getIsGameOver: this.eventHandlers.getIsGameOver,
      setIsGameOver: this.eventHandlers.setIsGameOver,
      difficultyConfig,
      runStartTime,
      runSeedString,
      isEndlessMode,
      eventHandlers: {
        onDestroyInput: this.eventHandlers.onInputDestroyed,
      },
    });

    return {
      inputSystem,
      abilitySystem,
      combatSystem,
      roomManager,
      enemyDeathHandler,
      shootingSystem,
      levelUpSystem,
      respawnSystem,
      passiveEffectSystem,
      tutorialSystem,
      pickupSystem,
      runEndSystem,
    };
  }
}
