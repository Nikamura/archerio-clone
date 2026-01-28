import Phaser from "phaser";
import type Player from "../../entities/Player";
import type { InputSystem } from "./InputSystem";
import type { RoomManager } from "./RoomManager";
import type { AbilitySystem, AcquiredAbility } from "./AbilitySystem";
import type { EnemyDeathHandler } from "./EnemyDeathHandler";
import type { LevelUpSystem } from "./LevelUpSystem";
import type { PickupSystem } from "./PickupSystem";
import type { DifficultyConfig } from "../../config/difficulty";
import { chapterManager } from "../../systems/ChapterManager";

/**
 * Data passed to GameOverScene (always endless mode)
 */
interface GameOverData {
  roomsCleared: number;
  enemiesKilled: number;
  isVictory: boolean;
  playTimeMs: number;
  abilitiesGained: number;
  goldEarned: number;
  runSeed: string;
  acquiredAbilities: AcquiredAbility[];
  heroXPEarned: number;
  isEndlessMode: boolean;
  endlessWave: number;
  chapterId: number;
  difficulty: string;
  playerLevel: number;
}

/**
 * Event handlers for run end events
 */
export interface RunEndEventHandlers {
  /** Called when input system needs to be destroyed */
  onDestroyInput: () => void;
}

/**
 * Configuration for RunEndSystem
 * Note: Always endless mode
 */
export interface RunEndSystemConfig {
  scene: Phaser.Scene;
  player: Player;
  getInputSystem: () => InputSystem | null;
  getRoomManager: () => RoomManager;
  getAbilitySystem: () => AbilitySystem;
  getEnemyDeathHandler: () => EnemyDeathHandler;
  getLevelUpSystem: () => LevelUpSystem;
  getPickupSystem: () => PickupSystem;
  getIsGameOver: () => boolean;
  setIsGameOver: (value: boolean) => void;
  difficultyConfig: DifficultyConfig;
  runStartTime: number;
  runSeedString: string;
  eventHandlers: RunEndEventHandlers;
}

/**
 * RunEndSystem - Manages run lifecycle (skip, pause, quit)
 *
 * Extracted from GameScene to consolidate run-ending logic.
 * Always endless mode - no story victory flow.
 *
 * Handles:
 * - Skip run flow (abandon run, collect partial rewards)
 * - Pause handling
 * - Quit from pause
 */
export class RunEndSystem {
  private scene: Phaser.Scene;
  private player: Player;
  private getInputSystem: () => InputSystem | null;
  private getRoomManager: () => RoomManager;
  private getAbilitySystem: () => AbilitySystem;
  private getEnemyDeathHandler: () => EnemyDeathHandler;
  private getLevelUpSystem: () => LevelUpSystem;
  private getPickupSystem: () => PickupSystem;
  private gameOverGetter: () => boolean;
  private gameOverSetter: (value: boolean) => void;
  private difficultyConfig: DifficultyConfig;
  private runStartTime: number;
  private runSeedString: string;
  private eventHandlers: RunEndEventHandlers;

  constructor(config: RunEndSystemConfig) {
    this.scene = config.scene;
    this.player = config.player;
    this.getInputSystem = config.getInputSystem;
    this.getRoomManager = config.getRoomManager;
    this.getAbilitySystem = config.getAbilitySystem;
    this.getEnemyDeathHandler = config.getEnemyDeathHandler;
    this.getLevelUpSystem = config.getLevelUpSystem;
    this.getPickupSystem = config.getPickupSystem;
    this.gameOverGetter = config.getIsGameOver;
    this.gameOverSetter = config.setIsGameOver;
    this.difficultyConfig = config.difficultyConfig;
    this.runStartTime = config.runStartTime;
    this.runSeedString = config.runSeedString;
    this.eventHandlers = config.eventHandlers;
  }

  /**
   * Trigger victory - no longer used in endless mode
   * Endless mode always transitions to next wave, never "wins"
   * @deprecated This method is kept for interface compatibility but is never called
   */
  triggerVictory(): void {
    // In endless mode, we never win - just go to next wave
    // This method is kept for interface compatibility
    console.warn("triggerVictory called but endless mode never ends with victory");
  }

  /**
   * Handle skip run - allows player to end run early and collect rewards
   */
  handleSkipRun(): void {
    if (this.gameOverGetter()) return;

    this.gameOverSetter(true);
    console.log("Run skipped! Collecting rewards...");

    // End the chapter run (skipped counts as abandoned)
    chapterManager.endRun(true);

    // Stop player movement
    this.player.setVelocity(0, 0);

    // Clean up input system
    this.destroyInputSystem();

    // Build game over data and transition
    const data = this.buildGameOverData();
    this.transitionToGameOver(data, 300);
  }

  /**
   * Handle pause request - pause game and show pause menu
   */
  handlePause(): void {
    if (this.gameOverGetter()) return;

    // Check if scene is running before attempting to pause
    if (!this.scene.scene.isActive("GameScene")) {
      console.log("GameScene: Cannot pause - scene is not active");
      return;
    }

    console.log("GameScene: Pausing game");

    // Pause this scene (freezes physics, tweens, timers)
    this.scene.scene.pause("GameScene");

    // Launch pause scene overlay
    this.scene.scene.launch("PauseScene");
  }

  /**
   * Handle quit from pause menu - end run and return to main menu
   */
  handleQuitFromPause(): void {
    // Resume scene first so we can properly shut it down
    this.scene.scene.resume("GameScene");

    // Use skip run logic to properly end the run
    this.handleSkipRun();
  }

  /**
   * Calculate rooms cleared based on game state (always endless mode)
   */
  private calculateRoomsCleared(): number {
    const roomManager = this.getRoomManager();
    const currentRoom = roomManager.getRoomNumber();
    const totalRooms = roomManager.getTotalRooms();
    const endlessWave = roomManager.getEndlessWave();

    // Always endless: calculate total rooms across all waves
    return (endlessWave - 1) * totalRooms + currentRoom - 1;
  }

  /**
   * Build game over data object with all stats (always endless mode)
   */
  private buildGameOverData(): GameOverData {
    const roomManager = this.getRoomManager();
    const abilitySystem = this.getAbilitySystem();
    const enemyDeathHandler = this.getEnemyDeathHandler();
    const levelUpSystem = this.getLevelUpSystem();
    const pickupSystem = this.getPickupSystem();

    const playTimeMs = Date.now() - this.runStartTime;
    const roomsCleared = this.calculateRoomsCleared();
    const endlessWave = roomManager.getEndlessWave();

    const data: GameOverData = {
      roomsCleared,
      enemiesKilled: enemyDeathHandler.getEnemiesKilled(),
      isVictory: false, // Always false in endless mode
      playTimeMs,
      abilitiesGained: abilitySystem.getTotalAbilitiesGained(),
      goldEarned: pickupSystem.getGoldEarned(),
      runSeed: this.runSeedString,
      acquiredAbilities: levelUpSystem.getAcquiredAbilitiesArray(),
      heroXPEarned: enemyDeathHandler.getHeroXPEarned(),
      chapterId: chapterManager.getSelectedChapter(),
      difficulty: this.difficultyConfig.label.toLowerCase(),
      isEndlessMode: true,
      endlessWave,
      playerLevel: this.player.getLevel(),
    };

    return data;
  }

  /**
   * Transition to game over scene
   */
  private transitionToGameOver(data: GameOverData, delay: number): void {
    this.scene.time.delayedCall(delay, () => {
      // Stop UIScene first
      this.scene.scene.stop("UIScene");

      // Launch game over scene with stats
      this.scene.scene.launch("GameOverScene", data);

      // Stop GameScene last - this prevents texture issues when restarting
      this.scene.scene.stop("GameScene");
    });
  }

  /**
   * Destroy input system if it exists
   */
  private destroyInputSystem(): void {
    const inputSystem = this.getInputSystem();
    if (inputSystem) {
      inputSystem.destroy();
      this.eventHandlers.onDestroyInput();
    }
  }

  /**
   * Clean up resources (currently no persistent resources to clean)
   */
  destroy(): void {
    // No persistent resources to clean up
  }
}
