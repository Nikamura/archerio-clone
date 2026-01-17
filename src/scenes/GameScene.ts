import Phaser from "phaser";
import Player from "../entities/Player";
import Enemy from "../entities/Enemy";
import Boss from "../entities/Boss";
import { InputSystem } from "./game/InputSystem";
import { AbilitySystem } from "./game/AbilitySystem";
import { CombatSystem } from "./game/CombatSystem";
import { RoomManager } from "./game/RoomManager";
import { EnemyDeathHandler } from "./game/EnemyDeathHandler";
import { ShootingSystem } from "./game/ShootingSystem";
import { LevelUpSystem } from "./game/LevelUpSystem";
import { RespawnSystem } from "./game/RespawnSystem";
import { PassiveEffectSystem } from "./game/PassiveEffectSystem";
import { TutorialSystem } from "./game/TutorialSystem";
import BulletPool from "../systems/BulletPool";
import EnemyBulletPool from "../systems/EnemyBulletPool";
import SpiritCatPool from "../systems/SpiritCatPool";
import { getSpiritCatConfig, type SpiritCatConfig } from "../config/heroData";
import BombPool from "../systems/BombPool";
import GoldPool from "../systems/GoldPool";
import HealthPool from "../systems/HealthPool";
import DamageNumberPool from "../systems/DamageNumberPool";
import { getDifficultyConfig, DifficultyConfig } from "../config/difficulty";
import { audioManager } from "../systems/AudioManager";
import { chapterManager } from "../systems/ChapterManager";
import { getChapterDefinition } from "../config/chapterData";
import { currencyManager } from "../systems/CurrencyManager";
import { saveManager, GraphicsQuality, ColorblindMode } from "../systems/SaveManager";
import { ScreenShake, createScreenShake } from "../systems/ScreenShake";
import { ParticleManager, createParticleManager } from "../systems/ParticleManager";
import {
  BackgroundAnimationManager,
  createBackgroundAnimationManager,
} from "../systems/BackgroundAnimationManager";
import { hapticManager } from "../systems/HapticManager";
import { heroManager } from "../systems/HeroManager";
import { equipmentManager } from "../systems/EquipmentManager";
import { THEME_ASSETS } from "../config/themeData";
import { talentManager } from "../systems/TalentManager";
import type { TalentBonuses } from "../config/talentData";
import { WEAPON_TYPE_CONFIGS } from "../systems/Equipment";
// BossFactory imports removed - now in RoomManager
import { performanceMonitor } from "../systems/PerformanceMonitor";
import { getRoomGenerator, type RoomGenerator } from "../systems/RoomGenerator";
import WallGroup from "../systems/WallGroup";
import { SeededRandom } from "../systems/SeededRandom";
import { errorReporting } from "../systems/ErrorReportingManager";
import type { RespawnRoomState } from "./GameOverScene";

export default class GameScene extends Phaser.Scene {
  private difficultyConfig!: DifficultyConfig;
  private player!: Player;
  private inputSystem!: InputSystem;
  private abilitySystem!: AbilitySystem;
  private combatSystem!: CombatSystem;
  private roomManager!: RoomManager;
  private enemyDeathHandler!: EnemyDeathHandler;
  private shootingSystem!: ShootingSystem;
  private levelUpSystem!: LevelUpSystem;
  private respawnSystem!: RespawnSystem;
  private passiveEffectSystem!: PassiveEffectSystem;
  private tutorialSystem!: TutorialSystem;

  private bulletPool!: BulletPool;
  private enemyBulletPool!: EnemyBulletPool;
  private bombPool!: BombPool;
  private goldPool!: GoldPool;
  private healthPool!: HealthPool;
  private damageNumberPool!: DamageNumberPool;
  private enemies!: Phaser.Physics.Arcade.Group;

  // Visual effects systems
  private screenShake!: ScreenShake;
  private particles!: ParticleManager;
  private backgroundAnimations!: BackgroundAnimationManager;

  // Game state tracking
  private isGameOver: boolean = false;
  private currentRoom: number = 1;
  private totalRooms: number = 20;
  private boss: Boss | null = null;
  private runStartTime: number = 0;
  private goldEarned: number = 0; // Track gold earned this run

  // Endless mode
  private isEndlessMode: boolean = false;

  // Room generation system
  private roomGenerator!: RoomGenerator;
  private wallGroup!: WallGroup;

  // Seeded random for deterministic runs
  private runRng!: SeededRandom;
  private runSeedString: string = "";

  // Talent bonuses (cached for use throughout the game)
  private talentBonuses!: TalentBonuses;

  // Equipment bonuses (cached for use throughout the game)
  private bonusXPMultiplier: number = 1.0; // From equipment: bonus XP percent
  private goldBonusMultiplier: number = 1.0; // From equipment: bonus gold percent

  // Spirit cat system (Meowgik hero ability) - pool and config needed for physics setup
  private spiritCatPool: SpiritCatPool | null = null;
  private spiritCatConfig: SpiritCatConfig | null = null;

  // Weapon projectile config (for changing bullet sprites based on equipped weapon)
  private weaponProjectileConfig: { sprite: string; sizeMultiplier: number } | null = null;

  constructor() {
    super({ key: "GameScene" });
  }

  create() {
    // Load difficulty configuration
    this.difficultyConfig = getDifficultyConfig(this.game);
    console.log("Starting game with difficulty:", this.difficultyConfig.label);

    // Register shutdown event
    this.events.once("shutdown", this.shutdown, this);

    // Listen for debug skip level event
    if (this.game.registry.get("debug")) {
      this.game.events.on("debugSkipLevel", this.debugSkipLevel, this);

      // Cleanup listener on shutdown
      this.events.once("shutdown", () => {
        this.game.events.off("debugSkipLevel", this.debugSkipLevel, this);
      });
    }

    // Listen for reset level event (allows infinite stacking by restarting with upgrades)
    this.game.events.on("resetLevel", this.resetLevel, this);
    this.events.once("shutdown", () => {
      this.game.events.off("resetLevel", this.resetLevel, this);
    });

    // Listen for skip run event (allows ending run early to collect rewards)
    this.game.events.on("skipRun", this.handleSkipRun, this);
    this.events.once("shutdown", () => {
      this.game.events.off("skipRun", this.handleSkipRun, this);
    });

    // Listen for pause event
    this.game.events.on("pauseRequested", this.handlePause, this);
    this.events.once("shutdown", () => {
      this.game.events.off("pauseRequested", this.handlePause, this);
    });

    // Listen for quit from pause event
    this.game.events.on("quitFromPause", this.handleQuitFromPause, this);
    this.events.once("shutdown", () => {
      this.game.events.off("quitFromPause", this.handleQuitFromPause, this);
    });

    // Listen for respawn event (from GameOverScene after watching ad)
    this.game.events.on("playerRespawn", (roomState: RespawnRoomState) => {
      this.respawnSystem.handleRespawn(roomState);
    });
    this.events.once("shutdown", () => {
      this.game.events.off("playerRespawn");
    });

    // Check game mode
    this.isEndlessMode = this.game.registry.get("isEndlessMode") === true;

    // Reset game state
    this.isGameOver = false;
    this.currentRoom = 1;
    this.totalRooms = this.isEndlessMode ? 10 : chapterManager.getTotalRooms(); // Endless mode uses 10 rooms per wave
    this.runStartTime = Date.now();
    this.goldEarned = 0;

    // Update error reporting context
    const selectedHero = heroManager.getSelectedHeroId();
    errorReporting.setScene("GameScene");
    errorReporting.setProgress(chapterManager.getSelectedChapter(), this.currentRoom);
    errorReporting.setPlayerStats(1, 100, selectedHero || undefined);
    errorReporting.addBreadcrumb("game", "Game started", {
      chapter: chapterManager.getSelectedChapter(),
      hero: selectedHero,
    });

    // Track game start in Sentry metrics
    const gameMode = this.isEndlessMode ? "endless" : "normal";
    errorReporting.trackGameStart(
      gameMode,
      chapterManager.getSelectedChapter(),
      this.difficultyConfig.label,
    );
    if (selectedHero) {
      errorReporting.trackHeroUsed(selectedHero);
    }

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Set physics world bounds to match camera/game size
    this.physics.world.setBounds(0, 0, width, height);

    // Get selected chapter and its themed background
    const selectedChapter = chapterManager.getSelectedChapter();
    const chapterDef = getChapterDefinition(selectedChapter);
    // Use background key
    const backgroundKeyName = `chapter${selectedChapter}Bg` as keyof typeof THEME_ASSETS;
    const backgroundKey = THEME_ASSETS[backgroundKeyName] as string;

    // Start the chapter run for tracking
    const started = chapterManager.startChapter(selectedChapter);
    if (!started) {
      console.error(`GameScene: Failed to start chapter ${selectedChapter}`);
    } else {
      console.log(`GameScene: Started chapter ${selectedChapter} run`);
    }

    // Add chapter-specific background image (fallback to dungeonFloor if not loaded)
    const bgKey = this.textures.exists(backgroundKey) ? backgroundKey : "dungeonFloor";
    const bg = this.add.image(0, 0, bgKey).setOrigin(0);
    bg.setDisplaySize(width, height);

    console.log(
      `GameScene: Using background '${bgKey}' for chapter ${selectedChapter} (${chapterDef.name})`,
    );

    // Initialize background animations (will be configured after settings are loaded)
    this.backgroundAnimations = createBackgroundAnimationManager(this);
    this.backgroundAnimations.initialize(
      selectedChapter,
      saveManager.getSettings().graphicsQuality,
      bg,
    );

    // Get selected hero and stats
    const selectedHeroId = heroManager.getSelectedHeroId();
    const heroStats = heroManager.getSelectedHeroStats();
    console.log(`GameScene: Selected hero ${selectedHeroId} with stats:`, heroStats);

    // Get equipment stats
    const equipStats = equipmentManager.getEquippedStats();
    console.log("GameScene: Equipment stats:", equipStats);

    // Calculate weapon type multipliers (default to 1.0 if no weapon equipped)
    let weaponDamageMult = 1.0;
    let weaponSpeedMult = 1.0;
    if (equipStats.weaponType && WEAPON_TYPE_CONFIGS[equipStats.weaponType]) {
      const weaponConfig = WEAPON_TYPE_CONFIGS[equipStats.weaponType];
      weaponDamageMult = weaponConfig.attackDamageMultiplier;
      weaponSpeedMult = weaponConfig.attackSpeedMultiplier;
      // Store projectile config for bullet spawning
      this.weaponProjectileConfig = {
        sprite: weaponConfig.projectileSprite,
        sizeMultiplier: weaponConfig.projectileSizeMultiplier,
      };
    } else {
      // Default to standard arrow if no weapon equipped
      this.weaponProjectileConfig = {
        sprite: "bulletSprite",
        sizeMultiplier: 1.0,
      };
    }

    // Get talent bonuses (cache for use throughout the game)
    this.talentBonuses = talentManager.calculateTotalBonuses();
    console.log("GameScene: Talent bonuses:", this.talentBonuses);

    // Calculate equipment stat multiplier from talents (Equipment Bonus talent)
    const equipmentStatMultiplier = 1 + this.talentBonuses.percentEquipmentStats / 100;

    // Calculate final stats with equipment bonuses and talent bonuses
    // Formula: (baseHeroStat + flatBonus + talentFlat) * (1 + percentBonus) * weaponMult * difficultyMult
    const baseMaxHealth =
      heroStats.maxHealth +
      (equipStats.maxHealth ?? 0) * equipmentStatMultiplier +
      this.talentBonuses.flatHp;
    const finalMaxHealth =
      baseMaxHealth *
      (1 + (equipStats.maxHealthPercent ?? 0)) *
      (this.difficultyConfig.playerMaxHealth / 100);

    const baseDamage =
      heroStats.attack +
      (equipStats.attackDamage ?? 0) * equipmentStatMultiplier +
      this.talentBonuses.flatAttack;
    const finalDamage =
      baseDamage *
      (1 + (equipStats.attackDamagePercent ?? 0)) *
      weaponDamageMult *
      (this.difficultyConfig.playerDamage / 10);

    const baseAttackSpeed =
      heroStats.attackSpeed + (equipStats.attackSpeed ?? 0) * equipmentStatMultiplier;
    const finalAttackSpeed =
      baseAttackSpeed *
      (1 + (equipStats.attackSpeedPercent ?? 0) + this.talentBonuses.percentAttackSpeed / 100) *
      weaponSpeedMult *
      (this.difficultyConfig.playerAttackSpeed / 1.0);

    const finalCritChance =
      heroStats.critChance +
      (equipStats.critChance ?? 0) * equipmentStatMultiplier +
      this.talentBonuses.percentCritChance / 100;
    const finalCritDamage =
      heroStats.critDamage + (equipStats.critDamage ?? 0) * equipmentStatMultiplier;

    console.log(
      "GameScene: Final player stats - damage:",
      finalDamage,
      "attackSpeed:",
      finalAttackSpeed,
      "maxHealth:",
      finalMaxHealth,
      "critChance:",
      finalCritChance,
    );

    // Create player at bottom center with difficulty-adjusted stats and equipment bonuses
    this.player = new Player(
      this,
      width / 2,
      height - 100,
      {
        maxHealth: finalMaxHealth,
        baseDamage: finalDamage,
        baseAttackSpeed: finalAttackSpeed,
        critChance: finalCritChance,
        critDamage: finalCritDamage,
      },
      selectedHeroId,
    );

    // Set dodge chance from equipment
    const totalDodgeChance = (equipStats.dodgeChance ?? 0) * equipmentStatMultiplier;
    this.player.setDodgeChance(totalDodgeChance);

    // Calculate and cache equipment bonus multipliers for XP and gold
    this.bonusXPMultiplier = 1 + (equipStats.bonusXPPercent ?? 0);
    this.goldBonusMultiplier = 1 + (equipStats.goldBonusPercent ?? 0);
    console.log(
      "GameScene: Bonus multipliers - XP:",
      this.bonusXPMultiplier,
      "Gold:",
      this.goldBonusMultiplier,
    );

    // Apply Helix rage passive: automatically grants rage level 1 at start
    if (selectedHeroId === "helix") {
      this.player.addRage();
      console.log("GameScene: Helix passive - Rage level 1 applied automatically");
    }

    // Create bullet pools, bomb pool, gold pool, and health pool
    this.bulletPool = new BulletPool(this);
    this.enemyBulletPool = new EnemyBulletPool(this);
    this.bombPool = new BombPool(this);
    this.goldPool = new GoldPool(this);
    this.goldPool.setGoldMultiplier(this.difficultyConfig.goldMultiplier); // Apply difficulty gold scaling
    this.healthPool = new HealthPool(this);
    this.damageNumberPool = new DamageNumberPool(this);

    // Initialize ability system
    this.abilitySystem = new AbilitySystem(this.player, {
      onAbilitiesUpdated: (abilities) => {
        this.scene.get("UIScene").events.emit("updateAbilities", abilities);
      },
      onHealthUpdated: (current, max) => {
        this.scene.get("UIScene").events.emit("updateHealth", current, max);
      },
      onGiantLevelChanged: () => {
        this.updatePlayerHitboxForGiant();
      },
    });

    // Initialize spirit cat system if playing as Meowgik
    if (selectedHeroId === "meowgik") {
      this.spiritCatPool = new SpiritCatPool(this);

      // Get spirit cat config based on hero level and perks
      const heroLevel = heroManager.getLevel("meowgik");
      const unlockedPerks = new Set(heroManager.getUnlockedPerkLevels("meowgik"));
      const baseAttack = heroStats.attack;

      this.spiritCatConfig = getSpiritCatConfig(heroLevel, unlockedPerks, baseAttack);
      console.log("GameScene: Meowgik spirit cats initialized:", this.spiritCatConfig);
    }

    // Create wall group for room obstacles
    this.wallGroup = new WallGroup(this, width, height);
    // Set wall texture and color based on chapter
    this.wallGroup.setTexture(selectedChapter); // Set chapter (1-5)
    this.wallGroup.setColor(chapterDef.theme.primaryColor); // Fallback if texture missing

    // Create visual effects systems
    this.screenShake = createScreenShake(this);
    this.particles = createParticleManager(this);
    this.particles.prewarm(10); // Pre-warm particle pool for smoother gameplay

    // Apply graphics quality settings
    const settings = saveManager.getSettings();
    this.applyGraphicsQuality(settings.graphicsQuality);
    this.screenShake.setEnabled(settings.screenShakeEnabled);
    this.applyColorblindMode(settings.colorblindMode);

    // Initialize performance monitoring (debug mode only)
    if (this.game.config.physics?.arcade?.debug) {
      performanceMonitor.createOverlay(this);
    }

    // Initialize seeded random for deterministic run
    const passedSeed = this.game.registry.get("runSeed");
    if (passedSeed) {
      this.runRng = new SeededRandom(SeededRandom.parseSeed(passedSeed));
      this.game.registry.remove("runSeed"); // Clear it for next run
    } else {
      this.runRng = new SeededRandom();
    }
    this.runSeedString = this.runRng.getSeedString();
    console.log(`GameScene: Run seed: ${this.runSeedString}`);

    // Initialize room generator with seeded RNG
    this.roomGenerator = getRoomGenerator(width, height);
    this.roomGenerator.setRng(this.runRng);

    // Create enemy physics group
    this.enemies = this.physics.add.group();

    // Set up collisions
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
    // Note: Physics overlap is set up here, callback delegated to PassiveEffectSystem
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

    // Wall collisions - player and enemies collide with walls
    this.physics.add.collider(this.player, this.wallGroup);
    this.physics.add.collider(this.enemies, this.wallGroup);

    // Enemy-enemy collision - prevents enemies from stacking on each other
    this.physics.add.collider(this.enemies, this.enemies);

    // Bullets hit walls - bounce or pass through based on abilities
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

    // Initialize input system (handles keyboard + virtual joystick)
    const gameContainer = this.game.canvas.parentElement;
    this.inputSystem = new InputSystem({
      scene: this,
      joystickContainer: gameContainer ?? undefined,
    });

    // NOTE: Previously blocked joystick creation on walls, but this caused UX issues
    // where players couldn't create joystick when accidentally tapping wall areas.
    // Player movement is already constrained by physics collision with walls,
    // so allowing joystick creation anywhere is fine.

    // Initialize combat system (handles collisions and damage calculations)
    this.combatSystem = new CombatSystem({
      scene: this,
      player: this.player,
      enemies: this.enemies,
      boss: this.boss,
      screenShake: this.screenShake,
      particles: this.particles,
      damageNumberPool: this.damageNumberPool,
      talentBonuses: this.talentBonuses,
      difficultyConfig: this.difficultyConfig,
      bonusXPMultiplier: this.bonusXPMultiplier,
      eventHandlers: {
        onEnemyKilled: (enemy, isBoss) => this.handleCombatEnemyKilled(enemy, isBoss),
        onPlayerDamaged: (damage) => this.handleCombatPlayerDamaged(damage),
        onPlayerHealed: (_amount) => this.updatePlayerHealthUI(this.player),
        onPlayerDeath: () => this.handleCombatPlayerDeath(),
        onBossHealthUpdate: (health, maxHealth) => {
          this.scene.get("UIScene").events.emit("updateBossHealth", health, maxHealth);
        },
        onBossKilled: () => {
          this.boss = null;
          this.roomManager.clearBoss();
          this.scene.get("UIScene").events.emit("hideBossHealth");
        },
        onLevelUp: () => this.levelUpSystem.handleLevelUp(this.isGameOver),
        onXPGained: (xp) => {
          const leveledUp = this.player.addXP(xp);
          this.updateXPUI();
          // Don't trigger level up if player is dead or game is over
          if (leveledUp && !this.player.isDead() && !this.isGameOver) {
            this.levelUpSystem.handleLevelUp(this.isGameOver);
          }
        },
      },
    });

    // Initialize shooting system (handles targeting and projectile spawning)
    this.shootingSystem = new ShootingSystem({
      scene: this,
      player: this.player,
      enemies: this.enemies,
      bulletPool: this.bulletPool,
      wallGroup: this.wallGroup,
      baseFireRate: 500, // ms between shots
      weaponProjectileConfig: this.weaponProjectileConfig,
      eventHandlers: {
        onShotFired: () => {
          // Shot fired - no additional handling needed currently
        },
      },
    });

    // Initialize room manager (handles room progression, enemy spawning, doors)
    this.roomManager = new RoomManager({
      scene: this,
      player: this.player,
      enemies: this.enemies,
      bulletPool: this.bulletPool,
      enemyBulletPool: this.enemyBulletPool,
      bombPool: this.bombPool,
      goldPool: this.goldPool,
      healthPool: this.healthPool,
      spiritCatPool: this.spiritCatPool,
      roomGenerator: this.roomGenerator,
      wallGroup: this.wallGroup,
      runRng: this.runRng,
      difficultyConfig: this.difficultyConfig,
      isEndlessMode: this.isEndlessMode,
      totalRooms: this.totalRooms,
      eventHandlers: {
        onRoomCleared: (roomNumber, collectedGold) => {
          // Accumulate gold earned this run for stats display
          this.goldEarned += collectedGold;
          // Notify UIScene to fade out HUD for cleaner presentation
          this.scene.get("UIScene").events.emit("roomCleared");
          // Update health UI after pickups are collected
          this.scene
            .get("UIScene")
            .events.emit("updateHealth", this.player.getHealth(), this.player.getMaxHealth());
          console.log("Room", roomNumber, "cleared - UI notified, gold collected:", collectedGold);
        },
        onRoomEntered: (roomNumber, endlessWave) => {
          // Update error reporting context for new room
          errorReporting.setProgress(chapterManager.getSelectedChapter(), roomNumber);
          errorReporting.addBreadcrumb("game", `Entered room ${roomNumber}`);
          // Notify UIScene to fade in HUD
          this.scene.get("UIScene").events.emit("roomEntered");
          if (endlessWave) {
            console.log(`Entered room ${roomNumber} (Wave ${endlessWave})`);
          }
        },
        onUpdateRoomUI: (currentRoom, totalRooms, endlessWave) => {
          if (endlessWave !== undefined) {
            this.scene
              .get("UIScene")
              .events.emit("updateRoom", currentRoom, totalRooms, endlessWave);
          } else {
            this.scene.get("UIScene").events.emit("updateRoom", currentRoom, totalRooms);
          }
        },
        onBossSpawned: (boss, _bossType, _bossName) => {
          this.boss = boss;
          this.combatSystem.setBoss(boss);
          this.enemyDeathHandler?.setBoss(boss);
        },
        onShowBossHealth: (health, maxHealth, name) => {
          this.scene.get("UIScene").events.emit("showBossHealth", health, maxHealth, name);
        },
        onHideBossHealth: () => {
          this.scene.get("UIScene").events.emit("hideBossHealth");
        },
        onVictory: () => {
          this.triggerVictory();
        },
        onBombExplosion: (x, y, radius, damage) => {
          this.handleBombExplosion(x, y, radius, damage);
        },
      },
    });

    // Initialize enemy death handler (consolidates all death handling logic)
    this.enemyDeathHandler = new EnemyDeathHandler({
      scene: this,
      player: this.player,
      roomManager: this.roomManager,
      particles: this.particles,
      screenShake: this.screenShake,
      goldPool: this.goldPool,
      healthPool: this.healthPool,
      difficultyConfig: this.difficultyConfig,
      bonusXPMultiplier: this.bonusXPMultiplier,
      eventHandlers: {
        onKillRecorded: () => {
          // Kill counter is tracked in EnemyDeathHandler now
        },
        onPlayerHealthUpdated: () => this.updatePlayerHealthUI(this.player),
        onXPUIUpdated: () => this.updateXPUI(),
        onLevelUp: () => this.levelUpSystem.handleLevelUp(this.isGameOver),
        onBossKilled: () => {
          this.boss = null;
          this.roomManager.clearBoss();
        },
        onEnemyCacheInvalidated: () => this.shootingSystem.invalidateTargetCache(),
      },
    });

    // Initialize level up system (handles level-up UI and ability selection)
    this.levelUpSystem = new LevelUpSystem({
      scene: this,
      game: this.game,
      player: this.player,
      abilitySystem: this.abilitySystem,
      inputSystem: this.inputSystem,
      roomManager: this.roomManager,
      enemyBulletPool: this.enemyBulletPool,
      particles: this.particles,
      talentBonuses: this.talentBonuses,
      runRng: this.runRng,
      eventHandlers: {
        onLevelUpStarted: () => {
          this.resetJoystickState();
        },
        onLevelUpCompleted: () => {
          this.resetJoystickState();
        },
        onAbilityApplied: (_abilityId) => {
          // Iron Will check happens via ability system events
        },
        onStartingAbilitiesComplete: () => {
          this.resetJoystickState();
        },
        onAutoLevelUp: (ability) => {
          this.scene.get("UIScene").events.emit("showAutoLevelUp", ability);
        },
        onCheckIronWill: () => {
          this.passiveEffectSystem.checkIronWillStatus();
        },
      },
    });

    // Initialize respawn system (handles game over, respawn flow, and death effects)
    // Use a reference object for goldEarned so RespawnSystem always gets current value
    const goldEarnedRef = { value: this.goldEarned };
    // Update reference whenever goldEarned changes
    Object.defineProperty(this, "goldEarned", {
      get: () => goldEarnedRef.value,
      set: (v) => {
        goldEarnedRef.value = v;
      },
    });

    this.respawnSystem = new RespawnSystem({
      scene: this,
      game: this.game,
      player: this.player,
      enemies: this.enemies,
      getBoss: () => this.boss,
      getInputSystem: () => this.inputSystem,
      getLevelUpSystem: () => this.levelUpSystem,
      getRoomManager: () => this.roomManager,
      getAbilitySystem: () => this.abilitySystem,
      getEnemyDeathHandler: () => this.enemyDeathHandler,
      getIsGameOver: () => this.isGameOver,
      setIsGameOver: (value: boolean) => {
        this.isGameOver = value;
      },
      createInputSystem: () => {
        const gameContainer = this.game.canvas.parentElement;
        return new InputSystem({
          scene: this,
          joystickContainer: gameContainer ?? undefined,
        });
      },
      enemyBulletPool: this.enemyBulletPool,
      bombPool: this.bombPool,
      particles: this.particles,
      difficultyConfig: this.difficultyConfig,
      goldEarnedRef: goldEarnedRef,
      runSeedString: this.runSeedString,
      isEndlessMode: this.isEndlessMode,
      eventHandlers: {
        onRespawnComplete: (newInputSystem: InputSystem) => {
          this.inputSystem = newInputSystem;
          this.resetJoystickState();
        },
        onUpdateHealthUI: () => {
          this.updatePlayerHealthUI(this.player);
        },
      },
    });
    this.respawnSystem.setRunStartTime(this.runStartTime);

    // Initialize passive effect system (handles Iron Will, damage aura, chainsaw orbit, spirit cats)
    this.passiveEffectSystem = new PassiveEffectSystem({
      scene: this,
      player: this.player,
      enemies: this.enemies,
      spiritCatPool: this.spiritCatPool,
      damageNumberPool: this.damageNumberPool,
      particles: this.particles,
      getEnemyDeathHandler: () => this.enemyDeathHandler,
      getShootingSystem: () => this.shootingSystem,
      getCombatSystem: () => this.combatSystem,
      talentBonuses: this.talentBonuses,
      spiritCatConfig: this.spiritCatConfig,
      eventHandlers: {
        onIronWillActivated: (bonusHP) => {
          console.log(`GameScene: Iron Will activated! +${bonusHP} max HP`);
        },
        onIronWillDeactivated: (bonusHP) => {
          console.log(`GameScene: Iron Will deactivated, removed ${bonusHP} bonus HP`);
        },
        onUpdateHealthUI: () => this.updatePlayerHealthUI(this.player),
      },
    });
    this.passiveEffectSystem.initializeDamageAuraGraphics(this.player.depth);

    // Initialize tutorial system
    this.tutorialSystem = new TutorialSystem({
      scene: this,
      eventHandlers: {
        onTutorialShown: () => {
          this.physics.pause();
        },
        onTutorialDismissed: () => {
          this.physics.resume();
        },
      },
    });

    // Debug keyboard controls
    if (this.game.registry.get("debug")) {
      const nKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.N);
      nKey.on("down", () => {
        this.debugSkipLevel();
      });
    }

    // Update UIScene with room info
    this.roomManager.updateRoomUI();

    // Apply starting abilities from Glory talent (Epic talent)
    // Must be done after runRng is initialized for deterministic ability selection
    // Now shows a selection UI instead of auto-applying random abilities
    if (this.talentBonuses.startingAbilities > 0) {
      console.log(
        `GameScene: ${this.talentBonuses.startingAbilities} starting abilities from Glory talent - launching selection UI`,
      );
      // Pause physics immediately to prevent any enemy movement/attacks during selection
      this.physics.pause();
      // Note: inputSystem.hide() is called in launchStartingAbilitySelection() after inputSystem is created
      // Schedule the starting ability selection UI to launch after scene is fully ready
      // Enemy spawning is deferred until after all starting abilities are selected
      this.time.delayedCall(100, () => {
        this.levelUpSystem.launchStartingAbilitySelection();
      });
    } else {
      // No starting abilities - spawn enemies immediately
      this.roomManager.spawnEnemiesForRoom();
    }

    // Send initial health to UIScene (player may have bonus HP from equipment/talents)
    this.scene
      .get("UIScene")
      .events.emit("updateHealth", this.player.getHealth(), this.player.getMaxHealth());

    // Show tutorial for first-time players
    if (!saveManager.isTutorialCompleted()) {
      this.tutorialSystem.showTutorial();
    }

    console.log("GameScene: Created");
  }

  private triggerVictory() {
    this.isGameOver = true;
    audioManager.playVictory();
    console.log("Victory! All rooms cleared!");

    // Complete chapter in manager to unlock next chapter and calculate rewards
    // Pass difficulty gold multiplier for reward scaling
    const completionResult = chapterManager.completeChapter(
      this.player.getHealth(),
      this.player.getMaxHealth(),
      this.difficultyConfig.goldMultiplier,
    );

    // Clean up input system
    if (this.inputSystem) {
      this.inputSystem.destroy();
    }

    // Calculate play time
    const playTimeMs = Date.now() - this.runStartTime;

    // Brief delay before showing victory screen
    this.time.delayedCall(500, () => {
      // Stop UIScene first
      this.scene.stop("UIScene");

      // Launch victory scene (reusing GameOverScene for now)
      this.scene.launch("GameOverScene", {
        roomsCleared: this.roomManager.getTotalRooms(),
        enemiesKilled: this.enemyDeathHandler.getEnemiesKilled(),
        isVictory: true,
        playTimeMs,
        abilitiesGained: this.abilitySystem.getTotalAbilitiesGained(),
        goldEarned: this.goldEarned,
        completionResult: completionResult ?? undefined,
        runSeed: this.runSeedString,
        acquiredAbilities: this.levelUpSystem.getAcquiredAbilitiesArray(),
        heroXPEarned: this.enemyDeathHandler.getHeroXPEarned(),
        chapterId: chapterManager.getSelectedChapter(),
        difficulty: this.difficultyConfig.label.toLowerCase(),
      });

      // Stop GameScene last - this prevents texture issues when restarting
      this.scene.stop("GameScene");
    });
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
   * Combat event handler: Called when an enemy is killed by CombatSystem
   */
  private handleCombatEnemyKilled(enemy: Enemy, isBoss: boolean): void {
    // Delegate to EnemyDeathHandler (Bloodthirst healing handled by CombatSystem)
    this.enemyDeathHandler.handleCombatDeath(enemy, isBoss);
  }

  /**
   * Combat event handler: Called when player takes damage
   */
  private handleCombatPlayerDamaged(_damage: number): void {
    this.updatePlayerHealthUI(this.player);
  }

  /**
   * Combat event handler: Called when player dies
   */
  private handleCombatPlayerDeath(): void {
    this.respawnSystem.triggerGameOver();
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
  }

  /**
   * Update player hitbox size for Giant ability
   * Each level increases hitbox by 15%
   */
  private updatePlayerHitboxForGiant() {
    const giantLevel = this.player.getGiantLevel();
    if (giantLevel <= 0) return;

    // Base hitbox is 16, increase by 15% per level
    const newHitboxRadius = 16 * (1 + giantLevel * 0.15);

    // Also scale player sprite slightly
    const scaleMultiplier = 1 + giantLevel * 0.1; // 10% larger per level
    this.player.setScale(scaleMultiplier);

    // Update physics body
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body) {
      const displaySize = 64 * scaleMultiplier;
      const offset = (displaySize - newHitboxRadius * 2) / 2;
      body.setSize(displaySize, displaySize);
      body.setCircle(newHitboxRadius, offset, offset);
    }
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
   * Reset the level back to room 1 while keeping all acquired upgrades
   * This allows infinite ability stacking for fun overpowered runs
   */
  private resetLevel() {
    if (this.isGameOver || this.roomManager.isInTransition()) {
      console.log(
        "Reset: Ignored (GameOver:",
        this.isGameOver,
        "Transitioning:",
        this.roomManager.isInTransition(),
        ")",
      );
      return;
    }

    console.log("Resetting level - keeping all upgrades! Current level:", this.player.getLevel());

    this.roomManager.setTransitioning(true);

    // Collect any remaining pickups before reset
    const collectedGold = this.goldPool.collectAll(this.player.x, this.player.y);
    if (collectedGold > 0) {
      this.goldEarned += collectedGold;
      currencyManager.add("gold", collectedGold);
      saveManager.addGold(collectedGold);
    }
    this.healthPool.collectAll(this.player.x, this.player.y, (healAmount) => {
      this.player.heal(healAmount);
    });

    // Fade out
    this.cameras.main.fadeOut(300, 0, 0, 0);

    this.time.delayedCall(300, () => {
      // Restart chapter run to sync ChapterManager room counter with GameScene
      // This fixes desync caused by resetting GameScene.currentRoom without updating ChapterManager
      const selectedChapter = chapterManager.getSelectedChapter();
      chapterManager.startChapter(selectedChapter);

      // Reset to room 1
      this.roomManager.setRoomNumber(1);

      // Reset RNG to initial state so enemies spawn in same locations
      this.runRng.reset();

      // Clean up current room (but NOT the player - keep abilities!)
      this.roomManager.cleanupRoom();

      // Reset player position and heal to full (bottom center spawn)
      const width = this.cameras.main.width;
      const height = this.cameras.main.height;
      this.player.setPosition(width / 2, height - 100);
      this.player.setVelocity(0, 0);
      this.player.heal(this.player.getMaxHealth()); // Full heal on reset
      // Reset Iron Will state after full heal
      this.passiveEffectSystem.checkIronWillStatus();

      // Spawn enemies for room 1 (will use reset RNG)
      this.roomManager.spawnEnemiesForRoom();

      // Reset room state
      this.roomManager.setRoomCleared(false);
      this.roomManager.setTransitioning(false);

      // Update UI
      this.roomManager.updateRoomUI();
      this.scene
        .get("UIScene")
        .events.emit("updateHealth", this.player.getHealth(), this.player.getMaxHealth());
      this.scene.get("UIScene").events.emit("roomEntered");

      // Fade back in
      this.cameras.main.fadeIn(300, 0, 0, 0);

      console.log(
        "Level reset complete! Starting room 1 with",
        this.abilitySystem.getTotalAbilitiesGained(),
        "abilities",
      );
    });
  }

  /**
   * Handle skip run - allows player to end run early and collect rewards
   */
  private handleSkipRun(): void {
    if (this.isGameOver) return;

    this.isGameOver = true;
    console.log("Run skipped! Collecting rewards...");

    // End the chapter run (skipped counts as failed/abandoned)
    chapterManager.endRun(true);

    // Stop player movement
    this.player.setVelocity(0, 0);

    // Clean up input system
    if (this.inputSystem) {
      this.inputSystem.destroy();
    }

    // Calculate play time
    const playTimeMs = Date.now() - this.runStartTime;

    // Brief delay before showing game over screen
    this.time.delayedCall(300, () => {
      // Stop UIScene first
      this.scene.stop("UIScene");

      // Calculate total rooms cleared in endless mode (across all waves)
      const currentRoom = this.roomManager.getRoomNumber();
      const totalRooms = this.roomManager.getTotalRooms();
      const endlessWave = this.roomManager.getEndlessWave();
      const totalRoomsCleared = this.isEndlessMode
        ? (endlessWave - 1) * totalRooms + currentRoom - 1
        : currentRoom - 1;

      // Launch game over scene with stats (not a victory, but not a death either)
      this.scene.launch("GameOverScene", {
        roomsCleared: totalRoomsCleared,
        enemiesKilled: this.enemyDeathHandler.getEnemiesKilled(),
        isVictory: false,
        playTimeMs,
        abilitiesGained: this.abilitySystem.getTotalAbilitiesGained(),
        goldEarned: this.goldEarned,
        runSeed: this.runSeedString,
        acquiredAbilities: this.levelUpSystem.getAcquiredAbilitiesArray(),
        heroXPEarned: this.enemyDeathHandler.getHeroXPEarned(),
        isEndlessMode: this.isEndlessMode,
        endlessWave: endlessWave,
        chapterId: chapterManager.getSelectedChapter(),
        difficulty: this.difficultyConfig.label.toLowerCase(),
      });

      // Stop GameScene last - this prevents texture issues when restarting
      this.scene.stop("GameScene");
    });
  }

  /**
   * Handle pause request - pause game and show pause menu
   */
  private handlePause(): void {
    if (this.isGameOver) return;

    // Check if scene is running before attempting to pause
    if (!this.scene.isActive("GameScene")) {
      console.log("GameScene: Cannot pause - scene is not active");
      return;
    }

    console.log("GameScene: Pausing game");

    // Pause this scene (freezes physics, tweens, timers)
    this.scene.pause("GameScene");

    // Launch pause scene overlay
    this.scene.launch("PauseScene");
  }

  /**
   * Handle quit from pause menu - end run and return to main menu
   */
  private handleQuitFromPause(): void {
    // Resume scene first so we can properly shut it down
    this.scene.resume("GameScene");

    // Use skip run logic to properly end the run
    this.handleSkipRun();
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

      // Update gold pickups - check for collection, apply equipment gold bonus
      const baseGoldCollected = this.goldPool.updateAll(playerX, playerY);
      if (baseGoldCollected > 0) {
        const goldCollected = Math.round(baseGoldCollected * this.goldBonusMultiplier);
        this.goldEarned += goldCollected;
        currencyManager.add("gold", goldCollected);
        saveManager.addGold(goldCollected);
        // Gold collect particles at player position
        this.particles.emitGoldCollect(playerX, playerY);
        hapticManager.light(); // Haptic feedback for collecting gold
      }

      // Update health pickups - check for collection
      this.healthPool.updateAll(playerX, playerY, (healAmount) => {
        this.player.heal(healAmount);
        // Update health UI
        this.scene
          .get("UIScene")
          .events.emit("updateHealth", this.player.getHealth(), this.player.getMaxHealth());
        // Check Iron Will talent (deactivate if above threshold after healing)
        this.passiveEffectSystem.checkIronWillStatus();
        // Heal particles at player position
        this.particles.emitHeal(playerX, playerY);
        hapticManager.light(); // Haptic feedback for collecting health
      });

      // Update performance monitor with entity counts
      performanceMonitor.updateEntityCounts(
        enemyCount,
        this.bulletPool.getLength() + this.enemyBulletPool.getLength(),
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
    this.spiritCatConfig = null;

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
}
