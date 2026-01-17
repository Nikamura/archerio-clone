import Phaser from "phaser";
import Player from "../entities/Player";
import Enemy from "../entities/Enemy";
import { RangedShooterEnemy, SpreaderEnemy } from "../entities/enemies";
import Boss from "../entities/Boss";
import { InputSystem } from "./game/InputSystem";
import { AbilitySystem } from "./game/AbilitySystem";
import { CombatSystem } from "./game/CombatSystem";
import { RoomManager } from "./game/RoomManager";
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
import {
  getChapterDefinition,
  getXpMultiplierForChapter,
  type BossType,
} from "../config/chapterData";
import { BossId, getBossDefinition } from "../config/bossData";
import { currencyManager, type EnemyType } from "../systems/CurrencyManager";
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
import { ABILITIES, type AbilityData } from "../config/abilityData";
import { abilityPriorityManager } from "../systems/AbilityPriorityManager";
import { errorReporting } from "../systems/ErrorReportingManager";
import { screenManager } from "../systems/ScreenManager";
import type { RespawnRoomState, EnemyRespawnState } from "./GameOverScene";

export default class GameScene extends Phaser.Scene {
  private difficultyConfig!: DifficultyConfig;
  private player!: Player;
  private inputSystem!: InputSystem;
  private abilitySystem!: AbilitySystem;
  private combatSystem!: CombatSystem;
  private roomManager!: RoomManager;

  private bulletPool!: BulletPool;
  private enemyBulletPool!: EnemyBulletPool;
  private bombPool!: BombPool;
  private goldPool!: GoldPool;
  private healthPool!: HealthPool;
  private damageNumberPool!: DamageNumberPool;
  private enemies!: Phaser.Physics.Arcade.Group;
  private lastShotTime: number = 0;
  private fireRate: number = 500; // ms between shots

  // Visual effects systems
  private screenShake!: ScreenShake;
  private particles!: ParticleManager;
  private backgroundAnimations!: BackgroundAnimationManager;

  // Game state tracking
  private isGameOver: boolean = false;
  private enemiesKilled: number = 0;
  private currentRoom: number = 1;
  private totalRooms: number = 20;
  private isLevelingUp: boolean = false; // Player is selecting ability (immune to damage)
  private showingTutorial: boolean = false; // Tutorial overlay is visible
  private boss: Boss | null = null;
  private runStartTime: number = 0;
  private goldEarned: number = 0; // Track gold earned this run
  private heroXPEarned: number = 0; // Track hero XP earned this run

  // Endless mode
  private isEndlessMode: boolean = false;

  // Respawn tracking (one-time use per run)
  private respawnUsed: boolean = false;

  // Room generation system
  private roomGenerator!: RoomGenerator;
  private wallGroup!: WallGroup;

  // Seeded random for deterministic runs
  private runRng!: SeededRandom;
  private runSeedString: string = "";

  // Performance optimization: cache nearest enemy
  private cachedNearestEnemy: Enemy | null = null;
  private nearestEnemyCacheFrame: number = 0;
  private readonly NEAREST_ENEMY_CACHE_FRAMES = 3; // Recalculate every 3 frames

  // Damage aura tracking
  private lastAuraDamageTime: number = 0;
  private readonly AURA_DAMAGE_INTERVAL = 500; // Apply damage every 500ms (2x per second)

  // Talent bonuses (cached for use throughout the game)
  private talentBonuses!: TalentBonuses;

  // Equipment bonuses (cached for use throughout the game)
  private bonusXPMultiplier: number = 1.0; // From equipment: bonus XP percent
  private goldBonusMultiplier: number = 1.0; // From equipment: bonus gold percent

  // Iron Will state tracking (Epic talent: bonus HP when low health)
  private ironWillActive: boolean = false;
  private ironWillBonusHP: number = 0;

  // Damage aura visual effect
  private damageAuraGraphics: Phaser.GameObjects.Graphics | null = null;

  // Chainsaw orbit system
  private chainsawSprites: Phaser.GameObjects.Sprite[] = [];
  private chainsawOrbitAngle: number = 0;
  private lastChainsawDamageTime: number = 0;
  private readonly CHAINSAW_DAMAGE_INTERVAL = 200; // 5 damage ticks per second
  private readonly CHAINSAW_ORBIT_RADIUS = 100;
  private readonly CHAINSAW_ORBIT_PERIOD = 2000; // 2 seconds per full rotation
  private readonly CHAINSAW_HITBOX_RADIUS = 24;

  // Spirit cat system (Meowgik hero ability)
  private spiritCatPool: SpiritCatPool | null = null;
  private spiritCatConfig: SpiritCatConfig | null = null;
  private lastSpiritCatSpawnTime: number = 0;

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
    this.game.events.on("playerRespawn", this.handleRespawn, this);
    this.events.once("shutdown", () => {
      this.game.events.off("playerRespawn", this.handleRespawn, this);
    });

    // Handle browser visibility changes and focus loss
    // Auto-pause game when tab is hidden or window loses focus
    const handleVisibilityChange = () => {
      // Only handle if scene is active and created
      if (document.hidden && this.scene.isActive() && this.player) {
        console.log("GameScene: Page hidden, auto-pausing game");
        this.resetJoystickState();
        // Auto-pause if not already paused and game is not over
        if (!this.scene.isPaused("GameScene") && !this.isGameOver) {
          this.handlePause();
        }
      }
    };

    const handleBlur = () => {
      // Only handle if scene is active and created
      if (this.scene.isActive() && this.player) {
        console.log("GameScene: Window blur, auto-pausing game");
        this.resetJoystickState();
        // Auto-pause if not already paused and game is not over
        if (!this.scene.isPaused("GameScene") && !this.isGameOver) {
          this.handlePause();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    // Cleanup listeners on shutdown
    this.events.once("shutdown", () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    });

    // Check game mode
    this.isEndlessMode = this.game.registry.get("isEndlessMode") === true;

    // Reset game state
    this.isGameOver = false;
    this.enemiesKilled = 0;
    this.currentRoom = 1;
    this.totalRooms = this.isEndlessMode ? 10 : chapterManager.getTotalRooms(); // Endless mode uses 10 rooms per wave
    this.runStartTime = Date.now();
    this.goldEarned = 0;
    this.heroXPEarned = 0;
    this.respawnUsed = false;

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

    // Calculate game area with core bounds for gameplay
    const gameArea = screenManager.calculateGameArea(width, height);
    const core = gameArea.core;

    // Set physics world bounds to core gameplay area only (375x667)
    // This keeps game balance consistent across all screen sizes
    this.physics.world.setBounds(core.x, core.y, core.width, core.height);

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
    // Background fills entire screen (including extended margins)
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

    // Create player at bottom center of CORE area with difficulty-adjusted stats and equipment bonuses
    this.player = new Player(
      this,
      core.centerX,
      core.bottom - 100,
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

    // Create damage aura graphics (rendered below player)
    this.damageAuraGraphics = this.add.graphics();
    this.damageAuraGraphics.setDepth(this.player.depth - 1);

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
        this.launchStartingAbilitySelection();
      });
    } else {
      // No starting abilities - spawn enemies immediately
      this.roomManager.spawnEnemiesForRoom();
    }

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
    if (this.spiritCatPool) {
      this.physics.add.overlap(
        this.spiritCatPool,
        this.enemies,
        this.spiritCatHitEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
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
        onLevelUp: () => this.handleLevelUp(),
        onXPGained: (xp) => {
          const leveledUp = this.player.addXP(xp);
          this.updateXPUI();
          // Don't trigger level up if player is dead or game is over
          if (leveledUp && !this.player.isDead() && !this.isGameOver) {
            this.handleLevelUp();
          }
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
        onRoomCleared: (roomNumber) => {
          // Notify UIScene to fade out HUD for cleaner presentation
          this.scene.get("UIScene").events.emit("roomCleared");
          // Update health UI after pickups are collected
          this.scene
            .get("UIScene")
            .events.emit("updateHealth", this.player.getHealth(), this.player.getMaxHealth());
          console.log("Room", roomNumber, "cleared - UI notified");
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

    // Debug keyboard controls
    if (this.game.registry.get("debug")) {
      const nKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.N);
      nKey.on("down", () => {
        this.debugSkipLevel();
      });
    }

    // Update UIScene with room info
    this.roomManager.updateRoomUI();

    // Send initial health to UIScene (player may have bonus HP from equipment/talents)
    this.scene
      .get("UIScene")
      .events.emit("updateHealth", this.player.getHealth(), this.player.getMaxHealth());

    // Show tutorial for first-time players
    if (!saveManager.isTutorialCompleted()) {
      this.showTutorial();
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
        enemiesKilled: this.enemiesKilled,
        isVictory: true,
        playTimeMs,
        abilitiesGained: this.abilitySystem.getTotalAbilitiesGained(),
        goldEarned: this.goldEarned,
        completionResult: completionResult ?? undefined,
        runSeed: this.runSeedString,
        acquiredAbilities: this.getAcquiredAbilitiesArray(),
        heroXPEarned: this.heroXPEarned,
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
    this.checkIronWillStatus();
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
   * Determine enemy type for gold drops based on class hierarchy
   */
  private getEnemyType(enemy: Enemy): EnemyType {
    if (enemy instanceof Boss) {
      return "boss";
    }
    if (enemy instanceof SpreaderEnemy) {
      return "spreader";
    }
    if (enemy instanceof RangedShooterEnemy) {
      return "ranged";
    }
    return "melee";
  }

  /**
   * Calculate health potion heal value based on player stats and difficulty
   * - Scales with player's max health (10% of max HP)
   * - Reduced slightly on higher difficulties (more enemy damage = less healing)
   * - Clamped between 15 and 100 HP
   */
  private calculateHealthPotionValue(): number {
    // Base: 10% of player's max health
    const maxHealth = this.player.getMaxHealth();
    const baseHeal = Math.round(maxHealth * 0.1);

    // Scale down slightly on harder difficulties (enemyDamage is higher)
    // Normal difficulty has enemyDamage around 1.0, hard has 1.5+
    const difficultyMod = Math.max(0.6, 1.0 / this.difficultyConfig.enemyDamageMultiplier);
    const scaledHeal = Math.round(baseHeal * difficultyMod);

    // Clamp between min 15 and max 100 HP
    return Math.min(100, Math.max(15, scaledHeal));
  }

  /**
   * Convert BossType to BossId for kill tracking
   * Handles aliases like 'treant' -> 'tree_guardian' and 'frost_giant' -> 'ice_golem'
   */
  private normalizeBossType(bossType: BossType): BossId {
    switch (bossType) {
      case "treant":
        return "tree_guardian";
      case "frost_giant":
        return "ice_golem";
      default:
        return bossType as BossId;
    }
  }

  /**
   * Record a kill for statistics tracking
   */
  private recordKill(enemy: Enemy, isBoss: boolean): void {
    const currentBossType = this.roomManager.getCurrentBossType();
    if (isBoss && currentBossType) {
      const bossId = this.normalizeBossType(currentBossType);
      saveManager.recordBossKill(bossId);

      // Track boss kill in Sentry metrics
      const timeToKillMs = Date.now() - this.roomManager.getBossSpawnTime();
      errorReporting.trackBossKill(bossId, timeToKillMs, chapterManager.getSelectedChapter());
    } else {
      const enemyType = enemy.getEnemyType();
      saveManager.recordEnemyKill(enemyType);
      errorReporting.trackEnemyKill(enemyType);
    }
  }

  /**
   * Spawn drops at enemy death position (50% gold, 5% health potion)
   */
  private spawnDrops(enemy: Enemy): void {
    const enemyType = this.getEnemyType(enemy);

    // 50% chance to drop gold
    if (Math.random() < 0.5) {
      const goldValue = this.goldPool.spawnForEnemy(enemy.x, enemy.y, enemyType);
      console.log(`Gold spawned: ${goldValue} from ${enemyType}`);
    }

    // 5% chance to drop health potion (scales with difficulty)
    if (Math.random() < 0.05) {
      const healValue = this.calculateHealthPotionValue();
      this.healthPool.spawn(enemy.x, enemy.y, healValue);
      console.log(`Health potion spawned: ${healValue} HP`);
    }
  }

  /**
   * Combat event handler: Called when an enemy is killed by CombatSystem
   */
  private handleCombatEnemyKilled(enemy: Enemy, isBoss: boolean): void {
    // Track kill
    this.enemiesKilled++;
    this.recordKill(enemy, isBoss);

    // Bloodthirst healing is handled by CombatSystem

    // Spawn gold drop at enemy position
    this.spawnDrops(enemy);

    // Accumulate hero XP (boss gives 25 hero XP)
    this.heroXPEarned += isBoss ? 25 : 1;

    // Remove enemy from group and destroy
    enemy.destroy();

    // Invalidate nearest enemy cache since enemies changed
    this.invalidateNearestEnemyCache();

    // Check if room is cleared
    this.roomManager.checkRoomCleared();
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
    this.triggerGameOver();
  }

  private handleLevelUp() {
    // Don't allow level up if player is dead or game is over
    if (this.isGameOver || this.player.isDead()) {
      console.log("GameScene: handleLevelUp blocked - player is dead or game over");
      return;
    }

    console.log("GameScene: handleLevelUp called");
    audioManager.playLevelUp();
    hapticManager.levelUp(); // Haptic feedback for level up

    // Mark player as leveling up (immune to damage during selection)
    this.isLevelingUp = true;

    // Clear any enemy bullets that might be mid-flight
    this.enemyBulletPool.clear(true, true);

    // Level up celebration particles
    this.particles.emitLevelUp(this.player.x, this.player.y);

    // Apply heal on level up talent bonus
    if (this.talentBonuses.flatHealOnLevel > 0) {
      this.player.heal(this.talentBonuses.flatHealOnLevel);
      // Check Iron Will (may deactivate if healed above threshold)
      this.checkIronWillStatus();
      console.log("GameScene: Healed", this.talentBonuses.flatHealOnLevel, "HP from talent");
    }

    // Check if auto level up is enabled
    if (saveManager.getAutoLevelUp()) {
      this.handleAutoLevelUp();
      return;
    }

    // Reset joystick state before pausing to prevent stuck input
    this.resetJoystickState();

    // Pause game physics
    this.physics.pause();

    // Hide joystick so it doesn't block the UI
    console.log("GameScene: hiding joystick");
    this.inputSystem.hide();

    // Clean up any existing listeners to prevent multiple applications
    this.game.events.off("abilitySelected");

    // Listen for ability selection using global game events (more reliable than scene events)
    this.game.events.once("abilitySelected", (abilityId: string) => {
      console.log("GameScene: received abilitySelected", abilityId);
      try {
        this.applyAbility(abilityId);
        console.log("GameScene: resuming physics and showing joystick");
        // Ensure joystick state is reset before resuming
        this.resetJoystickState();
        this.physics.resume();
        this.inputSystem.show();
        // Add brief immunity period (1 second) after level up to allow dodging
        this.time.delayedCall(1000, () => {
          this.isLevelingUp = false;
        });
      } catch (error) {
        console.error("GameScene: Error applying ability:", error);
        this.resetJoystickState(); // Reset even on error
        this.physics.resume(); // Resume anyway to prevent soft-lock
        this.inputSystem.show();
        this.isLevelingUp = false; // Reset flag on error too
      }
    });

    // Launch level up scene with ability choices
    // Use launch instead of start to run in parallel
    if (this.scene.isActive("LevelUpScene")) {
      console.log("GameScene: LevelUpScene already active, restarting it");
      this.scene.stop("LevelUpScene");
    }

    // Build ability levels record from ability system
    const abilityLevels: Record<string, number> = {};
    for (const ability of this.abilitySystem.getAcquiredAbilitiesArray()) {
      abilityLevels[ability.id] = ability.level;
    }

    this.scene.launch("LevelUpScene", {
      playerLevel: this.player.getLevel(),
      abilityLevels,
      hasExtraLife: this.player.hasExtraLife(),
    });
  }

  /**
   * Get available abilities (not at max level)
   */
  private getAvailableAbilities(): AbilityData[] {
    return ABILITIES.filter((ability) => {
      const currentLevel = this.abilitySystem.getAbilityLevel(ability.id);

      // Special case for extra_life: only available if player doesn't have one
      if (ability.id === "extra_life") {
        return !this.player.hasExtraLife();
      }

      // Check max level for ALL abilities with a defined maxLevel
      // This prevents one-time abilities (like through_wall) from being offered again
      if (ability.maxLevel !== undefined && currentLevel >= ability.maxLevel) {
        return false;
      }

      return true;
    });
  }

  /**
   * Handle auto level up - select the highest priority ability without showing the selection UI
   */
  private handleAutoLevelUp() {
    // Get abilities that aren't maxed
    const availableAbilities = this.getAvailableAbilities();

    if (availableAbilities.length === 0) {
      console.log("GameScene: No available abilities for auto level up");
      this.isLevelingUp = false;
      return;
    }

    // Build ability levels record from ability system
    const abilityLevels: Record<string, number> = {};
    for (const ability of this.abilitySystem.getAcquiredAbilitiesArray()) {
      abilityLevels[ability.id] = ability.level;
    }

    // First, randomly select 3 abilities (just like the UI would show)
    // This ensures auto-level-up behavior matches manual timeout behavior
    const shuffled = [...availableAbilities].sort(() => Math.random() - 0.5);
    const randomSubset = shuffled.slice(0, 3);

    // Then select highest priority ability from the random subset
    const selectedAbility = abilityPriorityManager.getHighestPriorityAbility(
      randomSubset,
      abilityLevels,
    );

    if (!selectedAbility) {
      console.log("GameScene: No ability could be selected");
      this.isLevelingUp = false;
      return;
    }

    // Apply the ability
    this.applyAbility(selectedAbility.id);

    console.log("GameScene: Auto level up selected (priority):", selectedAbility.id);

    // Notify UIScene to show the auto level up notification
    this.scene.get("UIScene").events.emit("showAutoLevelUp", selectedAbility);

    // Brief immunity period after auto level up
    this.time.delayedCall(500, () => {
      this.isLevelingUp = false;
    });
  }

  /**
   * Launch the starting ability selection UI for Glory talent bonus
   */
  private launchStartingAbilitySelection() {
    const totalSelections = this.talentBonuses.startingAbilities;

    // Physics already paused in create() - hide joystick now that inputSystem exists
    this.inputSystem.hide();
    // Clean up any existing listeners to prevent multiple applications
    this.game.events.off("startingAbilitySelected");

    // Listen for starting ability selection using global game events
    this.game.events.on(
      "startingAbilitySelected",
      (data: { abilityId: string; remainingSelections: number; rngState: number }) => {
        console.log("GameScene: received startingAbilitySelected", data.abilityId);
        try {
          this.applyAbility(data.abilityId);
          console.log(`GameScene: Starting ability applied: ${data.abilityId}`);

          if (data.remainingSelections > 0) {
            // More selections to make - launch again with updated state
            console.log(`GameScene: ${data.remainingSelections} more starting abilities to select`);
            this.time.delayedCall(200, () => {
              this.scene.launch("StartingAbilityScene", {
                remainingSelections: data.remainingSelections,
                currentSelection: totalSelections - data.remainingSelections + 1,
                totalSelections: totalSelections,
                rngState: data.rngState,
              });
            });
          } else {
            // All starting abilities selected - resume gameplay
            console.log("GameScene: All starting abilities selected, resuming gameplay");
            this.game.events.off("startingAbilitySelected");
            this.resetJoystickState();
            this.inputSystem.show();
            // Spawn enemies now that ability selection is complete
            this.roomManager.spawnEnemiesForRoom();
            this.physics.resume();
          }
        } catch (error) {
          console.error("GameScene: Error applying starting ability:", error);
          this.game.events.off("startingAbilitySelected");
          this.resetJoystickState();
          this.inputSystem.show();
          // Spawn enemies even on error to prevent stuck game
          this.roomManager.spawnEnemiesForRoom();
          this.physics.resume();
        }
      },
    );

    // Launch the starting ability selection scene
    if (this.scene.isActive("StartingAbilityScene")) {
      console.log("GameScene: StartingAbilityScene already active, restarting it");
      this.scene.stop("StartingAbilityScene");
    }

    this.scene.launch("StartingAbilityScene", {
      remainingSelections: totalSelections,
      currentSelection: 1,
      totalSelections: totalSelections,
      rngState: this.runRng.getState(),
    });
  }

  private applyAbility(abilityId: string) {
    // Delegate to AbilitySystem
    this.abilitySystem.applyAbility(abilityId);
  }

  /**
   * Convert acquired abilities map to array for passing to other scenes
   */
  private getAcquiredAbilitiesArray(): { id: string; level: number }[] {
    return this.abilitySystem.getAcquiredAbilitiesArray();
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
    this.checkIronWillStatus();
  }

  private enemyHitPlayer(
    player: Phaser.GameObjects.GameObject,
    enemy: Phaser.GameObjects.GameObject,
  ) {
    // Delegate to CombatSystem
    this.combatSystem.enemyHitPlayer(player, enemy);
    // Check Iron Will talent (bonus HP when low health)
    this.checkIronWillStatus();
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
   * Check and update Iron Will talent status (Epic talent: bonus HP when low health)
   * Called after player takes damage or heals
   */
  private checkIronWillStatus() {
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
      console.log(`GameScene: Iron Will activated! +${this.ironWillBonusHP} max HP`);
      // Update UI to show new max health
      this.scene
        .get("UIScene")
        .events.emit("updateHealth", this.player.getHealth(), this.player.getMaxHealth());
    } else if (!shouldBeActive && this.ironWillActive) {
      // Deactivate Iron Will - remove bonus max HP
      this.ironWillActive = false;
      this.player.removeMaxHealthBonus(this.ironWillBonusHP);
      console.log(`GameScene: Iron Will deactivated, removed ${this.ironWillBonusHP} bonus HP`);
      this.ironWillBonusHP = 0;
      // Update UI to show new max health
      this.scene
        .get("UIScene")
        .events.emit("updateHealth", this.player.getHealth(), this.player.getMaxHealth());
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
      this.checkIronWillStatus();

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

  private triggerGameOver() {
    if (this.isGameOver) return;

    // Check for Extra Life before dying
    if (this.player.hasExtraLife()) {
      if (this.player.useExtraLife()) {
        console.log("Extra Life used! Reviving at 30% HP");
        // Remove extra life from skills bar
        this.abilitySystem.consumeAbility("extra_life");
        // Show revive effect
        this.player.clearTint();
        this.cameras.main.flash(500, 255, 215, 0); // Golden flash
        audioManager.playLevelUp(); // Triumphant sound
        hapticManager.levelUp();
        // Update health UI
        this.updatePlayerHealthUI(this.player);
        // Brief invincibility after revive
        this.player.setTint(0xffffff);
        this.time.delayedCall(100, () => {
          if (this.player && this.player.active) {
            this.player.clearTint();
          }
        });
        return; // Don't trigger game over
      }
    }

    this.isGameOver = true;
    audioManager.playDeath();
    hapticManager.death(); // Haptic feedback for player death
    console.log("Game Over! Enemies killed:", this.enemiesKilled);

    // Stop LevelUpScene if it's active (handles race condition edge cases)
    if (this.scene.isActive("LevelUpScene")) {
      this.scene.stop("LevelUpScene");
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
    if (!canRespawn && this.inputSystem) {
      this.inputSystem.destroy();
    }

    // Calculate play time
    const playTimeMs = Date.now() - this.runStartTime;

    // Brief delay before showing game over screen
    this.time.delayedCall(500, () => {
      // Stop UIScene first (but keep GameScene if respawn is available)
      this.scene.stop("UIScene");

      // Calculate total rooms cleared in endless mode (across all waves)
      const currentRoom = this.roomManager.getRoomNumber();
      const totalRooms = this.roomManager.getTotalRooms();
      const endlessWave = this.roomManager.getEndlessWave();
      const totalRoomsCleared = this.isEndlessMode
        ? (endlessWave - 1) * totalRooms + currentRoom - 1
        : currentRoom - 1;

      // Launch game over scene with stats
      this.scene.launch("GameOverScene", {
        roomsCleared: totalRoomsCleared,
        enemiesKilled: this.enemiesKilled,
        isVictory: false,
        playTimeMs,
        abilitiesGained: this.abilitySystem.getTotalAbilitiesGained(),
        goldEarned: this.goldEarned,
        runSeed: this.runSeedString,
        acquiredAbilities: this.getAcquiredAbilitiesArray(),
        heroXPEarned: this.heroXPEarned,
        isEndlessMode: this.isEndlessMode,
        endlessWave: endlessWave,
        chapterId: chapterManager.getSelectedChapter(),
        difficulty: this.difficultyConfig.label.toLowerCase(),
        canRespawn,
        respawnRoomState,
      });

      // Only stop GameScene if respawn is NOT available
      // When respawn is available, keep the scene running so we can resume
      if (!canRespawn) {
        this.scene.stop("GameScene");
      }
    });
  }

  /**
   * Save current room state for respawn (enemy and boss HP)
   */
  private saveRoomStateForRespawn(): RespawnRoomState {
    const enemies: EnemyRespawnState[] = [];

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
    const bossHealth = this.boss?.getHealth();
    const bossMaxHealth = this.boss?.getMaxHealth();

    console.log(
      `GameScene: Saved room state - ${enemies.length} enemies, boss HP: ${bossHealth ?? "N/A"}`,
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
  private handleRespawn(_roomState: RespawnRoomState): void {
    console.log("GameScene: Handling respawn");

    // Mark respawn as used (one-time per run)
    this.respawnUsed = true;

    // Reset game over state
    this.isGameOver = false;

    // Grant temporary immunity (2 seconds to escape danger)
    this.isLevelingUp = true;
    this.time.delayedCall(2000, () => {
      this.isLevelingUp = false;
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
    this.cameras.main.flash(500, 255, 215, 0); // Golden flash
    audioManager.playLevelUp();
    hapticManager.levelUp();

    // Enemies and boss keep their current HP since we didn't destroy GameScene
    // The room state was passed for potential future use, but enemies are already in place

    // Restart UIScene
    this.scene.launch("UIScene");

    // Re-show boss health bar if we're in a boss room
    const boss = this.roomManager.getBoss();
    const currentBossType = this.roomManager.getCurrentBossType();
    if (boss && boss.active) {
      const bossDef = getBossDefinition(currentBossType as BossId);
      const bossName = bossDef?.name || currentBossType?.replace(/_/g, " ") || "Boss";
      // Delay slightly to ensure UIScene is ready
      this.time.delayedCall(50, () => {
        this.scene
          .get("UIScene")
          .events.emit("showBossHealth", boss.getHealth(), boss.getMaxHealth(), bossName);
      });
    }

    // Re-initialize input system since it may have been in an inconsistent state
    const gameContainer = this.game.canvas.parentElement;
    this.inputSystem = new InputSystem({
      scene: this,
      joystickContainer: gameContainer ?? undefined,
    });

    // Update health UI
    this.updatePlayerHealthUI(this.player);

    console.log("GameScene: Respawn complete - Player HP:", this.player.getHealth());
  }

  /**
   * Show visual effect for respawn (expanding golden ring)
   */
  private showRespawnEffect(): void {
    const graphics = this.add.graphics();
    graphics.setDepth(50);

    const playerX = this.player.x;
    const playerY = this.player.y;
    const maxRadius = 150;
    const duration = 400;

    // Animate expanding ring
    let elapsed = 0;
    const timer = this.time.addEvent({
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
    if (this.boss && this.boss.active) {
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.boss.x,
        this.boss.y,
      );

      const angle = Phaser.Math.Angle.Between(
        this.player.x,
        this.player.y,
        this.boss.x,
        this.boss.y,
      );

      // If boss is too close, teleport them to minimum distance
      if (distance < minDistance) {
        this.boss.x = this.player.x + Math.cos(angle) * minDistance;
        this.boss.y = this.player.y + Math.sin(angle) * minDistance;
      }

      const body = this.boss.body as Phaser.Physics.Arcade.Body;
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
        enemiesKilled: this.enemiesKilled,
        isVictory: false,
        playTimeMs,
        abilitiesGained: this.abilitySystem.getTotalAbilitiesGained(),
        goldEarned: this.goldEarned,
        runSeed: this.runSeedString,
        acquiredAbilities: this.getAcquiredAbilitiesArray(),
        heroXPEarned: this.heroXPEarned,
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

  private findNearestEnemy(): Enemy | null {
    let nearestVisibleEnemy: Enemy | null = null;
    let nearestVisibleDistance = Infinity;
    let nearestBlockedEnemy: Enemy | null = null;
    let nearestBlockedDistance = Infinity;

    const children = this.enemies.getChildren();

    // Safety check for player position
    if (!this.player || !isFinite(this.player.x) || !isFinite(this.player.y)) {
      console.warn("findNearestEnemy: Invalid player position", this.player?.x, this.player?.y);
      return null;
    }

    // Check if player can shoot through walls
    const canShootThroughWalls = this.player.isThroughWallEnabled();

    // Debug: Log when there are enemies in group but none are targetable
    let activeCount = 0;
    let inactiveCount = 0;
    let bodylessCount = 0;

    children.forEach((enemy) => {
      const e = enemy as Enemy;

      // Debug: Track why enemies might be skipped
      if (!e.active) {
        inactiveCount++;
        return;
      }

      if (!e.body) {
        bodylessCount++;
        return;
      }

      activeCount++;

      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);

      // Check line of sight if player can't shoot through walls
      const hasLineOfSight =
        canShootThroughWalls ||
        !this.wallGroup ||
        this.wallGroup.hasLineOfSight(this.player.x, this.player.y, e.x, e.y);

      if (hasLineOfSight) {
        // Prioritize enemies with clear line of sight
        if (distance < nearestVisibleDistance) {
          nearestVisibleDistance = distance;
          nearestVisibleEnemy = e;
        }
      } else {
        // Track nearest blocked enemy as fallback
        if (distance < nearestBlockedDistance) {
          nearestBlockedDistance = distance;
          nearestBlockedEnemy = e;
        }
      }
    });

    // Prefer visible enemies, fall back to blocked enemies if none visible
    const nearestEnemy = nearestVisibleEnemy ?? nearestBlockedEnemy;

    // Debug: Warn if enemies exist but none are targetable
    if (children.length > 0 && !nearestEnemy) {
      console.warn(
        `findNearestEnemy: No target found! Total: ${children.length}, Active: ${activeCount}, Inactive: ${inactiveCount}, No body: ${bodylessCount}`,
      );
      // Log details about each enemy in the group
      children.forEach((enemy, i) => {
        const e = enemy as Enemy;
        console.warn(
          `  Enemy[${i}]: active=${e.active}, body=${!!e.body}, x=${e.x?.toFixed(0)}, y=${e.y?.toFixed(0)}, constructor=${e.constructor.name}`,
        );
      });
    }

    return nearestEnemy;
  }

  /**
   * Get the nearest enemy with caching for performance
   * Only recalculates every NEAREST_ENEMY_CACHE_FRAMES frames
   */
  private getCachedNearestEnemy(): Enemy | null {
    const currentFrame = this.game.getFrame();

    // Check if cache is stale
    if (currentFrame - this.nearestEnemyCacheFrame >= this.NEAREST_ENEMY_CACHE_FRAMES) {
      this.cachedNearestEnemy = this.findNearestEnemy();
      this.nearestEnemyCacheFrame = currentFrame;
    }

    // Validate cached enemy is still valid (active, has body, not destroyed)
    if (
      this.cachedNearestEnemy &&
      (!this.cachedNearestEnemy.active || !this.cachedNearestEnemy.body)
    ) {
      // Cache is invalid, force refresh
      this.cachedNearestEnemy = this.findNearestEnemy();
      this.nearestEnemyCacheFrame = currentFrame;
    }

    return this.cachedNearestEnemy;
  }

  /**
   * Invalidate the nearest enemy cache (call when enemies die or spawn)
   */
  private invalidateNearestEnemyCache(): void {
    this.nearestEnemyCacheFrame = 0;
    this.cachedNearestEnemy = null;
  }

  /**
   * Update the damage aura visual effect around the player
   * Shows a pulsing circle when damage aura ability is active
   */
  private updateDamageAuraVisual(time: number, playerX: number, playerY: number): void {
    if (!this.damageAuraGraphics) return;

    const auraRadius = this.player.getDamageAuraRadius();

    // Clear previous frame
    this.damageAuraGraphics.clear();

    // Only draw if player has damage aura ability
    if (auraRadius <= 0) return;

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
    for (const e of enemiesToDestroy) {
      const isBoss = this.boss && e === (this.boss as unknown as Enemy);
      this.enemiesKilled++;
      this.recordKill(e, !!isBoss);

      // Bloodthirst heal on kill
      const bloodthirstHeal = this.player.getBloodthirstHeal();
      if (bloodthirstHeal > 0) {
        this.player.heal(bloodthirstHeal);
        this.updatePlayerHealthUI(this.player);
      }

      // Death particles
      this.particles.emitDeath(e.x, e.y);
      this.screenShake.onExplosion();
      hapticManager.light();

      // Spawn drops
      this.spawnDrops(e);

      // Add XP with equipment XP bonus and chapter scaling
      const baseXpGain = isBoss ? 10 : 2;
      const chapterXpMultiplier = getXpMultiplierForChapter(chapterManager.getSelectedChapter());
      const xpGain = Math.round(baseXpGain * this.bonusXPMultiplier * chapterXpMultiplier);
      const leveledUp = this.player.addXP(xpGain);
      this.updateXPUI();

      // Accumulate hero XP (boss gives 25 hero XP)
      this.heroXPEarned += isBoss ? 25 : 1;

      if (leveledUp) {
        this.handleLevelUp();
      }

      if (isBoss) {
        this.boss = null;
        this.scene.get("UIScene").events.emit("hideBossHealth");
      }

      e.destroy();
      this.invalidateNearestEnemyCache();
    }

    // Check if room cleared after processing deaths
    if (enemiesToDestroy.length > 0) {
      this.roomManager.checkRoomCleared();
    }
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
      const sprite = this.add.sprite(0, 0, "chainsawOrbit");
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
    for (const e of enemiesToDestroy) {
      const isBoss = this.boss && e === (this.boss as unknown as Enemy);
      this.enemiesKilled++;
      this.recordKill(e, !!isBoss);

      // Bloodthirst heal on kill
      const bloodthirstHeal = this.player.getBloodthirstHeal();
      if (bloodthirstHeal > 0) {
        this.player.heal(bloodthirstHeal);
        this.updatePlayerHealthUI(this.player);
      }

      // Death particles
      this.particles.emitDeath(e.x, e.y);
      this.screenShake.onExplosion();
      hapticManager.light();

      // Spawn drops
      this.spawnDrops(e);

      // Add XP with equipment XP bonus and chapter scaling
      const baseXpGain = isBoss ? 10 : 2;
      const chapterXpMultiplier = getXpMultiplierForChapter(chapterManager.getSelectedChapter());
      const xpGain = Math.round(baseXpGain * this.bonusXPMultiplier * chapterXpMultiplier);
      const leveledUp = this.player.addXP(xpGain);
      this.updateXPUI();

      // Accumulate hero XP (boss gives 25 hero XP)
      this.heroXPEarned += isBoss ? 25 : 1;

      if (leveledUp) {
        this.handleLevelUp();
      }

      if (isBoss) {
        this.boss = null;
        this.scene.get("UIScene").events.emit("hideBossHealth");
      }

      e.destroy();
      this.invalidateNearestEnemyCache();
    }

    // Check if room cleared after processing deaths
    if (enemiesToDestroy.length > 0) {
      this.roomManager.checkRoomCleared();
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
    const target = this.getCachedNearestEnemy();
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

  /**
   * Handle spirit cat hitting an enemy
   */
  private spiritCatHitEnemy(
    cat: Phaser.GameObjects.GameObject,
    enemy: Phaser.GameObjects.GameObject,
  ): void {
    // Delegate to CombatSystem
    this.combatSystem.spiritCatHitEnemy(cat, enemy);
  }

  private shootAtEnemy(enemy: Enemy) {
    // Don't shoot during transitions, tutorial, or game over
    // Note: isLevelingUp is NOT checked here - player should be able to shoot after selecting ability
    // isLevelingUp is only used to provide brief immunity from damage, not block shooting
    if (this.roomManager.isInTransition() || this.showingTutorial || this.isGameOver) {
      return;
    }

    // Validate enemy position before shooting
    if (!isFinite(enemy.x) || !isFinite(enemy.y)) {
      console.warn(
        "shootAtEnemy: Invalid enemy position",
        enemy.x,
        enemy.y,
        enemy.constructor.name,
      );
      return;
    }

    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);

    // Validate calculated angle
    if (!isFinite(angle)) {
      console.warn(
        "shootAtEnemy: Invalid angle calculated",
        angle,
        "player:",
        this.player.x,
        this.player.y,
        "enemy:",
        enemy.x,
        enemy.y,
      );
      return;
    }

    const bulletSpeed = 400;

    // Offset spawn position to hit enemies directly under player
    const SPAWN_OFFSET = 20; // Pixels ahead in firing direction (past player radius of 16)
    const getSpawnPos = (bulletAngle: number) => ({
      x: this.player.x + Math.cos(bulletAngle) * SPAWN_OFFSET,
      y: this.player.y + Math.sin(bulletAngle) * SPAWN_OFFSET,
    });

    // Gather ability options for bullets (including new V1 abilities)
    const bulletOptions = {
      maxPierces: this.player.getPiercingLevel(),
      maxBounces: this.player.getRicochetBounces(),
      fireDamage: this.player.getFireDamage(),
      isCrit: this.player.rollCrit(), // Roll crit for main projectile
      // New V1 ability options
      freezeChance: this.player.getFreezeChance(),
      poisonDamage: this.player.getPoisonDamage(),
      bleedDamage: this.player.getBleedDamage(),
      lightningChainCount: this.player.getLightningChainCount(),
      maxWallBounces: this.player.getWallBounces(),
      throughWall: this.player.isThroughWallEnabled(),
      // Weapon projectile options
      projectileSprite: this.weaponProjectileConfig?.sprite,
      projectileSizeMultiplier: this.weaponProjectileConfig?.sizeMultiplier,
    };

    // Main projectile
    const mainSpawn = getSpawnPos(angle);
    this.bulletPool.spawn(mainSpawn.x, mainSpawn.y, angle, bulletSpeed, bulletOptions);

    // Front Arrow: Extra forward projectiles with slight spread
    const extraProjectiles = this.player.getExtraProjectiles();
    if (extraProjectiles > 0) {
      const spreadAngle = 0.1; // ~6 degrees spread between extra arrows
      for (let i = 0; i < extraProjectiles; i++) {
        // Alternate left and right
        const offset = (i % 2 === 0 ? 1 : -1) * Math.ceil((i + 1) / 2) * spreadAngle;
        const extraAngle = angle + offset;
        const extraSpawn = getSpawnPos(extraAngle);
        // Each extra projectile rolls its own crit
        const extraOptions = { ...bulletOptions, isCrit: this.player.rollCrit() };
        this.bulletPool.spawn(extraSpawn.x, extraSpawn.y, extraAngle, bulletSpeed, extraOptions);
      }
    }

    // Multishot: Side projectiles at 45 degrees
    const multishotCount = this.player.getMultishotCount();
    if (multishotCount > 0) {
      const sideAngle = Math.PI / 4; // 45 degrees
      for (let i = 0; i < multishotCount; i++) {
        // Add projectiles at increasing angles
        const angleOffset = sideAngle * (i + 1);
        const multiAngle1 = angle + angleOffset;
        const multiAngle2 = angle - angleOffset;
        const multiSpawn1 = getSpawnPos(multiAngle1);
        const multiSpawn2 = getSpawnPos(multiAngle2);
        // Each multishot projectile rolls its own crit
        const multishotOptions1 = { ...bulletOptions, isCrit: this.player.rollCrit() };
        const multishotOptions2 = { ...bulletOptions, isCrit: this.player.rollCrit() };
        this.bulletPool.spawn(
          multiSpawn1.x,
          multiSpawn1.y,
          multiAngle1,
          bulletSpeed,
          multishotOptions1,
        );
        this.bulletPool.spawn(
          multiSpawn2.x,
          multiSpawn2.y,
          multiAngle2,
          bulletSpeed,
          multishotOptions2,
        );
      }
    }

    // Diagonal Arrows: Arrows at 30 degree angles (80% damage)
    const diagonalArrows = this.player.getDiagonalArrows();
    if (diagonalArrows > 0) {
      const diagonalAngle = Math.PI / 6; // 30 degrees
      // diagonalArrows is in pairs (2 per level)
      const pairs = Math.floor(diagonalArrows / 2);
      for (let i = 0; i < pairs; i++) {
        const diagAngle1 = angle + diagonalAngle * (i + 1);
        const diagAngle2 = angle - diagonalAngle * (i + 1);
        const diagSpawn1 = getSpawnPos(diagAngle1);
        const diagSpawn2 = getSpawnPos(diagAngle2);
        // Each diagonal projectile rolls its own crit
        const diagOptions1 = { ...bulletOptions, isCrit: this.player.rollCrit() };
        const diagOptions2 = { ...bulletOptions, isCrit: this.player.rollCrit() };
        this.bulletPool.spawn(diagSpawn1.x, diagSpawn1.y, diagAngle1, bulletSpeed, diagOptions1);
        this.bulletPool.spawn(diagSpawn2.x, diagSpawn2.y, diagAngle2, bulletSpeed, diagOptions2);
      }
    }

    // Rear Arrow: Arrows shooting backwards (70% damage)
    const rearArrows = this.player.getRearArrows();
    if (rearArrows > 0) {
      const rearAngle = angle + Math.PI; // 180 degrees from forward
      for (let i = 0; i < rearArrows; i++) {
        // Slight spread for multiple rear arrows
        const spreadOffset = i > 0 ? (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * 0.1 : 0;
        const rearBulletAngle = rearAngle + spreadOffset;
        const rearSpawn = getSpawnPos(rearBulletAngle);
        const rearOptions = { ...bulletOptions, isCrit: this.player.rollCrit() };
        this.bulletPool.spawn(rearSpawn.x, rearSpawn.y, rearBulletAngle, bulletSpeed, rearOptions);
      }
    }

    // Play shoot sound (once per attack, not per projectile)
    audioManager.playShoot();
    hapticManager.medium(); // Haptic feedback for shooting
    this.player.playShootAnimation(angle); // Visual feedback for shooting
    this.lastShotTime = this.time.now;
  }

  private getEffectiveFireRate(): number {
    // Base fire rate modified by player's attack speed
    if (!this.player) return this.fireRate;
    return this.fireRate / this.player.getAttackSpeed();
  }

  /**
   * Handle enemy death from DOT (fire/poison damage)
   * Extracted for batch processing in update loop
   */
  private handleEnemyDOTDeath(e: Enemy): void {
    const isBoss = this.boss && e === (this.boss as unknown as Enemy);
    this.enemiesKilled++;
    this.recordKill(e, !!isBoss);

    // Bloodthirst: Heal on kill
    const bloodthirstHeal = this.player.getBloodthirstHeal();
    if (bloodthirstHeal > 0) {
      this.player.heal(bloodthirstHeal);
      this.updatePlayerHealthUI(this.player);
    }

    // Death particles with fire effect
    this.particles.emitDeath(e.x, e.y);
    this.particles.emitFire(e.x, e.y);
    this.screenShake.onExplosion();

    // Spawn gold drop at enemy position
    this.spawnDrops(e);

    // Add XP to player with equipment XP bonus and chapter scaling
    const baseXpGain = isBoss ? 10 : 2;
    const chapterXpMultiplier = getXpMultiplierForChapter(chapterManager.getSelectedChapter());
    const xpGain = Math.round(baseXpGain * this.bonusXPMultiplier * chapterXpMultiplier);
    const leveledUp = this.player.addXP(xpGain);
    this.updateXPUI();

    // Accumulate hero XP (boss gives 25 hero XP)
    this.heroXPEarned += isBoss ? 25 : 1;

    if (leveledUp) {
      this.handleLevelUp();
    }

    // Clear boss reference if boss died
    if (isBoss) {
      this.boss = null;
      this.scene.get("UIScene").events.emit("hideBossHealth");
    }

    // Remove enemy
    e.destroy();

    // Invalidate nearest enemy cache since enemies changed
    this.invalidateNearestEnemyCache();

    // Check if room cleared
    this.roomManager.checkRoomCleared();
  }

  update(time: number, delta: number) {
    // Skip update if game is over
    if (this.isGameOver) return;

    // Sync game state to CombatSystem and RoomManager
    const isTransitioning = this.roomManager.isInTransition();
    this.combatSystem.setGameState(this.isGameOver, this.isLevelingUp, isTransitioning);
    this.roomManager.setGameState(this.isGameOver, this.isLevelingUp);

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
        if (time - this.lastShotTime > this.getEffectiveFireRate()) {
          const nearestEnemy = this.getCachedNearestEnemy();
          if (nearestEnemy) {
            this.shootAtEnemy(nearestEnemy);
          }
        }
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

      // Update damage aura visual and apply damage if player has the ability
      this.updateDamageAuraVisual(time, playerX, playerY);
      this.applyDamageAura(time, playerX, playerY);

      // Update chainsaw orbit visual and apply damage
      this.updateChainsawOrbit(time, delta, playerX, playerY);

      // Spawn spirit cats if playing as Meowgik
      if (this.spiritCatPool && this.spiritCatConfig) {
        this.updateSpiritCats(time, playerX, playerY);
      }

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
        this.checkIronWillStatus();
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
   * Show tutorial overlay for first-time players
   */
  private showTutorial(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Mark tutorial as showing and pause the game physics
    this.showingTutorial = true;
    this.physics.pause();

    // Create tutorial container
    const container = this.add.container(0, 0);
    container.setDepth(1000);

    // Semi-transparent overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85);
    container.add(overlay);

    // Title
    const title = this.add
      .text(width / 2, 80, "HOW TO PLAY", {
        fontSize: "28px",
        color: "#FFD700",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    container.add(title);

    // Instructions
    const instructions = [
      { icon: "🕹️", text: "Use the joystick to MOVE", color: "#4a9eff" },
      { icon: "🏃", text: "Moving = DODGING (no shooting)", color: "#ff6b6b" },
      { icon: "🎯", text: "Stand STILL to AUTO-SHOOT", color: "#44ff88" },
      { icon: "⬆️", text: "Level up = Choose an ABILITY", color: "#ffaa00" },
      { icon: "🚪", text: "Clear rooms to PROGRESS", color: "#aa88ff" },
    ];

    let yPos = 160;
    instructions.forEach((inst) => {
      const iconText = this.add
        .text(50, yPos, inst.icon, {
          fontSize: "28px",
        })
        .setOrigin(0, 0.5);

      const descText = this.add
        .text(90, yPos, inst.text, {
          fontSize: "16px",
          color: inst.color,
          stroke: "#000000",
          strokeThickness: 2,
        })
        .setOrigin(0, 0.5);

      container.add([iconText, descText]);
      yPos += 55;
    });

    // Core mechanic highlight box
    const highlightY = yPos + 30;
    const highlightBox = this.add.rectangle(width / 2, highlightY, width - 40, 70, 0x333355);
    highlightBox.setStrokeStyle(2, 0x4a9eff);
    container.add(highlightBox);

    const coreText = this.add
      .text(width / 2, highlightY - 12, "THE CORE MECHANIC:", {
        fontSize: "14px",
        color: "#aaaaaa",
      })
      .setOrigin(0.5);
    container.add(coreText);

    const mechanic = this.add
      .text(width / 2, highlightY + 12, "STOP to SHOOT • MOVE to DODGE", {
        fontSize: "18px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    container.add(mechanic);

    // Start button
    const startY = height - 100;
    const startButton = this.add
      .text(width / 2, startY, "TAP TO START", {
        fontSize: "22px",
        color: "#ffffff",
        backgroundColor: "#4a9eff",
        padding: { x: 30, y: 15 },
      })
      .setOrigin(0.5);
    startButton.setInteractive({ useHandCursor: true });
    container.add(startButton);

    // Pulse animation on start button
    this.tweens.add({
      targets: startButton,
      scale: { from: 1, to: 1.05 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Skip text
    const skipText = this.add
      .text(width / 2, startY + 50, "Tap anywhere to begin", {
        fontSize: "12px",
        color: "#888888",
      })
      .setOrigin(0.5);
    container.add(skipText);

    // Handle tap to dismiss
    const dismissTutorial = () => {
      // Mark tutorial as completed
      saveManager.completeTutorial();
      this.showingTutorial = false;

      // Animate out
      this.tweens.add({
        targets: container,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          container.destroy();
          // Resume physics
          this.physics.resume();
        },
      });
    };

    // Make overlay and button clickable
    overlay.setInteractive();
    overlay.on("pointerdown", dismissTutorial);
    startButton.on("pointerdown", dismissTutorial);
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
